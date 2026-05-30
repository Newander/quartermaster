"""
Members API endpoints
"""
import csv
import io
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload
from starlette.responses import StreamingResponse

from app.database import get_db
from app.models import MemberContract, ShelfRental, Instructor
from app.models.hr import Member
from app.schemas.hr import (
    MemberCreate,
    MemberUpdate,
    MemberResponse,
    MemberListResponse
)
from app.utils import model_to_dict_selective

router_member = APIRouter()


@router_member.post("/", response_model=MemberResponse, status_code=status.HTTP_201_CREATED)
def create_member(member: MemberCreate, db: Session = Depends(get_db)):
    """Create a new member"""
    # Check if email already exists
    existing_member = db.query(Member).filter(Member.email == member.email).first()
    if existing_member:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Email already registered"
        )

    db_member = Member(**member.model_dump())
    db.add(db_member)
    db.commit()
    db.refresh(db_member)
    return db_member


@router_member.get("/", response_model=MemberListResponse)
def list_members(
        db: Session = Depends(get_db),
        # Pagination
        skip: int = 0,
        limit: int = 100,
        # Ordering
        order_by_col: str | None = None,
        order_by_asc: Literal['asc', 'desc'] = 'desc',
        # Filtering
        is_instructor: Optional[bool] = None,
        is_deleted: Optional[bool] = False,
):
    """Get all members with optional filtering"""
    query = db.query(Member).options(
        selectinload(Member.member_contracts),
        selectinload(Member.memberships),
        selectinload(Member.event_registrations),
        selectinload(Member.training_sessions),
        selectinload(Member.instructor_impersonation),
        selectinload(Member.shelf_rentals),
    )

    if is_deleted is not None:
        query = query.filter(Member.is_deleted == is_deleted)
    if is_instructor is not None:
        if is_instructor:
            query = query.join(Instructor)
        else:
            query = query.join(Instructor, isouter=True).filter(Instructor.id == None)

    total = query.count()
    members = query.order_by(
        getattr(Member.id if order_by_col is None else getattr(Member, order_by_col), order_by_asc)()
    ).offset(skip).limit(limit).all()

    return {"total": total, "members": members}


@router_member.get("/export", response_model=MemberListResponse)
def export_members(
        db: Session = Depends(get_db),
        fmt: Literal['csv'] = 'csv',
        # Filters
        is_deleted: Optional[bool] = None,
        # Additional fields
        add_signed_contracts: bool = False,
        add_instructor_data: bool = True,
        add_shelf_data: bool = False,
):
    """Get all members with optional filtering"""
    query = db.query(Member).options(
        selectinload(Member.member_contracts, MemberContract.contract),
        selectinload(Member.instructor_impersonation),
        selectinload(Member.shelf_rentals, ShelfRental.shelf),
    )
    if is_deleted is not None:
        query = query.filter(Member.is_deleted.is_(is_deleted))

    members = query.order_by(Member.id).all()
    include_relations = []
    if add_signed_contracts:
        include_relations.append('member_contracts')
    if add_instructor_data:
        include_relations.append('instructor_impersonation')
    if add_shelf_data:
        include_relations.append('shelf_rentals')

    members_data = []
    for member in members:
        updated_data = {}
        for k, v in (record := model_to_dict_selective(member, include_relations=include_relations or None)).items():
            if v is not None and k in include_relations:
                updated_data = {f'{k}_{kin}': vin for kin, vin in v.items()}

        for k in include_relations:
            record.pop(k, None)

        record.update(updated_data)
        members_data.append(record)
    # Create CSV in memory
    output = io.StringIO()

    # Get column headers from first item
    fieldnames = members_data[0].keys()
    writer = csv.DictWriter(output, fieldnames=fieldnames)

    # Write header and rows
    writer.writeheader()
    writer.writerows(members_data)

    # Move to the beginning of the StringIO buffer
    output.seek(0)

    # Return as streaming response
    return StreamingResponse(
        iter([output.getvalue()]),
        media_type="text/csv",
        headers={
            "Content-Disposition": "attachment; filename=export_members.csv"
        }
    )


@router_member.get("/{member_id}", response_model=MemberResponse)
def get_member(member_id: int, db: Session = Depends(get_db)):
    """Get a specific member by ID"""
    member = db.query(Member).options(
        selectinload(Member.member_contracts),
        selectinload(Member.memberships),
        selectinload(Member.event_registrations),
        selectinload(Member.training_sessions),
        selectinload(Member.instructor_impersonation),
        selectinload(Member.shelf_rentals),
    ).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )
    return member


@router_member.put("/{member_id}", response_model=MemberResponse)
def update_member(
        member_id: int,
        member_update: MemberUpdate,
        db: Session = Depends(get_db)
):
    """Update a member"""
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )

    # Check if email is being updated and if it's already taken
    if member_update.email and member_update.email != member.email:
        existing = db.query(Member).filter(Member.email == member_update.email).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Email already registered"
            )

    update_data = member_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(member, field, value)

    db.commit()
    db.refresh(member)
    return member


@router_member.delete("/{member_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_member(member_id: int, db: Session = Depends(get_db)):
    """Delete a member"""
    member: Member | None
    if not (member := db.query(Member).filter(Member.id == member_id).first()):
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found"
        )

    if member.instructor_impersonation:
        member.instructor_impersonation.is_active = False
    member.is_deleted = True
    db.commit()

    return None
