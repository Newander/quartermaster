"""
Member schemas for request/response validation
"""
from datetime import date
from datetime import datetime
from typing import List
from typing import Optional

from pydantic import BaseModel, EmailStr, Field

from app.schemas.contract import MemberContractResponse


class InstructorShort(BaseModel):
    id: int
    specialization: str | None = None
    is_active: bool

    class Config:
        from_attributes = True


class MembershipPaymentSummary(BaseModel):
    id: int
    plan_id: int
    payment_id: int

    class Config:
        from_attributes = True


class EventRegistrationSummary(BaseModel):
    id: int
    event_id: int
    payment_id: int | None = None
    registration_date: datetime
    discount: float
    notes: str | None = None

    class Config:
        from_attributes = True


class TrainingSessionAttendanceSummary(BaseModel):
    id: int
    session_id: int
    attended: bool
    notes: str | None = None

    class Config:
        from_attributes = True


class MemberBase(BaseModel):
    """Base member schema"""
    first_name: str = Field(..., min_length=1, max_length=100)
    last_name: str = Field(..., min_length=1, max_length=100)
    email: EmailStr
    phone: Optional[str] = Field(None, max_length=20)
    date_of_birth: Optional[date] = None
    notes: Optional[str] = Field(None, max_length=3000)


class MemberCreate(MemberBase):
    """Schema for creating a member"""
    pass


class MemberUpdate(BaseModel):
    """Schema for updating a member"""
    first_name: Optional[str] = Field(None, min_length=1, max_length=100)
    last_name: Optional[str] = Field(None, min_length=1, max_length=100)
    email: Optional[EmailStr] = None
    phone: Optional[str] = Field(None, max_length=20)
    date_of_birth: Optional[date] = None
    is_deleted: Optional[bool] = None
    notes: Optional[str] = Field(None, max_length=3000)


class MemberResponse(MemberBase):
    """Schema for member response"""
    id: int
    registration_date: date
    created_at: datetime
    updated_at: datetime | None = None
    # Assigned contracts for this member
    member_contracts: List[MemberContractResponse] = Field(default_factory=list)
    # Related data
    memberships: List[MembershipPaymentSummary] = Field(default_factory=list)
    event_registrations: List[EventRegistrationSummary] = Field(default_factory=list)
    training_sessions: List[TrainingSessionAttendanceSummary] = Field(default_factory=list)
    instructor_impersonation: InstructorShort | None = None
    shelf_rentals: List['ShelfRentalSummary'] = Field(default_factory=list)

    class Config:
        from_attributes = True


class MemberListResponse(BaseModel):
    """Schema for list of members"""
    total: int
    members: list[MemberResponse]


class InstructorBase(BaseModel):
    """Base instructor schema aligned with Instructor model"""
    member_id: int = Field(..., ge=1)
    specialization: str = Field(..., max_length=200)
    bio: Optional[str] = None


class InstructorCreate(InstructorBase):
    """Schema for creating an instructor"""
    hire_date: Optional[datetime] = None


class InstructorUpdate(BaseModel):
    """Schema for updating an instructor"""
    specialization: Optional[str] = Field(None, max_length=200)
    bio: Optional[str] = None
    is_active: Optional[bool] = None
    hire_date: Optional[datetime] = None


class ScheduleSummary(BaseModel):
    id: int
    training_form_id: int
    day_of_week: str
    start_time: datetime | str | None = None
    end_time: datetime | str | None = None

    class Config:
        from_attributes = True


class TrainingSessionSummary(BaseModel):
    id: int
    schedule_id: int | None = None
    session_date: date
    is_cancelled: bool

    class Config:
        from_attributes = True


class MemberSummary(BaseModel):
    """Summary schema for member details"""
    id: int
    first_name: str
    last_name: str
    email: str
    phone: str | None = None

    class Config:
        from_attributes = True


class InstructorResponse(InstructorBase):
    """Schema for instructor response"""
    id: int
    is_active: bool
    hire_date: datetime
    created_at: datetime
    updated_at: datetime | None
    # Related data
    member: MemberSummary
    schedules: List[ScheduleSummary] = Field(default_factory=list)
    training_sessions: List[TrainingSessionSummary] = Field(default_factory=list)

    class Config:
        from_attributes = True


class InstructorListResponse(BaseModel):
    """Schema for list of instructors"""
    total: int
    instructors: list[InstructorResponse]

class ShelfRentalSummary(BaseModel):
    id: int
    shelf_id: int
    plan_id: int
    start_date: date
    end_date: date
    is_active: bool

    class Config:
        from_attributes = True


class PermissionBase(BaseModel):
    name: str
    description: str | None = None


class PermissionCreate(PermissionBase):
    pass


class PermissionResponse(PermissionBase):
    id: int

    class Config:
        from_attributes = True


class RoleBase(BaseModel):
    name: str
    description: str | None = None


class RoleCreate(RoleBase):
    pass


class RoleResponse(RoleBase):
    id: int
    permissions: list[PermissionResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class UserBase(BaseModel):
    username: str
    email: EmailStr
    is_active: bool = True
    member_id: int | None = None


class UserCreate(UserBase):
    password: str
    role_id: int | None = None


class UserUpdate(BaseModel):
    username: str | None = None
    email: EmailStr | None = None
    password: str | None = None
    is_active: bool | None = None
    member_id: int | None = None
    role_id: int | None = None


class RefreshTokenSessionResponse(BaseModel):
    id: int
    user_id: int
    jti: str
    expires_at: datetime
    revoked_at: datetime | None = None
    replaced_by_jti: str | None = None

    class Config:
        from_attributes = True


class UserResponse(UserBase):
    id: int
    roles: list[RoleResponse] = Field(default_factory=list)
    permissions: list[PermissionResponse] = Field(default_factory=list)
    refresh_sessions: list[RefreshTokenSessionResponse] = Field(default_factory=list)

    class Config:
        from_attributes = True


class Token(BaseModel):
    access_token: str
    refresh_token: str | None = None
    token_type: str


class TokenData(BaseModel):
    username: str


class RefreshTokenRequest(BaseModel):
    refresh_token: str
