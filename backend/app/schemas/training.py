"""
Training schemas for request/response validation
"""
from datetime import datetime, date, time
from typing import Optional, List

from pydantic import BaseModel, Field

from app.models.training import DayOfWeek, ScheduleCycle


class TrainingFormBase(BaseModel):
    """Base training form schema"""
    name: str = Field(..., min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class TrainingFormCreate(TrainingFormBase):
    """Schema for creating a training form"""
    pass


class TrainingFormUpdate(BaseModel):
    """Schema for updating a training form"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    description: Optional[str] = Field(None, max_length=500)


class TrainingFormResponse(TrainingFormBase):
    """Schema for training form response"""
    id: int
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True


class TrainingFormListResponse(BaseModel):
    """Schema for list of training forms"""
    total: int
    forms: List[TrainingFormResponse]


class ScheduleBase(BaseModel):
    """Base schedule schema"""
    training_form_id: int = Field(..., ge=1)
    season_id: int = Field(..., ge=1)
    day_of_week: DayOfWeek
    schedule_cycle: ScheduleCycle
    start_time: time
    end_time: time
    max_participants: Optional[int] = Field(None, gt=0)


class ScheduleCreate(ScheduleBase):
    """Schema for creating a schedule"""
    pass


class ScheduleUpdate(BaseModel):
    """Schema for updating a schedule"""
    training_form_id: Optional[int] = Field(None, ge=1)
    season_id: Optional[int] = Field(None, ge=1)
    day_of_week: Optional[DayOfWeek] = None
    schedule_cycle: Optional[ScheduleCycle] = None
    start_time: Optional[time] = None
    end_time: Optional[time] = None
    max_participants: Optional[int] = Field(None, gt=0)
    is_deleted: Optional[bool] = None


class TrainingFormSummary(BaseModel):
    """Summary schema for training form"""
    id: int
    name: str

    class Config:
        from_attributes = True


class SeasonSummary(BaseModel):
    """Summary schema for season"""
    id: int
    name: str
    start_date: date
    end_date: date

    class Config:
        from_attributes = True


class ScheduleResponse(ScheduleBase):
    """Schema for schedule response"""
    id: int
    is_deleted: bool
    training_form: TrainingFormSummary
    seasons: SeasonSummary
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True


class ScheduleListResponse(BaseModel):
    """Schema for list of schedules"""
    total: int
    schedules: List[ScheduleResponse]


class TrainingSessionBase(BaseModel):
    """Base training session schema"""
    schedule_id: Optional[int] = Field(None, ge=1)
    session_date: date
    notes: Optional[str] = Field(None, max_length=3000)


class TrainingSessionCreate(TrainingSessionBase):
    """Schema for creating a training session"""
    pass


class TrainingSessionUpdate(BaseModel):
    """Schema for updating a training session"""
    notes: Optional[str] = Field(None, max_length=3000)
    is_cancelled: Optional[bool] = None


class ScheduleSummary(BaseModel):
    """Summary schema for schedule"""
    id: int
    day_of_week: str
    start_time: time
    end_time: time

    class Config:
        from_attributes = True


class TrainingSessionResponse(TrainingSessionBase):
    """Schema for training session response"""
    id: int
    is_cancelled: bool
    schedule: ScheduleSummary | None = None
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True


class TrainingSessionListResponse(BaseModel):
    """Schema for list of training sessions"""
    total: int
    sessions: List[TrainingSessionResponse]


class AttendanceBase(BaseModel):
    """Base attendance schema"""
    session_id: int = Field(..., ge=1)
    member_id: int = Field(..., ge=1)
    attended: bool = True
    notes: Optional[str] = Field(None, max_length=200)


class AttendanceCreate(AttendanceBase):
    """Schema for creating attendance record"""
    pass


class MemberSummaryShort(BaseModel):
    """Short summary schema for member"""
    id: int
    first_name: str
    last_name: str

    class Config:
        from_attributes = True


class AttendanceResponse(AttendanceBase):
    """Schema for attendance response"""
    id: int
    member: MemberSummaryShort
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True


class AttendanceListResponse(BaseModel):
    """Schema for list of attendance records"""
    total: int
    attendances: List[AttendanceResponse]


# Season schemas
class SeasonBase(BaseModel):
    """Base season schema"""
    name: str = Field(..., min_length=1, max_length=100)
    start_date: date
    end_date: date


class SeasonCreate(SeasonBase):
    """Schema for creating a season"""
    pass


class SeasonUpdate(BaseModel):
    """Schema for updating a season"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    is_finished: Optional[bool] = None


class SeasonResponse(SeasonBase):
    """Schema for season response"""
    id: int
    is_finished: bool

    class Config:
        from_attributes = True


class SeasonListResponse(BaseModel):
    """Schema for list of seasons"""
    total: int
    seasons: List[SeasonResponse]


# TrainingZone schemas
class TrainingZoneBase(BaseModel):
    """Base training zone schema"""
    name: str = Field(..., min_length=1, max_length=100)
    size: str = Field(..., max_length=500)
    description: Optional[str] = Field(None, max_length=3000)


class TrainingZoneCreate(TrainingZoneBase):
    """Schema for creating a training zone"""
    pass


class TrainingZoneUpdate(BaseModel):
    """Schema for updating a training zone"""
    name: Optional[str] = Field(None, min_length=1, max_length=100)
    size: Optional[str] = Field(None, max_length=500)
    description: Optional[str] = Field(None, max_length=3000)
    is_available: Optional[bool] = None


class TrainingZoneResponse(TrainingZoneBase):
    """Schema for training zone response"""
    id: int
    is_available: bool

    class Config:
        from_attributes = True


class TrainingZoneListResponse(BaseModel):
    """Schema for list of training zones"""
    total: int
    zones: List[TrainingZoneResponse]
