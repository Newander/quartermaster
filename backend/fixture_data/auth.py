from __future__ import annotations

import os

import requests

DEFAULT_BASE_URL = os.getenv("BASE_URL", "http://localhost:8080/api")
DEFAULT_AUTH_USERNAME = os.getenv("AUTH_USERNAME", "admin_hema")
DEFAULT_AUTH_PASSWORD = os.getenv("AUTH_PASSWORD", "supersecretpassword123")
DEFAULT_AUTH_EMAIL = os.getenv("AUTH_EMAIL", "admin@gmail.com")
DEFAULT_SECRET_TOKEN = os.getenv("SECRET_TOKEN", "not-really-a-key")
AUTH_ROLE_ID = int(os.getenv("AUTH_ROLE_ID", "1"))


def ensure_bearer_auth(
    session: requests.Session,
    base_url: str = DEFAULT_BASE_URL,
    username: str = DEFAULT_AUTH_USERNAME,
    password: str = DEFAULT_AUTH_PASSWORD,
    email: str = DEFAULT_AUTH_EMAIL,
    secret_token: str = DEFAULT_SECRET_TOKEN,
    role_id: int | None = AUTH_ROLE_ID,
) -> str:
    register_payload = {
        "username": username,
        "email": email,
        "password": password,
        "is_active": True,
        "member_id": None,
    }
    if role_id is not None:
        register_payload["role_id"] = role_id
    register_headers = {"Authorization": secret_token}
    register_response = session.post(
        f"{base_url}/auth/register",
        json=register_payload,
        headers=register_headers,
    )
    if register_response.status_code not in (200, 201, 400, 409):
        register_response.raise_for_status()

    login_headers = {"Content-Type": "application/x-www-form-urlencoded"}
    login_response = session.post(
        f"{base_url}/auth/login",
        data={"username": username, "password": password},
        headers=login_headers,
    )
    login_response.raise_for_status()
    token = login_response.json()["access_token"]

    session.headers.update(
        {
            "Authorization": f"Bearer {token}",
            "Content-Type": "application/json",
        }
    )
    me_response = session.get(f"{base_url}/auth/me")
    me_response.raise_for_status()
    roles = me_response.json().get("roles", [])
    if not roles:
        raise RuntimeError(
            "Authenticated user has no roles. "
            "Set AUTH_ROLE_ID (default 1) for registration, "
            "or change AUTH_USERNAME to a new user, "
            "or assign a role to the existing user in the database."
        )
    return token


if __name__ == "__main__":
    session = requests.Session()
    ensure_bearer_auth(session)
    print(f"Authenticated fixture user: {DEFAULT_AUTH_USERNAME}")
