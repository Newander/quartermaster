from datetime import UTC, datetime, timedelta
from hashlib import sha256
from typing import Any, Literal
from uuid import uuid4

from jose import JWTError, jwt

from app.config import settings

TokenType = Literal["access", "refresh"]


def utcnow() -> datetime:
    return datetime.now(UTC)


def _get_token_secret(token_type: TokenType) -> str:
    if token_type == "refresh" and settings.REFRESH_TOKEN_SALT:
        return settings.REFRESH_TOKEN_SALT
    return settings.SALT


def generate_token_jti() -> str:
    return uuid4().hex


def hash_token(raw_token: str) -> str:
    return sha256(raw_token.encode("utf-8")).hexdigest()


def create_token(
    subject: str,
    token_type: TokenType,
    expires_delta: timedelta,
    *,
    jti: str | None = None,
) -> str:
    payload: dict[str, Any] = {
        "sub": subject,
        "typ": token_type,
        "jti": jti or generate_token_jti(),
        "exp": utcnow() + expires_delta,
    }
    return jwt.encode(payload, _get_token_secret(token_type), algorithm=settings.ALGORITHM)


def create_access_token(subject: str, expires_delta: timedelta | None = None) -> str:
    return create_token(
        subject=subject,
        token_type="access",
        expires_delta=expires_delta or timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES),
    )


def create_refresh_token(
    subject: str,
    expires_delta: timedelta | None = None,
    *,
    jti: str | None = None,
) -> str:
    return create_token(
        subject=subject,
        token_type="refresh",
        expires_delta=expires_delta or timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS),
        jti=jti,
    )


def decode_token(
    token: str,
    *,
    expected_type: TokenType | None = None,
    allow_legacy_access_type: bool = False,
) -> dict[str, Any]:
    access_secret = _get_token_secret("access")
    refresh_secret = _get_token_secret("refresh")

    candidate_secrets: list[str] = [access_secret]
    if expected_type == "refresh":
        candidate_secrets = [refresh_secret]
    elif refresh_secret not in candidate_secrets:
        candidate_secrets.append(refresh_secret)

    payload: dict[str, Any] | None = None
    last_error: JWTError | None = None
    for secret in candidate_secrets:
        try:
            payload = jwt.decode(token, secret, algorithms=[settings.ALGORITHM])
            break
        except JWTError as error:
            last_error = error

    if payload is None:
        raise last_error or JWTError("Could not decode token")

    if expected_type is None:
        return payload

    token_type = payload.get("typ")
    if token_type is None and expected_type == "access" and allow_legacy_access_type:
        return payload

    if token_type != expected_type:
        raise JWTError("Could not validate credentials: incorrect token type")

    return payload
