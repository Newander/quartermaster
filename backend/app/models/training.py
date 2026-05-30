"""
Training-related models - training forms, schedules, and attendance
"""
from datetime import datetime
from enum import Enum

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Time, Date, DateTime, Enum as SQLEnum, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class DayOfWeek(str, Enum):
    """Days of the week enum"""
    MONDAY = "monday"
    TUESDAY = "tuesday"
    WEDNESDAY = "wednesday"
    THURSDAY = "thursday"
    FRIDAY = "friday"
    SATURDAY = "saturday"
    SUNDAY = "sunday"


class ScheduleCycle(str, Enum):
    """ Schedule cycle enums - how much times per month """
    WEEKLY = "weekly"
    BI_WEEKLY = "bi-weekly"
    MONTHLY = "monthly"

    @property
    def week_num(self) -> int:
        """Return the number of weeks in the cycle"""
        return {self.WEEKLY: 1, self.BI_WEEKLY: 2, self.MONTHLY: 4}[self.value]


class AttendanceSource(str, Enum):
    INSTRUCTOR = "instructor"
    EXTERNAL_DEVICE = "external_device"


class TrainingForm(Base):
    """Training form model - e.g., Longsword, Rapier, etc."""
    __tablename__ = "training_form"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)  # e.g., "Longsword", "Rapier"
    description = Column(String(500), nullable=True)

    # Relationships
    schedules = relationship("Schedule", back_populates="training_form", cascade="all, delete-orphan")


class TrainingFormInstructor(Base):
    """ training form instructor model - many-to-many relationship """
    __tablename__ = "training_form_instructor_m2m"

    id = Column(Integer, primary_key=True, index=True)
    training_session_id = Column(Integer, ForeignKey("training_session.id"), nullable=False)
    instructor_id = Column(Integer, ForeignKey("instructor.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    notes = Column(String(200), nullable=True)


class TrainingSession(Base):
    """Training session model - specific instance of a scheduled training"""
    __tablename__ = "training_session"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedule.id"), nullable=True)
    session_date = Column(Date, nullable=False)
    notes = Column(String(3000), nullable=True)
    is_cancelled = Column(Boolean, default=False)

    # Relationships
    schedule = relationship("Schedule", back_populates="sessions")
    attendances = relationship("TrainingSessionAttendance", back_populates="session", cascade="all, delete-orphan")
    instructors = relationship("Instructor", secondary="training_form_instructor_m2m", back_populates="training_sessions")


class TrainingSessionAttendance(Base):
    """Attendance tracking for training sessions"""
    __tablename__ = "training_session_attendance_m2m"
    __table_args__ = (
        UniqueConstraint("session_id", "member_id", name="uq_training_session_attendance_session_member"),
    )

    id = Column(Integer, primary_key=True, index=True)
    session_id = Column(Integer, ForeignKey("training_session.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("member.id"), nullable=False)
    attended = Column(Boolean, default=True)
    notes = Column(String(200), nullable=True)
    source = Column(String(32), nullable=False, default=AttendanceSource.INSTRUCTOR.value)
    device_identity_id = Column(Integer, ForeignKey("public_device_identity.id"), nullable=True)
    self_reported_at = Column(DateTime, nullable=True)
    instructor_verified_at = Column(DateTime, nullable=True)

    # Relationships
    session = relationship("TrainingSession", back_populates="attendances")
    member = relationship("Member", back_populates="training_sessions")
    device_identity = relationship("PublicDeviceIdentity", back_populates="attendances")
    change_logs = relationship("AttendanceChangeLog", back_populates="attendance")


class ScheduleInstructor(Base):
    """ Schedule instructors """
    __tablename__ = "schedule_instructor_m2m"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedule.id"), nullable=False)
    instructor_id = Column(Integer, ForeignKey("instructor.id"), nullable=False)
    is_active = Column(Boolean, default=True)
    notes = Column(String(200), nullable=True)


class Schedule(Base):
    """Schedule model - bi/weekly/one-per-month recurring training sessions"""
    __tablename__ = "schedule"

    id = Column(Integer, primary_key=True, index=True)
    training_form_id = Column(Integer, ForeignKey("training_form.id"), nullable=False)
    season_id = Column(Integer, ForeignKey("season.id"), nullable=False)
    day_of_week = Column(SQLEnum(DayOfWeek), nullable=False)
    schedule_cycle = Column(SQLEnum(ScheduleCycle), nullable=False)
    start_time = Column(Time, nullable=False)
    end_time = Column(Time, nullable=False)
    max_participants = Column(Integer, nullable=True)
    is_deleted = Column(Boolean, default=False)

    # Relationships
    training_form = relationship("TrainingForm", back_populates="schedules")
    sessions = relationship("TrainingSession", back_populates="schedule", cascade="all, delete-orphan")
    seasons = relationship("Season", back_populates="schedules")
    instructors = relationship("Instructor", secondary="schedule_instructor_m2m", back_populates="schedules")


class Season(Base):
    __tablename__ = "season"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    is_finished = Column(Boolean, default=False)

    schedules = relationship("Schedule", back_populates="seasons")
    membership_plans = relationship("MembershipPlan", back_populates="season")


class TrainingZone(Base):
    """ Separating how many zones are at the hall """
    __tablename__ = "training_zone"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False)
    size = Column(String(500), nullable=False)
    description = Column(String(3000), nullable=True)
    is_available = Column(Boolean, default=True)


class ScheduleTrainingZone(Base):
    """ Schedule training zones """
    __tablename__ = "schedule_training_zone_m2m"

    id = Column(Integer, primary_key=True, index=True)
    schedule_id = Column(Integer, ForeignKey("schedule.id"), nullable=False)
    training_zone_id = Column(Integer, ForeignKey("training_zone.id"), nullable=False)


class PublicDeviceIdentity(Base):
    __tablename__ = "public_device_identity"

    id = Column(Integer, primary_key=True, index=True)
    token_hash = Column(String(64), nullable=False, unique=True, index=True)
    assigned_member_id = Column(Integer, ForeignKey("member.id"), nullable=True, index=True)
    last_seen_at = Column(DateTime, nullable=True)
    assignment_changed_at = Column(DateTime, nullable=True)
    is_active = Column(Boolean, nullable=False, default=True)
    notes = Column(String(3000), nullable=True)

    assigned_member = relationship("Member")
    attendances = relationship("TrainingSessionAttendance", back_populates="device_identity")
    change_logs = relationship("AttendanceChangeLog", back_populates="device_identity")


class AttendanceChangeLog(Base):
    __tablename__ = "attendance_change_log"

    id = Column(Integer, primary_key=True, index=True)
    attendance_id = Column(Integer, ForeignKey("training_session_attendance_m2m.id"), nullable=True, index=True)
    session_id = Column(Integer, ForeignKey("training_session.id"), nullable=False, index=True)
    member_id = Column(Integer, ForeignKey("member.id"), nullable=False, index=True)
    device_identity_id = Column(Integer, ForeignKey("public_device_identity.id"), nullable=True, index=True)
    changed_by = Column(String(32), nullable=False)
    previous_attended = Column(Boolean, nullable=True)
    new_attended = Column(Boolean, nullable=True)
    previous_notes = Column(String(200), nullable=True)
    new_notes = Column(String(200), nullable=True)
    changed_at = Column(DateTime, nullable=False, default=datetime.now, index=True)

    attendance = relationship("TrainingSessionAttendance", back_populates="change_logs")
    session = relationship("TrainingSession")
    member = relationship("Member")
    device_identity = relationship("PublicDeviceIdentity", back_populates="change_logs")
