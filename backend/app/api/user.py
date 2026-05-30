from fastapi import Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.auth.dependancies import admin_dep
from app.config import get_password_hash
from app.common.route_generator import RouteAlchemyManager, custom_filter
from app.database import dep_get_session
from app.db_schemas import RelationLookupOut
from app.models.hr import RefreshTokenSession, User, RoleDB
from app.schemas.hr import UserCreate, UserUpdate

route_user_manager = RouteAlchemyManager(
    User,
    get_depends=[admin_dep],
    create_depends=[admin_dep],
    edit_depends=[admin_dep],
    delete_depends=[admin_dep],
    relation_lookups={
        "member_id": RelationLookupOut(
            api_route="/member",
            value_field="id",
            label_field="email",
            description="Wybierz członka powiązanego z kontem użytkownika.",
            app_route="/member",
        ),
        "roles": RelationLookupOut(
            api_route="/auth/roles",
            value_field="id",
            label_field="name",
            description="Wybierz role, które mają zostać przypisane użytkownikowi.",
            app_route="/role",
            relation_kind="many",
        ),
        "permissions": RelationLookupOut(
            api_route="/auth/permissions",
            value_field="id",
            label_field="name",
            description="Wybierz dodatkowe uprawnienia przypisane użytkownikowi.",
            relation_kind="many",
        ),
        "refresh_sessions": RelationLookupOut(
            api_route="/auth/refresh-session",
            value_field="id",
            label_field="jti",
            description="Sesje tokenów odświeżania przypisane do użytkownika.",
            relation_kind="many",
        ),
    },
)

route_user_manager.link_list_route(
    list_filters=[
        ("is_active", "Aktywny?", bool, lambda query, value: custom_filter(query, User.is_active, value)),
        ("member_id", "Członek ID", int, lambda query, value: custom_filter(query, User.member_id, value)),
    ]
)
route_user_manager.link_schema_route()
route_user_manager.link_get_route()


def create_user_route(
    payload: UserCreate,
    session: Session = Depends(dep_get_session),
):
    if session.query(User).filter(User.username == payload.username).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The user with this username already exists in the system",
        )

    if session.query(User).filter(User.email == payload.email).first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The user with this email already exists in the system",
        )

    db_user = User(
        username=payload.username,
        email=payload.email,
        hashed_password=get_password_hash(payload.password),
        is_active=payload.is_active,
        member_id=payload.member_id,
    )
    session.add(db_user)
    session.flush()

    if payload.role_id is not None:
        role = session.query(RoleDB).filter(RoleDB.id == payload.role_id).first()
        if role is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Role not found",
            )
        db_user.roles.append(role)

    session.commit()
    session.refresh(db_user)
    return db_user


route_user_manager.safe_route_append(
    "post",
    "",
    create_user_route,
    route_user_manager.full_pyd_cls,
    [admin_dep],
    f"Create new {route_user_manager.model_name}",
)


def update_user_route(
    user_id: int,
    payload: UserUpdate,
    session: Session = Depends(dep_get_session),
):
    db_user = session.query(User).filter(User.id == user_id).first()
    if db_user is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )

    update_data = payload.model_dump(exclude_unset=True)
    password = update_data.pop("password", None)
    role_id = update_data.pop("role_id", None)

    username = update_data.get("username")
    if (
        username is not None
        and username != db_user.username
        and session.query(User).filter(User.username == username).first()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The user with this username already exists in the system",
        )

    email = update_data.get("email")
    if (
        email is not None
        and email != db_user.email
        and session.query(User).filter(User.email == email).first()
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="The user with this email already exists in the system",
        )

    for field_name in ("username", "email", "is_active", "member_id"):
        if field_name in update_data:
            setattr(db_user, field_name, update_data[field_name])

    if isinstance(password, str) and password:
        db_user.hashed_password = get_password_hash(password)

    if role_id is not None:
        role = session.query(RoleDB).filter(RoleDB.id == role_id).first()
        if role is None:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail="Role not found",
            )
        db_user.roles = [role]

    session.commit()
    session.refresh(db_user)
    return db_user


route_user_manager.safe_route_append(
    "put",
    "/{user_id:int}",
    update_user_route,
    route_user_manager.full_pyd_cls,
    [admin_dep],
    f"Update existed {route_user_manager.model_name}",
)
route_user_manager.link_delete_route(to_archive=False)

route_refresh_session_manager = RouteAlchemyManager(
    RefreshTokenSession,
    get_depends=[admin_dep],
)

route_refresh_session_manager.link_list_route(
    list_filters=[
        (
            "user_id",
            "Użytkownik ID",
            int,
            lambda query, value: custom_filter(
                query,
                RefreshTokenSession.user_id,
                value,
            ),
        ),
    ]
)
route_refresh_session_manager.link_schema_route()
route_refresh_session_manager.link_get_route()
