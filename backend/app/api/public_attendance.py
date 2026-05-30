import hashlib
import secrets
from datetime import date, datetime, timedelta
from typing import Annotated

from fastapi import APIRouter, Depends, Header, HTTPException, Query, status
from sqlalchemy import or_
from sqlalchemy.orm import Session, selectinload

from app.auth.dependancies import admin_dep, instructor_get_dep, is_member_dep
from app.common.route_generator import RouteAlchemyManager, custom_filter
from app.database import dep_get_session
from app.db_schemas import RelationLookupOut
from app.models import (
    AttendanceChangeLog,
    AttendanceSource,
    DayOfWeek,
    Instructor,
    Member,
    PublicDeviceIdentity,
    Schedule,
    ScheduleCycle,
    Season,
    TrainingSession,
    TrainingSessionAttendance,
)
from app.schemas.public_attendance import (
    AssignPublicDeviceMemberRequest,
    PublicAttendanceDaysResponse,
    PublicAttendanceDay,
    PublicAttendanceUpdateRequest,
    PublicAttendanceUpdateResponse,
    PublicDeviceRequest,
    PublicDeviceResponse,
    PublicMemberSearchRecord,
    PublicMemberSearchResponse,
    PublicMemberSummary,
    PublicSessionAttendanceItem,
)

PUBLIC_DEVICE_TOKEN_HEADER = "X-Public-Device-Token"
PUBLIC_ATTENDANCE_WINDOW_DAYS = 7

public_router = APIRouter()
internal_router = APIRouter()


def _hash_device_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _new_device_token() -> str:
    return secrets.token_urlsafe(32)


def _member_summary(member: Member | None) -> PublicMemberSummary | None:
    if member is None:
        return None
    return PublicMemberSummary(
        id=member.id,
        first_name=member.first_name,
        last_name=member.last_name,
    )


def _device_response(
    device: PublicDeviceIdentity,
    *,
    raw_token: str | None = None,
) -> PublicDeviceResponse:
    assigned_member = _member_summary(device.assigned_member)
    return PublicDeviceResponse(
        device_id=device.id,
        device_token=raw_token,
        has_assigned_member=assigned_member is not None,
        assigned_member=assigned_member,
    )


def _get_public_device(
    session: Annotated[Session, Depends(dep_get_session)],
    device_token: Annotated[str | None, Header(alias=PUBLIC_DEVICE_TOKEN_HEADER)] = None,
) -> PublicDeviceIdentity:
    if not device_token:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Missing public device token.",
        )

    device = (
        session.query(PublicDeviceIdentity)
        .options(selectinload(PublicDeviceIdentity.assigned_member))
        .filter(
            PublicDeviceIdentity.token_hash == _hash_device_token(device_token),
            PublicDeviceIdentity.is_active.is_(True),
        )
        .first()
    )
    if not device:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid public device token.",
        )

    device.last_seen_at = datetime.now()
    return device


def _get_assigned_public_device(
    device: Annotated[PublicDeviceIdentity, Depends(_get_public_device)],
) -> PublicDeviceIdentity:
    if device.assigned_member_id is None or device.assigned_member is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "member_not_assigned",
                "message": "Public device has no assigned member.",
            },
        )
    return device


def _schedule_cycle_weeks(cycle: ScheduleCycle | str) -> int:
    return cycle.week_num if isinstance(cycle, ScheduleCycle) else ScheduleCycle(cycle).week_num


def _schedule_occurrences_in_range(
    schedule: Schedule,
    start_date: date,
    end_date: date,
) -> list[date]:
    if schedule.seasons is None:
        return []

    overlap_start = max(start_date, schedule.seasons.start_date)
    overlap_end = min(end_date, schedule.seasons.end_date)
    if overlap_start > overlap_end:
        return []

    target_weekday = DayOfWeek.coerce(schedule.day_of_week)
    first_date = target_weekday.first_on_or_after(overlap_start)
    if first_date > overlap_end:
        return []

    cycle_weeks = _schedule_cycle_weeks(schedule.schedule_cycle)
    occurrences: list[date] = []
    current_date = first_date
    while current_date <= overlap_end:
        week_offset = DayOfWeek.week_offset_from_anchor(
            target_date=current_date,
            anchor_date=schedule.seasons.start_date,
        )
        if week_offset % cycle_weeks == 0:
            occurrences.append(current_date)
        current_date += timedelta(days=7)

    return occurrences


def _ensure_training_sessions(
    session: Session,
    start_date: date,
    end_date: date,
) -> None:
    schedules = (
        session.query(Schedule)
        .join(Schedule.seasons)
        .options(selectinload(Schedule.seasons))
        .filter(
            Schedule.is_deleted.is_(False),
            Season.start_date <= end_date,
            Season.end_date >= start_date,
        )
        .all()
    )
    if not schedules:
        return

    schedule_ids = [schedule.id for schedule in schedules]
    existing_sessions = (
        session.query(TrainingSession)
        .filter(
            TrainingSession.schedule_id.in_(schedule_ids),
            TrainingSession.session_date >= start_date,
            TrainingSession.session_date <= end_date,
        )
        .all()
    )
    existing_schedule_dates = {
        (training_session.schedule_id, training_session.session_date)
        for training_session in existing_sessions
    }

    created_sessions: list[TrainingSession] = []
    for schedule in schedules:
        for occurrence_date in _schedule_occurrences_in_range(schedule, start_date, end_date):
            schedule_date_key = (schedule.id, occurrence_date)
            if schedule_date_key in existing_schedule_dates:
                continue

            created_sessions.append(
                TrainingSession(
                    schedule_id=schedule.id,
                    session_date=occurrence_date,
                )
            )
            existing_schedule_dates.add(schedule_date_key)

    if created_sessions:
        session.add_all(created_sessions)
        session.flush()


def _validate_public_window(target_date: date) -> tuple[date, date, date]:
    today = date.today()
    start_date = today - timedelta(days=PUBLIC_ATTENDANCE_WINDOW_DAYS)
    if target_date < start_date or target_date > today:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Session is outside the public attendance edit window.",
        )
    return start_date, today, today


@public_router.post("/device", response_model=PublicDeviceResponse)
def create_or_restore_device(
    payload: PublicDeviceRequest | None = None,
    session: Session = Depends(dep_get_session),
) -> PublicDeviceResponse:
    raw_token = payload.device_token if payload else None
    if raw_token:
        device = (
            session.query(PublicDeviceIdentity)
            .options(selectinload(PublicDeviceIdentity.assigned_member))
            .filter(PublicDeviceIdentity.token_hash == _hash_device_token(raw_token))
            .first()
        )
        if device and device.is_active:
            device.last_seen_at = datetime.now()
            return _device_response(device)

    new_token = _new_device_token()
    device = PublicDeviceIdentity(
        token_hash=_hash_device_token(new_token),
        last_seen_at=datetime.now(),
        is_active=True,
    )
    session.add(device)
    session.flush()
    return _device_response(device, raw_token=new_token)


@public_router.get("/member-search", response_model=PublicMemberSearchResponse, dependencies=[Depends(is_member_dep)])
def search_public_members(
    q: Annotated[str, Query(min_length=1)],
    session: Session = Depends(dep_get_session),
) -> PublicMemberSearchResponse:
    normalized_query = q.strip()
    search_pattern = f"%{normalized_query}%"
    members = (
        session.query(Member)
        .filter(
            Member.is_deleted.is_(False),
            or_(
                Member.first_name.ilike(search_pattern),
                Member.last_name.ilike(search_pattern),
            ),
        )
        .order_by(Member.last_name.asc(), Member.first_name.asc(), Member.id.asc())
        .limit(10)
        .all()
    )

    return PublicMemberSearchResponse(
        records=[
            PublicMemberSearchRecord(
                id=member.id,
                first_name=member.first_name,
                last_name=member.last_name,
                display_hint=f"{member.first_name} {member.last_name}".strip(),
            )
            for member in members
        ]
    )


@public_router.put("/device/assigned-member", response_model=PublicDeviceResponse)
def assign_public_device_member(
    payload: AssignPublicDeviceMemberRequest,
    device: Annotated[PublicDeviceIdentity, Depends(_get_public_device)],
    session: Session = Depends(dep_get_session),
) -> PublicDeviceResponse:
    member = (
        session.query(Member)
        .filter(Member.id == payload.member_id, Member.is_deleted.is_(False))
        .first()
    )
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Member not found.",
        )

    device.assigned_member_id = member.id
    device.assigned_member = member
    device.assignment_changed_at = datetime.now()
    session.flush()
    return _device_response(device)


@public_router.delete("/device/assigned-member", response_model=PublicDeviceResponse)
def remove_public_device_member(
    device: Annotated[PublicDeviceIdentity, Depends(_get_public_device)],
) -> PublicDeviceResponse:
    device.assigned_member_id = None
    device.assigned_member = None
    device.assignment_changed_at = datetime.now()
    return _device_response(device)


@public_router.get("/days", response_model=PublicAttendanceDaysResponse)
def get_public_attendance_days(
    device: Annotated[PublicDeviceIdentity, Depends(_get_assigned_public_device)],
    session: Session = Depends(dep_get_session),
    start_date: date | None = None,
    end_date: date | None = None,
) -> PublicAttendanceDaysResponse:
    today = date.today()
    window_start = today - timedelta(days=PUBLIC_ATTENDANCE_WINDOW_DAYS)
    resolved_start = start_date or window_start
    resolved_end = end_date or today

    if resolved_start < window_start or resolved_end > today or resolved_end < resolved_start:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Requested dates are outside the public attendance window.",
        )

    _ensure_training_sessions(session, resolved_start, resolved_end)

    sessions = (
        session.query(TrainingSession)
        .options(
            selectinload(TrainingSession.schedule).selectinload(Schedule.training_form),
            selectinload(TrainingSession.schedule)
            .selectinload(Schedule.instructors)
            .selectinload(Instructor.member),
        )
        .join(TrainingSession.schedule)
        .filter(
            TrainingSession.session_date >= resolved_start,
            TrainingSession.session_date <= resolved_end,
            Schedule.is_deleted.is_(False),
        )
        .all()
    )
    session_ids = [training_session.id for training_session in sessions]
    attendances = (
        session.query(TrainingSessionAttendance)
        .filter(
            TrainingSessionAttendance.session_id.in_(session_ids),
            TrainingSessionAttendance.member_id == device.assigned_member_id,
        )
        .all()
        if session_ids
        else []
    )
    attendance_by_session_id = {
        attendance.session_id: attendance
        for attendance in attendances
    }

    days_by_date: dict[date, list[PublicSessionAttendanceItem]] = {
        resolved_start + timedelta(days=offset): []
        for offset in range((resolved_end - resolved_start).days + 1)
    }
    for training_session in sessions:
        schedule = training_session.schedule
        if schedule is None or schedule.training_form is None:
            continue

        attendance = attendance_by_session_id.get(training_session.id)
        instructors = [
            f"{instructor.member.first_name} {instructor.member.last_name}".strip()
            for instructor in schedule.instructors
            if instructor.member is not None
        ]
        days_by_date[training_session.session_date].append(
            PublicSessionAttendanceItem(
                session_id=training_session.id,
                schedule_id=schedule.id,
                training_form_name=schedule.training_form.name,
                start_time=schedule.start_time.strftime("%H:%M"),
                end_time=schedule.end_time.strftime("%H:%M"),
                instructors=instructors,
                is_cancelled=training_session.is_cancelled,
                attended=attendance.attended if attendance else None,
                attendance_id=attendance.id if attendance else None,
                source=attendance.source if attendance else None,
                self_reported_at=attendance.self_reported_at if attendance else None,
                instructor_verified_at=attendance.instructor_verified_at if attendance else None,
                updated_at=attendance.updated_at if attendance else None,
            )
        )

    days = []
    for day_date in sorted(days_by_date.keys(), reverse=True):
        day_sessions = sorted(
            days_by_date[day_date],
            key=lambda item: (item.start_time, item.session_id),
        )
        days.append(
            PublicAttendanceDay(
                date=day_date,
                is_today=day_date == today,
                sessions=day_sessions,
            )
        )

    return PublicAttendanceDaysResponse(
        member=_member_summary(device.assigned_member),
        start_date=resolved_start,
        end_date=resolved_end,
        today=today,
        days=days,
    )


@public_router.put("/sessions/{session_id:int}", response_model=PublicAttendanceUpdateResponse)
def update_public_session_attendance(
    session_id: int,
    payload: PublicAttendanceUpdateRequest,
    device: Annotated[PublicDeviceIdentity, Depends(_get_assigned_public_device)],
    session: Session = Depends(dep_get_session),
) -> PublicAttendanceUpdateResponse:
    training_session = (
        session.query(TrainingSession)
        .filter(TrainingSession.id == session_id)
        .first()
    )
    if not training_session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="Training session not found.",
        )
    if training_session.is_cancelled:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Cannot edit attendance for cancelled session.",
        )

    _validate_public_window(training_session.session_date)

    attendance = (
        session.query(TrainingSessionAttendance)
        .filter(
            TrainingSessionAttendance.session_id == session_id,
            TrainingSessionAttendance.member_id == device.assigned_member_id,
        )
        .first()
    )
    previous_attended = attendance.attended if attendance else None
    previous_notes = attendance.notes if attendance else None

    if attendance is None:
        attendance = TrainingSessionAttendance(
            session_id=session_id,
            member_id=device.assigned_member_id,
            attended=payload.attended,
        )
        session.add(attendance)
        session.flush()
    else:
        attendance.attended = payload.attended

    attendance.source = AttendanceSource.EXTERNAL_DEVICE.value
    attendance.device_identity_id = device.id
    attendance.self_reported_at = datetime.now()

    session.add(
        AttendanceChangeLog(
            attendance_id=attendance.id,
            session_id=session_id,
            member_id=device.assigned_member_id,
            device_identity_id=device.id,
            changed_by=AttendanceSource.EXTERNAL_DEVICE.value,
            previous_attended=previous_attended,
            new_attended=attendance.attended,
            previous_notes=previous_notes,
            new_notes=attendance.notes,
            changed_at=datetime.now(),
        )
    )
    session.flush()

    return PublicAttendanceUpdateResponse(
        attendance_id=attendance.id,
        session_id=attendance.session_id,
        member_id=attendance.member_id,
        attended=attendance.attended,
        source=attendance.source,
        self_reported_at=attendance.self_reported_at,
        instructor_verified_at=attendance.instructor_verified_at,
    )


route_public_device_manager = RouteAlchemyManager(
    PublicDeviceIdentity,
    api_prefix="/public-device-identity",
    get_depends=[instructor_get_dep],
    create_depends=[admin_dep],
    edit_depends=[admin_dep],
    delete_depends=[admin_dep],
    relation_lookups={
        "assigned_member_id": RelationLookupOut(
            api_route="/member",
            value_field="id",
            label_field="email",
            description="Member currently assigned to this public device.",
        ),
    },
)
route_public_device_manager.link_list_route(
    list_filters=[
        (
            "assigned_member_id",
            "Assigned member ID",
            int,
            lambda query, value: custom_filter(query, PublicDeviceIdentity.assigned_member_id, value),
        ),
        (
            "is_active",
            "Active?",
            bool,
            lambda query, value: custom_filter(query, PublicDeviceIdentity.is_active, value),
        ),
    ],
)
route_public_device_manager.link_schema_route()
route_public_device_manager.link_get_route()
route_public_device_manager.link_create_route(unique_field="token_hash")
route_public_device_manager.link_update_route(unique_field="token_hash")
route_public_device_manager.link_delete_route(to_archive=False)
internal_router.include_router(route_public_device_manager.router, tags=["Public Device Identity"])


route_attendance_change_log_manager = RouteAlchemyManager(
    AttendanceChangeLog,
    api_prefix="/attendance-change-log",
    get_depends=[instructor_get_dep],
    create_depends=[admin_dep],
    edit_depends=[admin_dep],
    delete_depends=[admin_dep],
    relation_lookups={
        "attendance_id": RelationLookupOut(
            api_route="/training/attendance",
            value_field="id",
            label_field="id",
            description="Attendance record changed by this audit entry.",
        ),
        "session_id": RelationLookupOut(
            api_route="/training/training-session",
            value_field="id",
            label_field="session_date",
            description="Training session affected by this audit entry.",
        ),
        "member_id": RelationLookupOut(
            api_route="/member",
            value_field="id",
            label_field="email",
            description="Member affected by this audit entry.",
        ),
        "device_identity_id": RelationLookupOut(
            api_route="/public-device-identity",
            value_field="id",
            label_field="id",
            description="Public device that made this audit entry.",
        ),
    },
)
route_attendance_change_log_manager.link_list_route(
    list_filters=[
        (
            "attendance_id",
            "Attendance ID",
            int,
            lambda query, value: custom_filter(query, AttendanceChangeLog.attendance_id, value),
        ),
        (
            "session_id",
            "Session ID",
            int,
            lambda query, value: custom_filter(query, AttendanceChangeLog.session_id, value),
        ),
        (
            "member_id",
            "Member ID",
            int,
            lambda query, value: custom_filter(query, AttendanceChangeLog.member_id, value),
        ),
        (
            "device_identity_id",
            "Device identity ID",
            int,
            lambda query, value: custom_filter(query, AttendanceChangeLog.device_identity_id, value),
        ),
        (
            "changed_by",
            "Changed by",
            str,
            lambda query, value: custom_filter(query, AttendanceChangeLog.changed_by, value),
        ),
    ],
)
route_attendance_change_log_manager.link_schema_route()
route_attendance_change_log_manager.link_get_route()
route_attendance_change_log_manager.link_create_route()
route_attendance_change_log_manager.link_update_route()
route_attendance_change_log_manager.link_delete_route(to_archive=False)
internal_router.include_router(route_attendance_change_log_manager.router, tags=["Attendance Change Log"])
