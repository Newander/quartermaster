"""
API router - combines all endpoint routers
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.api import (
    auth,
    events,
    contracts,
    training,
    instructors,
    shelf,
    statistics,
    memberships,
    member,
    money,
    public_attendance,
)
from app.search_engine import SearchResult
from lifetime_function import LookupMap

api_router = APIRouter()

api_router.include_router(
    auth.router,
    prefix="/auth",
    tags=["auth"],
)

# Include all endpoint routers
api_router.include_router(
    member.router_member,
    prefix="/member",
    tags=["member"]
)

api_router.include_router(
    instructors.router,
    prefix="/instructor",
    tags=["instructor"]
)

api_router.include_router(
    training.router,
    prefix="/training",
    tags=["training"]
)

api_router.include_router(
    memberships.router,
    prefix="/membership",
    tags=["membership"]
)

api_router.include_router(
    events.router,
    prefix="/events",
    tags=["events"]
)

api_router.include_router(
    contracts.router,
    prefix="/contract",
    tags=["contract"]
)

api_router.include_router(
    statistics.stat_router,
    prefix="/statistics",
    tags=["statistics"]
)

api_router.include_router(
    shelf.router,
    prefix="/shelves",
    tags=["shelves"]
)

api_router.include_router(
    money.router,
    prefix="/money",
    tags=["money"]
)

api_router.include_router(
    public_attendance.public_router,
    prefix="/public/attendance",
    tags=["public-attendance"],
)

api_router.include_router(
    public_attendance.internal_router,
    tags=["attendance-admin"],
)


class SearchSchema(BaseModel):
    search_result: list[SearchResult]


@api_router.get("/search")
async def search_objects(search_word: str, limit: int = 15) -> SearchSchema:
    if not (result := LookupMap.seek(search_word, limit)):
        raise HTTPException(status_code=404, detail="No results found")

    return SearchSchema(search_result=result)


@api_router.get("/navigate")
async def navigation() -> dict[str, list[str]]:
    return {
        "items": [
            "panel",
            "contract",
            "member",
            "instructor",
            "schedule",
            "harmonogram",
            "training-form",
            "season",
            "training-session",
            "training-session-attendance",
            "training-session-sheet",
            "public-device-identity",
            "attendance-change-log",
            "rack",
            "shelf",
            "shelf-rental",
            "shelf-plan",
            "role",
            "user",
        ]
    }
