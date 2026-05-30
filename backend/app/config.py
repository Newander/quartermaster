"""
Application configuration settings
"""
from enum import Enum

from passlib.context import CryptContext
from pydantic_settings import BaseSettings


class Role(str, Enum):
    admin = "admin"
    instructor = "instructor"
    finance = "finance"
    member = "member"


pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")


def verify_password(plain_password: str, hashed_password: str) -> bool:
    return pwd_context.verify(plain_password, hashed_password)


def get_password_hash(password: str) -> str:
    return pwd_context.hash(password)


class Settings(BaseSettings):
    """Application settings"""

    # Application
    APP_NAME: str = "Quartermaster System"
    APP_VERSION: str = "1.0.0"
    API_PREFIX: str = "/api"

    # Database
    DATABASE_URL: str = "sqlite:///./hema_gym.db"

    # Auth
    SALT: str = "change-me"
    SECRET_TOKEN: str = "change-me"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 30
    REFRESH_TOKEN_SALT: str | None = None
    REFRESH_TOKEN_ROTATE: bool = True

    # CORS
    BACKEND_CORS_ORIGINS: list = ["*"]

    class Config:
        case_sensitive = True
        env_file = ".env"
        extra = "ignore"


settings = Settings()
