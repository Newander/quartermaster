from datetime import datetime, timedelta

from cachetools import TTLCache, cached
from fastapi import APIRouter, Depends, HTTPException, status
from jose import JWTError
from fastapi.security import OAuth2PasswordRequestForm
from sqlalchemy.orm import Session

from app.api.user import route_refresh_session_manager, route_user_manager
from app.auth.dependancies import get_current_user, is_admin_dep, check_secret_token
from app.auth.tokens import (
    create_access_token,
    create_refresh_token,
    decode_token,
    generate_token_jti,
    hash_token,
    utcnow,
)
from app.config import settings, get_password_hash, verify_password
from app.database import dep_get_session
from app.models import Member
from app.models.hr import User, RoleDB, Permission, RefreshTokenSession
from app.schemas.hr import RoleResponse, RoleCreate, PermissionResponse, PermissionCreate, UserResponse
from app.schemas.hr import Token, UserCreate, RefreshTokenRequest

router = APIRouter(tags=["HR / Roles & Permissions", "Authentication"])
admin_router = APIRouter(dependencies=[Depends(is_admin_dep)])

dep_cache = TTLCache(maxsize=25, ttl=300)


def _authentication_error(detail: str) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_401_UNAUTHORIZED,
        detail=detail,
        headers={"WWW-Authenticate": "Bearer"},
    )


def _utcnow_naive() -> datetime:
    return utcnow().replace(tzinfo=None)


def _issue_refresh_token_for_user(*, user: User, session: Session) -> tuple[str, str]:
    refresh_expires = timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    refresh_jti = generate_token_jti()
    refresh_token = create_refresh_token(
        subject=user.username,
        expires_delta=refresh_expires,
        jti=refresh_jti,
    )
    session.add(
        RefreshTokenSession(
            user_id=user.id,
            jti=refresh_jti,
            token_hash=hash_token(refresh_token),
            expires_at=_utcnow_naive() + refresh_expires,
        )
    )
    return refresh_token, refresh_jti


@cached(cache=dep_cache)
def dep_query_role(role_id: int, session: Session = Depends(dep_get_session)) -> RoleDB:
    if role := session.query(RoleDB).filter(RoleDB.id == role_id).first():
        return role
    raise HTTPException(status_code=404, detail="Role not found")


@cached(cache=dep_cache)
def dep_query_permission(permission_id: int, session: Session = Depends(dep_get_session)) -> Permission:
    if permission := session.query(Permission).filter(Permission.id == permission_id).first():
        return permission
    raise HTTPException(status_code=404, detail="Permission not found")


@cached(cache=dep_cache)
def dep_query_user(user_id: int, session: Session = Depends(dep_get_session)) -> User:
    if user := session.query(User).filter(User.id == user_id).first():
        return user
    raise HTTPException(status_code=404, detail="User not found")


@admin_router.get("/permissions", response_model=list[PermissionResponse])
async def list_permissions(session: Session = Depends(dep_get_session)):
    return session.query(Permission).all()


@admin_router.post("/permissions", response_model=PermissionResponse, status_code=status.HTTP_201_CREATED)
async def create_permission(permission_in: PermissionCreate, session: Session = Depends(dep_get_session)):
    permission = session.query(Permission).filter(Permission.name == permission_in.name).first()
    if permission:
        raise HTTPException(status_code=400, detail="Permission already exists")

    db_permission = Permission(**permission_in.model_dump())
    session.add(db_permission)
    session.commit()
    session.refresh(db_permission)
    return db_permission


@admin_router.get("/roles", response_model=list[RoleResponse])
async def list_roles(session: Session = Depends(dep_get_session)):
    return session.query(RoleDB).all()


@admin_router.get("/roles/{role_id:int}", response_model=RoleResponse)
async def get_role(role: RoleDB = Depends(dep_query_role)):
    return role


@admin_router.post("/roles", response_model=RoleResponse, status_code=status.HTTP_201_CREATED)
async def create_role(role_in: RoleCreate, session: Session = Depends(dep_get_session)):
    if session.query(RoleDB).filter(RoleDB.name == role_in.name).first():
        raise HTTPException(status_code=400, detail="Role already exists")

    db_role = RoleDB(**role_in.model_dump())
    session.add(db_role)
    session.commit()
    session.refresh(db_role)
    return db_role


@admin_router.delete("/roles/{role_id:int}", status_code=status.HTTP_204_NO_CONTENT)
async def delete_role(role: RoleDB = Depends(dep_query_role), session: Session = Depends(dep_get_session)):
    session.delete(role)
    session.commit()
    return


# --- Connections ---

@admin_router.post("/roles/{role_id:int}/permissions/{permission_id:int}", response_model=RoleResponse)
async def assign_permission_to_role(
        permission: Permission = Depends(dep_query_permission),
        role: RoleDB = Depends(dep_query_role),
        session: Session = Depends(dep_get_session)
):
    if permission in role.permissions:
        return role

    role.permissions.append(permission)
    session.commit()
    session.refresh(role)
    return role


@admin_router.delete("/roles/{role_id:int}/permissions/{permission_id:int}", response_model=RoleResponse)
async def remove_permission_from_role(
        permission: Permission = Depends(dep_query_permission),
        role: RoleDB = Depends(dep_query_role),
        session: Session = Depends(dep_get_session)
):
    if permission not in role.permissions:
        return role

    role.permissions.remove(permission)
    session.commit()
    session.refresh(role)
    return role


@admin_router.post("/users/{user_id:int}/roles/{role_id:int}", response_model=UserResponse)
async def assign_role_to_user(
        user: User = Depends(dep_query_user),
        role: RoleDB = Depends(dep_query_role),
        session: Session = Depends(dep_get_session)
):
    if role in user.roles:
        return user

    user.roles.append(role)
    session.commit()
    session.refresh(user)
    return user


@admin_router.delete("/users/{user_id:int}/roles/{role_id:int}", response_model=UserResponse)
async def remove_role_from_user(
        user: User = Depends(dep_query_user),
        role: RoleDB = Depends(dep_query_role),
        session: Session = Depends(dep_get_session),
):
    if role not in user.roles:
        return user

    user.roles.remove(role)
    session.commit()
    session.refresh(user)
    return user


@router.post(
    "/register",
    response_model=UserResponse,
    status_code=status.HTTP_201_CREATED,
    dependencies=[Depends(check_secret_token)],
)
async def register_user(user_in: UserCreate, session: Session = Depends(dep_get_session)):
    # Check whether the username is already taken
    user = session.query(User).filter(User.username == user_in.username).first()
    if user:
        raise HTTPException(
            status_code=400,
            detail="The user with this username already exists in the system",
        )

    # Hash the password
    hashed_password = get_password_hash(user_in.password)

    # Create the user record
    db_user = User(
        username=user_in.username,
        email=user_in.email,
        hashed_password=hashed_password,
        is_active=user_in.is_active,
        member_id=user_in.member_id
    )

    session.add(db_user)
    session.commit()
    session.refresh(db_user)

    if user_in.role_id and (role := session.query(RoleDB).filter(RoleDB.id == user_in.role_id).first()):
        db_user.roles.append(role)

    if user_in.member_id and session.query(Member).filter(Member.id == user_in.member_id).first():
        db_user.member_id = user_in.member_id

    session.commit()
    session.refresh(db_user)
    return db_user


@router.get("/me", response_model=UserResponse)
async def read_user_me(current_user: User = Depends(get_current_user)):
    """
    Get the current authenticated user's data
    """
    return current_user


@router.post("/login", response_model=Token)
async def login_for_access_token(
        session: Session = Depends(dep_get_session),
        form_data: OAuth2PasswordRequestForm = Depends()
):
    user = session.query(User).filter(User.username == form_data.username).first()
    if not user or not verify_password(form_data.password, user.hashed_password):
        raise _authentication_error("Incorrect username or password")

    access_token = create_access_token(subject=user.username)
    refresh_token, _ = _issue_refresh_token_for_user(user=user, session=session)
    session.commit()
    return {
        "access_token": access_token,
        "refresh_token": refresh_token,
        "token_type": "bearer",
    }


@router.post("/refresh", response_model=Token)
async def refresh_access_token(
    refresh_payload: RefreshTokenRequest,
    session: Session = Depends(dep_get_session),
):
    try:
        payload = decode_token(
            refresh_payload.refresh_token,
            expected_type="refresh",
        )
    except JWTError:
        raise _authentication_error(
            "Could not validate credentials: incorrect refresh token",
        )

    if not (username := payload.get("sub")):
        raise _authentication_error(
            "Could not validate credentials: sub is not present in JWT payload",
        )
    if not (refresh_jti := payload.get("jti")):
        raise _authentication_error(
            "Could not validate credentials: jti is not present in JWT payload",
        )
    if not isinstance(refresh_jti, str):
        raise _authentication_error(
            "Could not validate credentials: jti has invalid type",
        )

    user = session.query(User).filter(User.username == username).first()
    if user is None:
        raise _authentication_error("Could not validate credentials: user not found")

    token_session = session.query(RefreshTokenSession).filter(
        RefreshTokenSession.user_id == user.id,
        RefreshTokenSession.jti == refresh_jti,
    ).first()
    if token_session is None:
        raise _authentication_error(
            "Could not validate credentials: refresh session not found",
        )

    if token_session.token_hash != hash_token(refresh_payload.refresh_token):
        raise _authentication_error(
            "Could not validate credentials: refresh token mismatch",
        )

    now = _utcnow_naive()
    if token_session.revoked_at is not None:
        raise _authentication_error(
            "Could not validate credentials: refresh token revoked",
        )
    if token_session.expires_at <= now:
        raise _authentication_error(
            "Could not validate credentials: refresh token expired",
        )

    access_token = create_access_token(subject=user.username)
    if not settings.REFRESH_TOKEN_ROTATE:
        return {
            "access_token": access_token,
            "refresh_token": refresh_payload.refresh_token,
            "token_type": "bearer",
        }

    new_refresh_token, new_refresh_jti = _issue_refresh_token_for_user(user=user, session=session)
    token_session.revoked_at = now
    token_session.replaced_by_jti = new_refresh_jti
    session.commit()

    return {
        "access_token": access_token,
        "refresh_token": new_refresh_token,
        "token_type": "bearer",
    }


router.include_router(
    admin_router, tags=["Admin", "Permissions", "Roles"], dependencies=[Depends(is_admin_dep)]
)
router.include_router(
    route_refresh_session_manager.router,
    tags=["Admin", "Refresh Sessions"],
    prefix="/refresh-session",
)
router.include_router(
    route_user_manager.router, tags=["Admin", "Users"], prefix="/user"
)

