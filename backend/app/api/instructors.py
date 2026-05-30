"""
Instructors API endpoints
"""
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.config import settings
from app.database import get_db
from app.models import Instructor, Member
from app.schemas.hr import (
    InstructorCreate,
    InstructorUpdate,
    InstructorResponse,
    InstructorListResponse
)

router = APIRouter()


@router.post("/", response_model=InstructorResponse, status_code=status.HTTP_201_CREATED)
def create_instructor(instructor: InstructorCreate, db: Session = Depends(get_db)):
    """Create a new instructor from an existing member"""
    # Validate member exists
    member = db.get(Member, instructor.member_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Member with ID {instructor.member_id} does not exist"
        )

    # Prevent duplicate instructor for same member
    existing = db.query(Instructor).filter(Instructor.member_id == instructor.member_id).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Member {instructor.member_id} is already an instructor (id={existing.id})"
        )

    payload = instructor.model_dump()
    db_instructor = Instructor(**payload)
    db.add(db_instructor)
    db.commit()
    db.refresh(db_instructor)
    return db_instructor


@router.get("/", response_model=InstructorListResponse)
def get_instructors(
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None,
        db: Session = Depends(get_db)
):
    """Get all instructors with optional filtering"""
    query = db.query(Instructor).options(
        selectinload(Instructor.member),
        selectinload(Instructor.schedules),
        selectinload(Instructor.training_sessions),
    )

    if is_active is not None:
        query = query.filter(Instructor.is_active == is_active)

    total = query.count()
    instructors = query.offset(skip).limit(limit).all()

    return {"total": total, "instructors": instructors}


@router.get("/{instructor_id}", response_model=InstructorResponse)
def get_instructor(instructor_id: int, db: Session = Depends(get_db)):
    """Get a specific instructor by ID"""
    instructor = db.query(Instructor).options(
        selectinload(Instructor.member),
        selectinload(Instructor.schedules),
        selectinload(Instructor.training_sessions),
    ).filter(Instructor.id == instructor_id).first()
    if not instructor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instructor not found"
        )
    return instructor


@router.put("/{instructor_id}", response_model=InstructorResponse)
def update_instructor(
        instructor_id: int,
        instructor_update: InstructorUpdate,
        db: Session = Depends(get_db)
):
    """Update an instructor"""
    instructor = db.query(Instructor).filter(Instructor.id == instructor_id).first()
    if not instructor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instructor not found"
        )

    # Do not allow changing member_id via update
    update_data = instructor_update.model_dump(exclude_unset=True)
    update_data.pop("member_id", None)

    for field, value in update_data.items():
        setattr(instructor, field, value)

    db.commit()
    db.refresh(instructor)
    return instructor


@router.delete("/{instructor_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_instructor(instructor_id: int, db: Session = Depends(get_db)):
    """Delete an instructor"""
    instructor = db.query(Instructor).filter(Instructor.id == instructor_id).first()
    if not instructor:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Instructor not found"
        )

    db.delete(instructor)
    db.commit()
    return None
