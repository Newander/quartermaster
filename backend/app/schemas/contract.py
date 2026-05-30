"""
Contract schemas for request/response validation
"""
from datetime import date, datetime
from typing import Optional, List

from pydantic import BaseModel, Field


class ContractBase(BaseModel):
    """Base contract schema"""
    title: str = Field(..., min_length=1, max_length=150)
    description: Optional[str] = Field(None, max_length=1000)
    version: Optional[str] = Field(None, max_length=50)
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None


class ContractCreate(ContractBase):
    """Schema for creating a contract"""
    pass


class ContractUpdate(BaseModel):
    """Schema for updating a contract"""
    title: Optional[str] = Field(None, min_length=1, max_length=150)
    description: Optional[str] = Field(None, max_length=1000)
    version: Optional[str] = Field(None, max_length=50)
    effective_from: Optional[date] = None
    effective_to: Optional[date] = None


class ContractResponse(ContractBase):
    """Schema for contract response"""
    id: int
    created_at: datetime
    updated_at: datetime | None
    # Aggregated stats
    assigned_count: int = 0
    signed_count: int = 0
    is_active: bool

    class Config:
        from_attributes = True


class ContractListResponse(BaseModel):
    """Schema for list of contracts"""
    total: int
    contracts: List[ContractResponse]


class MemberContractBase(BaseModel):
    """Base member-contract schema"""
    contract_id: int = Field(..., ge=1)
    signed: bool = False
    signed_at: Optional[datetime] = None
    notes: Optional[str] = Field(None, max_length=3000)


class MemberContractCreate(MemberContractBase):
    """Schema for creating member-contract link"""
    pass


class MemberContractUpdate(BaseModel):
    """Schema for updating member-contract link"""
    signed: Optional[bool] = None
    signed_at: Optional[datetime] = None
    notes: Optional[str] = Field(None, max_length=3000)


class ContractSummary(BaseModel):
    """Summary schema for contract"""
    id: int
    title: str
    version: str | None = None

    class Config:
        from_attributes = True


class MemberContractResponse(BaseModel):
    """Schema for member-contract response"""
    id: int
    member_id: int
    contract_id: int
    signed: bool
    signed_at: datetime | None = None
    notes: str | None = None
    contract: ContractSummary
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True


class MemberContractListResponse(BaseModel):
    """Schema for list of member contracts"""
    total: int
    member_contracts: List[MemberContractResponse]
