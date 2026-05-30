"""
Event and expense schemas for request/response validation
"""
from datetime import datetime, date
from typing import Optional, List

from pydantic import BaseModel, Field
from app.enums import PaymentStatus


class EventBase(BaseModel):
    """Base event schema"""
    name: str = Field(..., min_length=1, max_length=200)
    description: Optional[str] = None
    registration_start_date: Optional[date] = None
    event_date: date
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    location: Optional[str] = Field(None, max_length=200)
    max_participants: Optional[int] = Field(None, gt=0)
    price: float = Field(default=0.0, ge=0)


class EventCreate(EventBase):
    """Schema for creating an event"""
    pass


class EventUpdate(BaseModel):
    """Schema for updating an event"""
    name: Optional[str] = Field(None, min_length=1, max_length=200)
    description: Optional[str] = None
    registration_start_date: Optional[date] = None
    event_date: Optional[date] = None
    start_time: Optional[datetime] = None
    end_time: Optional[datetime] = None
    location: Optional[str] = Field(None, max_length=200)
    max_participants: Optional[int] = Field(None, gt=0)
    price: Optional[float] = Field(None, ge=0)
    is_closed: Optional[bool] = None


class EventRegistrationSummaryShort(BaseModel):
    """Short summary for event registrations"""
    id: int
    member_id: int | None = None
    registration_date: datetime
    discount: float

    class Config:
        from_attributes = True


class EventExpenseSummary(BaseModel):
    """Summary for event expenses"""
    id: int
    description: str
    amount: float
    expense_date: date

    class Config:
        from_attributes = True


class EventResponse(EventBase):
    """Schema for event response"""
    id: int
    is_closed: bool
    registrations: List[EventRegistrationSummaryShort] = Field(default_factory=list)
    expenses: List[EventExpenseSummary] = Field(default_factory=list)
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True


class EventListResponse(BaseModel):
    """Schema for list of events"""
    total: int
    events: List[EventResponse]


class EventRegistrationBase(BaseModel):
    """Base event registration schema"""
    event_id: int = Field(..., ge=1)
    member_id: Optional[int] = Field(None, ge=1)
    payment_id: Optional[int] = Field(None, ge=1)
    discount: float = Field(default=0.0, ge=0)
    notes: Optional[str] = Field(None, max_length=3000)


class EventRegistrationCreate(EventRegistrationBase):
    """Schema for creating event registration"""
    pass


class EventRegistrationUpdate(BaseModel):
    """Schema for updating event registration"""
    member_id: Optional[int] = Field(None, ge=1)
    payment_id: Optional[int] = Field(None, ge=1)
    discount: Optional[float] = Field(None, ge=0)
    notes: Optional[str] = Field(None, max_length=3000)


class MemberSummaryShort(BaseModel):
    """Short summary schema for member"""
    id: int
    first_name: str
    last_name: str
    email: str

    class Config:
        from_attributes = True


class PaymentSummary(BaseModel):
    """Summary schema for payment"""
    id: int
    amount: float
    payment_date: date
    status: PaymentStatus

    class Config:
        from_attributes = True


class EventSummary(BaseModel):
    """Summary schema for event"""
    id: int
    name: str
    event_date: date
    price: float

    class Config:
        from_attributes = True


class EventRegistrationResponse(EventRegistrationBase):
    """Schema for event registration response"""
    id: int
    registration_date: datetime
    event: EventSummary
    member: MemberSummaryShort | None = None
    payment: PaymentSummary | None = None
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True


class EventRegistrationListResponse(BaseModel):
    """Schema for list of event registrations"""
    total: int
    registrations: List[EventRegistrationResponse]


class EventExpenseBase(BaseModel):
    """Base event expense schema"""
    event_id: int = Field(..., ge=1)
    description: str = Field(..., min_length=1, max_length=200)
    amount: float = Field(..., gt=0)
    expense_date: date
    notes: Optional[str] = Field(None, max_length=3000)


class EventExpenseCreate(EventExpenseBase):
    """Schema for creating event expense"""
    pass


class EventExpenseUpdate(BaseModel):
    """Schema for updating event expense"""
    description: Optional[str] = Field(None, min_length=1, max_length=200)
    amount: Optional[float] = Field(None, gt=0)
    expense_date: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=3000)


class EventExpenseResponse(EventExpenseBase):
    """Schema for event expense response"""
    id: int
    event: EventSummary
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True


class EventExpenseListResponse(BaseModel):
    """Schema for list of event expenses"""
    total: int
    expenses: List[EventExpenseResponse]


class ExpenseBase(BaseModel):
    """Base expense schema (monthly/general expenses)"""
    category_id: int = Field(..., ge=1)
    description: str = Field(..., min_length=1, max_length=5000)
    amount: float = Field(..., gt=0)
    expense_date: date
    is_recurring: bool = False
    notes: Optional[str] = Field(None, max_length=3000)


class ExpenseCreate(ExpenseBase):
    """Schema for creating expense"""
    pass


class ExpenseUpdate(BaseModel):
    """Schema for updating expense"""
    category_id: Optional[int] = Field(None, ge=1)
    description: Optional[str] = Field(None, min_length=1, max_length=5000)
    amount: Optional[float] = Field(None, gt=0)
    expense_date: Optional[date] = None
    is_recurring: Optional[bool] = None
    status: Optional[PaymentStatus] = None
    notes: Optional[str] = Field(None, max_length=3000)


class CategorySummary(BaseModel):
    """Summary schema for money category"""
    id: int
    name: str

    class Config:
        from_attributes = True


class ExpenseResponse(ExpenseBase):
    """Schema for expense response"""
    id: int
    status: PaymentStatus
    category: CategorySummary
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True


class ExpenseListResponse(BaseModel):
    """Schema for list of expenses"""
    total: int
    expenses: List[ExpenseResponse]
