from typing import Annotated, Self

from fastapi import Depends, Header, HTTPException, status
from fastapi.security import OAuth2PasswordBearer
from jose import JWTError
from sqlalchemy.orm import Session

from app.auth.role_check import RoleChecker, is_finance, is_admin, is_instructor, is_member
from app.auth.tokens import decode_token
from app.config import settings
from app.database import dep_get_session
from app.models.hr import User
from app.schemas.hr import TokenData

oauth2_scheme = OAuth2PasswordBearer(tokenUrl="login")

from cachetools import TTLCache, cached

# Create a cache for 100 users with a 10-minute TTL (600 seconds)
user_cache = TTLCache(maxsize=100, ttl=600)


@cached(cache=user_cache)
def get_user_from_db(session: Session, username: str) -> User | None:
    """Returns cached user or queries database"""
    return session.query(User).filter(User.username == username).first()


async def get_current_user(
    token: str = Depends(oauth2_scheme),
    session: Session = Depends(dep_get_session),
) -> User:
    """Authenticates user from token; returns user or raises"""
    try:
        payload = decode_token(
            token,
            expected_type="access",
            allow_legacy_access_type=True,
        )

        if not (username := payload.get("sub")):
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Could not validate credentials: sub is not present in JWT payload",
                headers={"WWW-Authenticate": "Bearer"},
            )
        token_data = TokenData(username=username)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials: incorrect JWT",
            headers={"WWW-Authenticate": "Bearer"},
        )

    if (user := get_user_from_db(session, token_data.username)) is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials: user not found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


async def check_secret_token(authorization: str | None = Header(default=None)) -> bool:
    """ Inspecting that a user is registered by the right admin """
    if not authorization or authorization != settings.SECRET_TOKEN:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid secret token.",
        )
    return True


class RoleCheckerDepends(RoleChecker):
    """
    Depends wrapper for FastAPI Dependancy management features
    """

    @classmethod
    def from_role_checker(cls, role_checker: RoleChecker) -> Self:
        return cls(role_checker.allowed_roles)

    async def __call__(self, user: Annotated[User, Depends(get_current_user)]) -> bool:
        """ A method called on Depends() """
        if self.check({role.name for role in user.roles}):
            return True

        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Access denied."
        )


class PermissionChecker:
    def __init__(self, permission_name: str, edit: bool = False):
        self.permission_name = f"{'edit' if edit else 'read'}:{permission_name}"

    async def __call__(self, user: User = Depends(get_current_user)) -> bool:
        if not any(self.permission_name in permission.name for permission in user.permissions):
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail="Access denied."
            )

        return True


# Provide preconfigured dependencies for convenience
is_admin_dep = RoleCheckerDepends.from_role_checker(is_admin)
is_instructor_dep = RoleCheckerDepends.from_role_checker(is_instructor)
is_finance_dep = RoleCheckerDepends.from_role_checker(is_finance)
is_member_dep = RoleCheckerDepends.from_role_checker(is_member)

# Dependencies
member_get_dep = Depends(is_member_dep)
instructor_get_dep = Depends(is_instructor_dep)
admin_dep = Depends(is_admin_dep)
member_edit_dep = Depends(PermissionChecker("member", edit=True))
instructor_edit_dep = Depends(PermissionChecker("instructor", edit=True))
