"""
Shelf schemas for request/response validation
"""
from datetime import date
from typing import List, Optional

from pydantic import BaseModel, Field

from app.enums import ShelfStatus
from app.schemas.contract import ContractResponse
from app.schemas.membership import PaymentResponse


# ============================================
# Shelf Schemas
# ============================================

class ShelfBase(BaseModel):
    """Base shelf schema"""
    shelf_number: str = Field(..., min_length=1, max_length=50)
    rack_id: Optional[int] = Field(None, ge=1)
    # Backward-compatible input for old fixtures/API clients. It is resolved to rack_id by the API layer.
    location: Optional[str] = Field(None, max_length=250, exclude=True)
    size: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    is_deleted: Optional[bool] = False


class ShelfCreate(ShelfBase):
    """Schema for creating a shelf"""
    pass


class ShelfUpdate(BaseModel):
    """Schema for updating a shelf"""
    shelf_number: Optional[str] = Field(None, min_length=1, max_length=50)
    rack_id: Optional[int] = Field(None, ge=1)
    location: Optional[str] = Field(None, max_length=250, exclude=True)
    size: Optional[str] = Field(None, max_length=50)
    description: Optional[str] = None
    status: Optional[ShelfStatus] = None


class ShelfResponse(ShelfBase):
    """Schema for shelf response"""
    id: int
    rack_id: int
    status: ShelfStatus = 'available'

    class Config:
        from_attributes = True


class ShelfListResponse(BaseModel):
    """Schema for list of shelves"""
    total: int
    shelves: List[ShelfResponse]


class RackBase(BaseModel):
    name: str = Field(..., min_length=1, max_length=250)
    owner: Optional[str] = Field(None, max_length=250)
    is_deleted: Optional[bool] = False


class RackCreate(RackBase):
    pass


class RackUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=250)
    owner: Optional[str] = Field(None, max_length=250)
    is_deleted: Optional[bool] = None


class RackResponse(RackBase):
    id: int

    class Config:
        from_attributes = True


class RackListResponse(BaseModel):
    total: int
    records: List[RackResponse]


# ============================================
# Shelf Plan Schemas
# ============================================

class ShelfPlanBase(BaseModel):
    """Base shelf plan schema"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    price: float = Field(..., gt=0)
    duration_days: int = Field(..., gt=0)


class ShelfPlanCreate(ShelfPlanBase):
    """Schema for creating a shelf plan"""
    pass


class ShelfPlanUpdate(BaseModel):
    """Schema for updating a shelf plan"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    price: Optional[float] = Field(None, gt=0)
    duration_days: Optional[int] = Field(None, gt=0)


class ShelfPlanResponse(ShelfPlanBase):
    """Schema for shelf plan response"""
    id: int

    class Config:
        from_attributes = True


# ============================================
# Shelf Rental Schemas
# ============================================

class ShelfRentalBase(BaseModel):
    """Base shelf rental schema"""
    shelf_id: int = Field(..., ge=1)
    member_id: int = Field(..., ge=1)
    plan_id: int = Field(..., ge=1)
    start_date: date
    notes: Optional[str] = None


class ShelfRentalCreate(ShelfRentalBase):
    """Schema for creating a shelf rental"""
    payment_amount: float = Field(..., gt=0)
    payment_method: str = "transfer"  # cash, card, transfer, etc.


class ShelfRentalUpdate(BaseModel):
    """Schema for updating a shelf rental"""
    is_active: Optional[bool] = None
    notes: Optional[str] = None


class ShelfRentalResponse(BaseModel):
    """Schema for shelf rental response"""
    id: int
    shelf_id: int
    member_id: int
    plan_id: int
    payment_id: int
    start_date: date
    end_date: date
    is_active: bool
    notes: Optional[str] = None

    # Related data
    shelf: Optional[ShelfResponse] = None
    plan: Optional[ShelfPlanResponse] = None
    payment: Optional[PaymentResponse] = None
    contract: Optional[ContractResponse] = None

    class Config:
        from_attributes = True


class ShelfRentalListResponse(BaseModel):
    """Schema for list of shelf rentals"""
    total: int
    rentals: List[ShelfRentalResponse]
