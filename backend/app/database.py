"""
Database configuration and session management
"""
from datetime import datetime
from typing import Any

from pydantic import ConfigDict, create_model
from sqlalchemy import create_engine, Column, DateTime, inspect
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker
from sqlalchemy.sql.sqltypes import Boolean, Date, DateTime as SQLDateTime, Float, Integer, Time

from app.config import settings


def _engine_connect_args(database_url: str) -> dict[str, Any]:
    if database_url.startswith("sqlite"):
        return {"check_same_thread": False}
    return {}


def normalize_database_url(database_url: str) -> str:
    return database_url


# Create SQLAlchemy engine
engine = create_engine(
    settings.DATABASE_URL,
    connect_args=_engine_connect_args(settings.DATABASE_URL),
)

# Create SessionLocal class
SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)

class QuartermasterCRMBase(declarative_base()):
    __abstract__ = True
    _generated_excluded_fields: set[str] = set()

    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, onupdate=datetime.now)

    @classmethod
    def table(cls) -> str:
        return cls.__tablename__

    @classmethod
    def get(cls, session, record_id: int):
        return session.query(cls).filter(cls.id == record_id).first()

    @classmethod
    def prepare_query(cls, session):
        return session.query(cls)


Base = QuartermasterCRMBase


def _python_type_for_column(column) -> type:
    if isinstance(column.type, Integer):
        return int
    if isinstance(column.type, Float):
        return float
    if isinstance(column.type, Boolean):
        return bool
    if isinstance(column.type, Date):
        from datetime import date

        return date
    if isinstance(column.type, Time):
        from datetime import time

        return time
    if isinstance(column.type, SQLDateTime):
        return datetime

    try:
        return column.type.python_type
    except Exception:
        return str


class QuartermasterModelBuilder:
    def __init__(self, db_model: type[QuartermasterCRMBase], max_depth: int = 1):
        self.db_model = db_model
        self.max_depth = max_depth
        self._full_models: dict[frozenset[str], type] = {}
        self._create_model: type | None = None
        self._update_model: type | None = None

    def _column_fields(self, *, optional: bool, include_primary_key: bool) -> dict[str, tuple[type, Any]]:
        fields: dict[str, tuple[type, Any]] = {}
        for column in inspect(self.db_model).columns:
            if column.key in self.db_model._generated_excluded_fields:
                continue
            if column.primary_key and not include_primary_key:
                continue

            python_type = _python_type_for_column(column)
            nullable = optional or column.nullable or column.default is not None or column.server_default is not None
            field_type = python_type | None if nullable else python_type
            default = None if nullable else ...
            fields[column.key] = (field_type, default)

        return fields

    def full_pyd_model(self, user_roles: set[str] | None = None):
        cache_key = frozenset(user_roles or set())
        if cache_key not in self._full_models:
            self._full_models[cache_key] = create_model(
                f"{self.db_model.__name__}Full",
                __config__=ConfigDict(from_attributes=True),
                **self._column_fields(optional=True, include_primary_key=True),
            )
        return self._full_models[cache_key]

    def create_pyd_model(self):
        if self._create_model is None:
            self._create_model = create_model(
                f"{self.db_model.__name__}Create",
                **self._column_fields(optional=False, include_primary_key=False),
            )
        return self._create_model

    def update_pyd_model(self):
        if self._update_model is None:
            self._update_model = create_model(
                f"{self.db_model.__name__}Update",
                **self._column_fields(optional=True, include_primary_key=False),
            )
        return self._update_model


def get_db():
    """
    Dependency function to get database session
    """
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()


def dep_get_session():
    yield from get_db()
