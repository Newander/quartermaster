"""
Membership and payment schemas for request/response validation
"""
from datetime import datetime, date
from typing import Optional, List

from pydantic import BaseModel, Field

from app.enums import PaymentStatus, PaymentMethod, MembershipType


class MembershipPlanBase(BaseModel):
    """Base membership plan schema"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    membership_type: MembershipType
    price: float = Field(..., gt=0)
    duration_days: Optional[int] = Field(None, gt=0)
    visit_count: Optional[int] = Field(None, gt=0)
    season_id: int = Field(..., ge=1)


class MembershipPlanCreate(MembershipPlanBase):
    """Schema for creating a membership plan"""
    pass


class MembershipPlanUpdate(BaseModel):
    """Schema for updating a membership plan"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)
    membership_type: Optional[MembershipType] = None
    price: Optional[float] = Field(None, gt=0)
    duration_days: Optional[int] = Field(None, gt=0)
    visit_count: Optional[int] = Field(None, gt=0)
    season_id: Optional[int] = Field(None, ge=1)
    is_deleted: Optional[bool] = None


class SeasonSummary(BaseModel):
    """Summary schema for season"""
    id: int
    name: str
    start_date: date
    end_date: date

    class Config:
        from_attributes = True


class MembershipPlanResponse(MembershipPlanBase):
    """Schema for membership plan response"""
    id: int
    is_deleted: bool
    season: SeasonSummary
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True


class MembershipPlanListResponse(BaseModel):
    """Schema for list of membership plans"""
    total: int
    plans: List[MembershipPlanResponse]


class PaymentSummary(BaseModel):
    """Summary schema for payment"""
    id: int
    amount: float
    payment_date: date
    payment_method: PaymentMethod | None = None
    status: PaymentStatus

    class Config:
        from_attributes = True


class MemberSummaryShort(BaseModel):
    """Short summary schema for member"""
    id: int
    first_name: str
    last_name: str
    email: str

    class Config:
        from_attributes = True


class MembershipPaymentBase(BaseModel):
    """Base membership payment schema"""
    member_id: int = Field(..., ge=1)
    plan_id: int = Field(..., ge=1)
    payment_id: int = Field(..., ge=1)


class MembershipPaymentCreate(MembershipPaymentBase):
    """Schema for creating a membership payment"""
    pass


class MembershipPaymentUpdate(BaseModel):
    """Schema for updating a membership payment - limited fields"""
    payment_id: Optional[int] = Field(None, ge=1)


class MembershipPaymentResponse(MembershipPaymentBase):
    """Schema for membership payment response"""
    id: int
    member: MemberSummaryShort
    plan: MembershipPlanResponse
    payment: PaymentSummary
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True


class MembershipPaymentListResponse(BaseModel):
    """Schema for list of membership payments"""
    total: int
    memberships: List[MembershipPaymentResponse]


class PaymentBase(BaseModel):
    """Base payment schema"""
    category_id: int = Field(..., ge=1)
    description: str = Field(..., min_length=1, max_length=5000)
    amount: float = Field(..., gt=0)
    payment_date: date
    is_recurring: bool = False
    payment_method: Optional[PaymentMethod] = PaymentMethod.TRANSFER
    notes: Optional[str] = Field(None, max_length=3000)


class PaymentCreate(PaymentBase):
    """Schema for creating a payment"""
    pass


class PaymentUpdate(BaseModel):
    """Schema for updating a payment"""
    category_id: Optional[int] = Field(None, ge=1)
    description: Optional[str] = Field(None, min_length=1, max_length=5000)
    amount: Optional[float] = Field(None, gt=0)
    payment_date: Optional[date] = None
    is_recurring: Optional[bool] = None
    payment_method: Optional[PaymentMethod] = None
    status: Optional[PaymentStatus] = None
    notes: Optional[str] = Field(None, max_length=3000)


class CategorySummary(BaseModel):
    """Summary schema for money category"""
    id: int
    name: str

    class Config:
        from_attributes = True


class PaymentResponse(PaymentBase):
    """Schema for payment response"""
    id: int
    status: PaymentStatus
    category: CategorySummary
    created_at: datetime
    updated_at: datetime | None
    member_id: int | None = None
    shelf_id: int | None = None

    class Config:
        from_attributes = True


class PaymentListResponse(BaseModel):
    """Schema for list of payments"""
    total: int
    payments: List[PaymentResponse]


# MoneyCategory schemas
class MoneyCategoryBase(BaseModel):
    """Base money category schema"""
    name: str = Field(..., min_length=1, max_length=100)


class MoneyCategoryCreate(MoneyCategoryBase):
    """Schema for creating a money category"""
    pass


class MoneyCategoryUpdate(BaseModel):
    """Schema for updating a money category"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)


class MoneyCategoryResponse(MoneyCategoryBase):
    """Schema for money category response"""
    id: int

    class Config:
        from_attributes = True


class MoneyCategoryListResponse(BaseModel):
    """Schema for list of money categories"""
    total: int
    categories: List[MoneyCategoryResponse]
