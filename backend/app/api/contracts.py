"""
Contracts API endpoints
"""
from datetime import datetime
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session

from app.database import get_db
from app.models.contract import Contract, MemberContract
from app.models.hr import Member
from app.schemas.contract import (
    ContractCreate,
    ContractUpdate,
    ContractResponse,
    ContractListResponse,
    MemberContractCreate,
    MemberContractUpdate,
    MemberContractResponse,
    MemberContractListResponse,
)

router = APIRouter()


# ---------- Contracts CRUD ----------
@router.post("/", response_model=ContractResponse, status_code=status.HTTP_201_CREATED)
def create_contract(contract: ContractCreate, db: Session = Depends(get_db)):
    """Create a new contract"""
    # Title unique
    existing = db.query(Contract).filter(Contract.title == contract.title).first()
    if existing:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Contract with this title already exists")

    db_contract = Contract(**contract.model_dump())
    db.add(db_contract)
    db.commit()
    db.refresh(db_contract)
    return db_contract


@router.get("/", response_model=ContractListResponse)
def get_contracts(
        skip: int = 0,
        limit: int = 100,
        is_active: Optional[bool] = None,
        db: Session = Depends(get_db),
):
    """Get all contracts with optional filtering"""
    query = db.query(Contract)
    if is_active is not None:
        query = query.filter(Contract.is_active == is_active)
    
    total = query.count()
    contracts = query.offset(skip).limit(limit).all()
    return {"total": total, "contracts": contracts}


@router.get("/{contract_id}", response_model=ContractResponse)
def get_contract(contract_id: int, db: Session = Depends(get_db)):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")
    return contract


@router.put("/{contract_id}", response_model=ContractResponse)
def update_contract(contract_id: int, contract_update: ContractUpdate, db: Session = Depends(get_db)):
    contract = db.query(Contract).filter(Contract.id == contract_id).first()
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")

    # If title changes, ensure uniqueness
    if contract_update.title and contract_update.title != contract.title:
        existing = db.query(Contract).filter(Contract.title == contract_update.title).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST,
                                detail="Contract with this title already exists")

    update_data = contract_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(contract, field, value)

    db.commit()
    db.refresh(contract)
    return contract


# ---------- Member contracts (signatures) ----------
@router.get("/member/{member_id}/contract", response_model=MemberContractListResponse)
def get_member_contracts(member_id: int, db: Session = Depends(get_db)):
    """Get contracts linked to a member (signed status records)"""
    from sqlalchemy.orm import selectinload
    
    # Ensure member exists
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    query = db.query(MemberContract).options(
        selectinload(MemberContract.contract)
    ).filter(MemberContract.member_id == member_id)
    
    total = query.count()
    member_contracts = query.all()
    return {"total": total, "member_contracts": member_contracts}


@router.post("/member/{member_id}/contract", response_model=MemberContractResponse,
             status_code=status.HTTP_201_CREATED)
def add_member_contract(member_id: int, payload: MemberContractCreate, db: Session = Depends(get_db)):
    """Create or update a member's contract link"""
    # Ensure member exists
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    # Ensure contract exists
    contract = db.query(Contract).filter(Contract.id == payload.contract_id).first()
    if not contract:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Contract not found")

    # Upsert by unique (member_id, contract_id)
    link = (
        db.query(MemberContract)
        .filter(MemberContract.member_id == member_id, MemberContract.contract_id == payload.contract_id)
        .first()
    )

    if link:
        # Update existing
        link.signed = payload.signed
        link.signed_at = payload.signed_at or (
            datetime.now() if payload.signed and not link.signed_at else link.signed_at)
        link.notes = payload.notes
    else:
        link = MemberContract(
            member_id=member_id,
            contract_id=payload.contract_id,
            signed=payload.signed,
            signed_at=payload.signed_at or (datetime.now() if payload.signed else None),
            notes=payload.notes,
        )
        db.add(link)

    db.commit()
    db.refresh(link)
    return link


@router.put("/member/{member_id}/contract/{member_contract_id}", response_model=MemberContractResponse)
def update_member_contract(member_id: int, member_contract_id: int, payload: MemberContractUpdate,
                           db: Session = Depends(get_db)):
    # Ensure member exists
    member = db.query(Member).filter(Member.id == member_id).first()
    if not member:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member not found")

    link = (
        db.query(MemberContract)
        .filter(MemberContract.id == member_contract_id, MemberContract.member_id == member_id)
        .first()
    )
    if not link:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Member contract link not found")

    update_data = payload.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(link, field, value)

    # Auto set signed_at if signed just turned true and no timestamp provided
    if "signed" in update_data and link.signed and link.signed_at is None:
        link.signed_at = datetime.now()

    db.commit()
    db.refresh(link)
    return link
