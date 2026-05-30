"""
Statistics and reporting schemas
"""
from datetime import date, datetime
from typing import Optional

from pydantic import BaseModel


class MemberStatistics(BaseModel):
    """Member statistics schema"""
    total_members: int
    active_members: int
    inactive_members: int
    average_age: Optional[float]
    new_members_this_month: int
    new_members_this_year: int


class FinancialSummary(BaseModel):
    """Financial summary schema"""
    total_revenue: float
    total_expenses: float
    net_profit: float
    membership_revenue: float
    event_revenue: float
    period_start: date
    period_end: date


class AttendanceStatistics(BaseModel):
    """Attendance statistics schema"""
    total_sessions: int
    total_attendances: int
    average_attendance_per_session: float
    most_popular_training_form: Optional[str]
    period_start: date
    period_end: date


class QuarterlyReport(BaseModel):
    """Quarterly report schema"""
    quarter: int
    year: int
    total_revenue: float
    total_expenses: float
    net_profit: float
    active_members: int
    total_sessions: int
    total_attendances: int


class MonthlyReport(BaseModel):
    """Monthly report schema"""
    month: int
    year: int
    total_revenue: float
    total_expenses: float
    net_profit: float
    active_members: int
    new_members: int
    total_sessions: int
    total_attendances: int


class YearlyReport(BaseModel):
    """Yearly report schema"""
    year: int
    total_revenue: float
    total_expenses: float
    net_profit: float
    active_members: int
    new_members: int
    total_sessions: int
    total_attendances: int
    average_monthly_revenue: float
    average_monthly_expenses: float


class CheckPointBase(BaseModel):
    date: date
    balance: float


class CheckPointFull(CheckPointBase):
    created_at: datetime
    updated_at: datetime | None

    class Config:
        from_attributes = True


class CheckPointList(BaseModel):
    total: int
    checkpoints: list[CheckPointFull]

class CheckPointEdit(BaseModel):
    balance: float