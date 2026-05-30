from datetime import date, datetime

from pydantic import BaseModel, Field


class PublicMemberSummary(BaseModel):
    id: int
    first_name: str
    last_name: str


class PublicDeviceRequest(BaseModel):
    device_token: str | None = None


class PublicDeviceResponse(BaseModel):
    device_id: int
    device_token: str | None = None
    has_assigned_member: bool
    assigned_member: PublicMemberSummary | None = None


class PublicMemberSearchRecord(PublicMemberSummary):
    display_hint: str


class PublicMemberSearchResponse(BaseModel):
    records: list[PublicMemberSearchRecord]


class AssignPublicDeviceMemberRequest(BaseModel):
    member_id: int = Field(..., ge=1)


class PublicSessionAttendanceItem(BaseModel):
    session_id: int
    schedule_id: int
    training_form_name: str
    start_time: str
    end_time: str
    instructors: list[str]
    is_cancelled: bool
    attended: bool | None
    attendance_id: int | None
    source: str | None
    self_reported_at: datetime | None
    instructor_verified_at: datetime | None
    updated_at: datetime | None


class PublicAttendanceDay(BaseModel):
    date: date
    is_today: bool
    sessions: list[PublicSessionAttendanceItem]


class PublicAttendanceDaysResponse(BaseModel):
    member: PublicMemberSummary
    start_date: date
    end_date: date
    today: date
    days: list[PublicAttendanceDay]


class PublicAttendanceUpdateRequest(BaseModel):
    attended: bool


class PublicAttendanceUpdateResponse(BaseModel):
    attendance_id: int
    session_id: int
    member_id: int
    attended: bool
    source: str
    self_reported_at: datetime | None
    instructor_verified_at: datetime | None
