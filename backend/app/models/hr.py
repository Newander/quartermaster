"""
Instructor model - represents gym instructors
"""

from datetime import datetime, date

from sqlalchemy import Column, Integer, String, Date, Boolean, Table
from sqlalchemy import DateTime, Text, ForeignKey
from sqlalchemy.orm import relationship, Mapped, Session

from app.database import Base


user_role_m2m = Table(
    "user_role_m2m",
    Base.metadata,
    Column("user_id", Integer, ForeignKey("user.id", ondelete="CASCADE"), primary_key=True),
    Column("role_id", Integer, ForeignKey("role.id", ondelete="CASCADE"), primary_key=True),
)

role_permission_m2m = Table(
    "role_permission_m2m",
    Base.metadata,
    Column("role_id", Integer, ForeignKey("role.id", ondelete="CASCADE"), primary_key=True),
    Column("permission_id", Integer, ForeignKey("permission.id", ondelete="CASCADE"), primary_key=True),
)


class Member(Base):
    """Member model"""
    __tablename__ = "member"

    id = Column(Integer, primary_key=True, index=True)
    first_name = Column(String(100), nullable=False)
    last_name = Column(String(100), nullable=False)
    email = Column(String(255), unique=True, index=True, nullable=False)
    phone = Column(String(20), nullable=True)
    date_of_birth = Column(Date, nullable=True)
    registration_date = Column(Date, nullable=False, default=datetime.now)
    is_deleted = Column(Boolean, default=False)
    notes = Column(String(3000), nullable=True)

    # Relationships
    memberships = relationship("MembershipPayment", back_populates="member", cascade="all, delete-orphan")
    training_sessions = relationship("TrainingSessionAttendance", back_populates="member", cascade="all, delete-orphan")
    event_registrations = relationship("EventRegistration", back_populates="member", cascade="all, delete-orphan")
    member_contracts = relationship("MemberContract", back_populates="member", cascade="all, delete-orphan")
    instructor_impersonation: Mapped["Instructor"] = relationship(
        "Instructor", back_populates="member", cascade="all, delete-orphan"
    )
    shelf_rentals = relationship("ShelfRental", back_populates="member", cascade="all, delete-orphan")

    @classmethod
    def count_registered(cls, db: Session, start_date: date, end_date: date) -> int:
        return db.query(cls).filter(
            cls.registration_date >= start_date,
            cls.registration_date <= end_date
        ).count()


class Instructor(Base):
    """Instructor model"""
    __tablename__ = "instructor"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("member.id"), nullable=False)
    specialization = Column(String(200), nullable=False)  # e.g., "Longsword", "Rapier", etc.
    bio = Column(Text, nullable=True)
    is_active = Column(Boolean, default=True)
    hire_date = Column(DateTime, nullable=False, default=datetime.now)

    # Relationships
    member: Mapped[Member] = relationship("Member", back_populates="instructor_impersonation")
    schedules = relationship("Schedule", secondary="schedule_instructor_m2m", back_populates="instructors")
    training_sessions = relationship("TrainingSession", secondary="training_form_instructor_m2m", back_populates="instructors")


class Permission(Base):
    __tablename__ = "permission"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(250), nullable=False, unique=True)
    description = Column(String(1500), nullable=True)

    roles = relationship("RoleDB", secondary=role_permission_m2m, back_populates="permissions")


class RoleDB(Base):
    __tablename__ = "role"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(250), nullable=False, unique=True)
    description = Column(String(1500), nullable=True)

    permissions = relationship("Permission", secondary=role_permission_m2m, back_populates="roles")
    users = relationship("User", secondary=user_role_m2m, back_populates="roles")


class User(Base):
    __tablename__ = "user"

    id = Column(Integer, primary_key=True, index=True)
    username = Column(String(250), nullable=False, unique=True, index=True)
    email = Column(String(250), nullable=False)
    hashed_password = Column(String(1500), nullable=False)
    is_active = Column(Boolean, default=True)
    member_id = Column(Integer, ForeignKey("member.id"), nullable=True)

    member = relationship("Member")
    roles = relationship("RoleDB", secondary=user_role_m2m, back_populates="users")
    refresh_sessions = relationship("RefreshTokenSession", back_populates="user", cascade="all, delete-orphan")

    @property
    def permissions(self) -> list[Permission]:
        permissions_by_name: dict[str, Permission] = {}
        for role in self.roles:
            for permission in role.permissions:
                permissions_by_name[permission.name] = permission
        return list(permissions_by_name.values())

    def role_names(self) -> set[str]:
        return {role.name for role in self.roles}


class RefreshTokenSession(Base):
    __tablename__ = "refresh_token_session"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("user.id", ondelete="CASCADE"), nullable=False, index=True)
    jti = Column(String(64), nullable=False, unique=True, index=True)
    token_hash = Column(String(64), nullable=False)
    expires_at = Column(DateTime, nullable=False)
    revoked_at = Column(DateTime, nullable=True)
    replaced_by_jti = Column(String(64), nullable=True)

    user = relationship("User", back_populates="refresh_sessions")
