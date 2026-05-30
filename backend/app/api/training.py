"""
Training API endpoints - forms, schedules, sessions, and attendance
"""
from datetime import date
from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.common.ui_schema import build_model_ui_schema
from app.database import get_db
from app.db_schemas import ModelMetaOut, RelationLookupOut
from app.models.training import TrainingForm, Schedule, TrainingSession, TrainingSessionAttendance, Season, TrainingZone
from app.schemas.training import (
    TrainingFormCreate,
    TrainingFormUpdate,
    TrainingFormResponse,
    TrainingFormListResponse,
    ScheduleCreate,
    ScheduleUpdate,
    ScheduleResponse,
    ScheduleListResponse,
    TrainingSessionCreate,
    TrainingSessionUpdate,
    TrainingSessionResponse,
    TrainingSessionListResponse,
    AttendanceCreate,
    AttendanceResponse,
    AttendanceListResponse,
    SeasonCreate,
    SeasonUpdate,
    SeasonResponse,
    SeasonListResponse,
    TrainingZoneCreate,
    TrainingZoneUpdate,
    TrainingZoneResponse,
    TrainingZoneListResponse,
)

router = APIRouter()


def _schema(
        model,
        db: Session,
        filters: list[tuple[str, str, str]] | None = None,
        relation_lookups: dict[str, RelationLookupOut] | None = None,
) -> ModelMetaOut:
    schema = build_model_ui_schema(model, db)
    schema.filters = filters or []
    schema.relation_lookups = relation_lookups or {}
    return schema


# Training Forms endpoints
@router.post("/forms", response_model=TrainingFormResponse, status_code=status.HTTP_201_CREATED)
def create_training_form(form: TrainingFormCreate, db: Session = Depends(get_db)):
    """Create a new training form"""
    existing = db.query(TrainingForm).filter(TrainingForm.name == form.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Training form with this name already exists"
        )

    db_form = TrainingForm(**form.model_dump())
    db.add(db_form)
    db.commit()
    db.refresh(db_form)
    return db_form


@router.get("/forms", response_model=TrainingFormListResponse)
def get_training_forms(
        skip: int = 0,
        limit: int = 100,
        db: Session = Depends(get_db)
):
    """Get all training forms"""
    query = db.query(TrainingForm)
    total = query.count()
    forms = query.offset(skip).limit(limit).all()
    return {"total": total, "forms": forms}


@router.get("/forms/schema", response_model=ModelMetaOut)
def get_training_form_schema(db: Session = Depends(get_db)):
    """Get table/form metadata for training forms."""
    return _schema(TrainingForm, db)


@router.get("/forms/{form_id}", response_model=TrainingFormResponse)
def get_training_form(form_id: int, db: Session = Depends(get_db)):
    """Get a specific training form"""
    form = db.query(TrainingForm).filter(TrainingForm.id == form_id).first()
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training form not found")
    return form


@router.put("/forms/{form_id}", response_model=TrainingFormResponse)
def update_training_form(form_id: int, form_update: TrainingFormUpdate, db: Session = Depends(get_db)):
    """Update a training form"""
    form = db.query(TrainingForm).filter(TrainingForm.id == form_id).first()
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training form not found")

    update_data = form_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(form, field, value)

    db.commit()
    db.refresh(form)
    return form


@router.delete("/forms/{form_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_training_form(form_id: int, db: Session = Depends(get_db)):
    """Delete a training form"""
    form = db.query(TrainingForm).filter(TrainingForm.id == form_id).first()
    if not form:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training form not found")

    db.delete(form)
    db.commit()
    return None


# Schedule endpoints
@router.post("/schedule", response_model=ScheduleResponse, status_code=status.HTTP_201_CREATED)
def create_schedule(schedule: ScheduleCreate, db: Session = Depends(get_db)):
    """Create a new schedule"""
    # Validate training form exists
    training_form = db.get(TrainingForm, schedule.training_form_id)
    if not training_form:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Training form with ID {schedule.training_form_id} not found"
        )

    # Ensure season exists; if not, create a default one with the requested ID
    season = db.get(Season, schedule.season_id)
    if not season:
        # Create a default season covering the current calendar year
        from datetime import date as _date
        current_year = _date.today().year
        season = Season(
            id=schedule.season_id,  # preserve the requested season_id for referential integrity
            name=f"Default Season {current_year}",
            start_date=_date(current_year, 1, 1),
            end_date=_date(current_year, 12, 31),
            is_finished=False,
        )
        db.add(season)
        db.commit()
        db.refresh(season)

    db_schedule = Schedule(**schedule.model_dump())
    db.add(db_schedule)
    db.commit()
    db.refresh(db_schedule)

    # Load relationships for response
    db_schedule = db.query(Schedule).options(
        selectinload(Schedule.training_form),
        selectinload(Schedule.seasons)
    ).filter(Schedule.id == db_schedule.id).first()

    return db_schedule


@router.get("/schedule", response_model=ScheduleListResponse)
def get_schedules(
        skip: int = 0,
        limit: int = 100,
        is_deleted: Optional[bool] = None,
        training_form_id: Optional[int] = None,
        season_id: Optional[int] = None,
        db: Session = Depends(get_db)
):
    """Get all schedules"""
    query = db.query(Schedule).options(
        selectinload(Schedule.training_form),
        selectinload(Schedule.seasons)
    )

    if is_deleted is not None:
        query = query.filter(Schedule.is_deleted == is_deleted)
    if training_form_id is not None:
        query = query.filter(Schedule.training_form_id == training_form_id)
    if season_id is not None:
        query = query.filter(Schedule.season_id == season_id)

    total = query.count()
    schedules = query.offset(skip).limit(limit).all()
    return {"total": total, "schedules": schedules}


@router.get("/schedule/schema", response_model=ModelMetaOut)
def get_schedule_schema(db: Session = Depends(get_db)):
    """Get table/form metadata for schedules."""
    return _schema(
        Schedule,
        db,
        filters=[
            ("is_deleted", "Usunięty?", "bool"),
            ("training_form_id", "Forma treningowa", "int"),
            ("season_id", "Sezon", "int"),
        ],
        relation_lookups={
            "training_form_id": RelationLookupOut(
                api_route="/training/forms",
                value_field="id",
                label_field="name",
                app_route="/training-form",
            ),
            "season_id": RelationLookupOut(
                api_route="/training/seasons",
                value_field="id",
                label_field="name",
                app_route="/season",
            ),
        },
    )


@router.get("/schedule/{schedule_id}", response_model=ScheduleResponse)
def get_schedule(schedule_id: int, db: Session = Depends(get_db)):
    """Get a specific schedule"""
    schedule = db.query(Schedule).options(
        selectinload(Schedule.training_form),
        selectinload(Schedule.seasons)
    ).filter(Schedule.id == schedule_id).first()

    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")
    return schedule


@router.put("/schedule/{schedule_id}", response_model=ScheduleResponse)
def update_schedule(schedule_id: int, schedule_update: ScheduleUpdate, db: Session = Depends(get_db)):
    """Update a schedule"""
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")

    update_data = schedule_update.model_dump(exclude_unset=True)

    # Validate training_form_id if being updated
    if 'training_form_id' in update_data:
        training_form = db.get(TrainingForm, update_data['training_form_id'])
        if not training_form:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Training form with ID {update_data['training_form_id']} not found"
            )

    # Validate season_id if being updated
    if 'season_id' in update_data:
        season = db.get(Season, update_data['season_id'])
        if not season:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Season with ID {update_data['season_id']} not found"
            )

    for field, value in update_data.items():
        setattr(schedule, field, value)

    db.commit()
    db.refresh(schedule)

    # Load relationships for response
    schedule = db.query(Schedule).options(
        selectinload(Schedule.training_form),
        selectinload(Schedule.seasons)
    ).filter(Schedule.id == schedule.id).first()

    return schedule


@router.delete("/schedule/{schedule_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_schedule(schedule_id: int, db: Session = Depends(get_db)):
    """Delete a schedule"""
    schedule = db.query(Schedule).filter(Schedule.id == schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Schedule not found")

    db.delete(schedule)
    db.commit()
    return None


# Training Session endpoints
@router.post("/sessions", response_model=TrainingSessionResponse, status_code=status.HTTP_201_CREATED)
def create_training_session(session: TrainingSessionCreate, db: Session = Depends(get_db)):
    """Create a new training session"""
    # Validate schedule if provided
    if session.schedule_id:
        schedule = db.get(Schedule, session.schedule_id)
        if not schedule:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Schedule with ID {session.schedule_id} not found"
            )

    db_session = TrainingSession(**session.model_dump())
    db.add(db_session)
    db.commit()
    db.refresh(db_session)

    # Load relationships for response
    if db_session.schedule_id:
        db_session = db.query(TrainingSession).options(
            selectinload(TrainingSession.schedule)
        ).filter(TrainingSession.id == db_session.id).first()

    return db_session


@router.get("/sessions", response_model=TrainingSessionListResponse)
def get_training_sessions(
        skip: int = 0,
        limit: int = 100,
        schedule_id: Optional[int] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        is_cancelled: Optional[bool] = None,
        db: Session = Depends(get_db)
):
    """Get all training sessions"""
    query = db.query(TrainingSession).options(
        selectinload(TrainingSession.schedule)
    )

    if schedule_id is not None:
        query = query.filter(TrainingSession.schedule_id == schedule_id)
    if start_date:
        query = query.filter(TrainingSession.session_date >= start_date)
    if end_date:
        query = query.filter(TrainingSession.session_date <= end_date)
    if is_cancelled is not None:
        query = query.filter(TrainingSession.is_cancelled == is_cancelled)

    total = query.count()
    sessions = query.offset(skip).limit(limit).all()
    return {"total": total, "sessions": sessions}


@router.get("/sessions/schema", response_model=ModelMetaOut)
def get_training_session_schema(db: Session = Depends(get_db)):
    """Get table/form metadata for training sessions."""
    return _schema(
        TrainingSession,
        db,
        filters=[
            ("schedule_id", "Grafik", "int"),
            ("start_date", "Od", "date"),
            ("end_date", "Do", "date"),
            ("is_cancelled", "Anulowana?", "bool"),
        ],
        relation_lookups={
            "schedule_id": RelationLookupOut(
                api_route="/training/schedule",
                value_field="id",
                label_field="id",
                app_route="/schedule",
            ),
        },
    )


@router.get("/sessions/{session_id}", response_model=TrainingSessionResponse)
def get_training_session(session_id: int, db: Session = Depends(get_db)):
    """Get a specific training session"""
    session = db.query(TrainingSession).options(
        selectinload(TrainingSession.schedule)
    ).filter(TrainingSession.id == session_id).first()

    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training session not found")
    return session


@router.put("/sessions/{session_id}", response_model=TrainingSessionResponse)
def update_training_session(
        session_id: int,
        session_update: TrainingSessionUpdate,
        db: Session = Depends(get_db)
):
    """Update a training session"""
    session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training session not found")

    update_data = session_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(session, field, value)

    db.commit()
    db.refresh(session)

    # Load relationships for response
    if session.schedule_id:
        session = db.query(TrainingSession).options(
            selectinload(TrainingSession.schedule)
        ).filter(TrainingSession.id == session.id).first()

    return session


@router.delete("/sessions/{session_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_training_session(session_id: int, db: Session = Depends(get_db)):
    """Delete a training session"""
    session = db.query(TrainingSession).filter(TrainingSession.id == session_id).first()
    if not session:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training session not found")

    db.delete(session)
    db.commit()
    return None


# Attendance endpoints
@router.post("/attendance", response_model=AttendanceResponse, status_code=status.HTTP_201_CREATED)
def create_attendance(attendance: AttendanceCreate, db: Session = Depends(get_db)):
    """Record attendance for a training session"""
    # Validate session exists
    session = db.get(TrainingSession, attendance.session_id)
    if not session:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Training session with ID {attendance.session_id} not found"
        )

    # Validate member exists
    from app.models.hr import Member
    member = db.get(Member, attendance.member_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Member with ID {attendance.member_id} not found"
        )

    existing = db.query(TrainingSessionAttendance).filter(
        TrainingSessionAttendance.session_id == attendance.session_id,
        TrainingSessionAttendance.member_id == attendance.member_id,
    ).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Attendance already exists for this session and member",
        )

    db_attendance = TrainingSessionAttendance(**attendance.model_dump())
    db.add(db_attendance)
    db.commit()
    db.refresh(db_attendance)

    # Load relationships for response
    db_attendance = db.query(TrainingSessionAttendance).options(
        selectinload(TrainingSessionAttendance.member)
    ).filter(TrainingSessionAttendance.id == db_attendance.id).first()

    return db_attendance


@router.get("/attendance", response_model=AttendanceListResponse)
def get_attendance(
        skip: int = 0,
        limit: int = 100,
        session_id: Optional[int] = None,
        member_id: Optional[int] = None,
        attended: Optional[bool] = None,
        db: Session = Depends(get_db)
):
    """Get attendance records"""
    query = db.query(TrainingSessionAttendance).options(
        selectinload(TrainingSessionAttendance.member)
    )

    if session_id is not None:
        query = query.filter(TrainingSessionAttendance.session_id == session_id)
    if member_id is not None:
        query = query.filter(TrainingSessionAttendance.member_id == member_id)
    if attended is not None:
        query = query.filter(TrainingSessionAttendance.attended == attended)

    total = query.count()
    attendances = query.offset(skip).limit(limit).all()
    return {"total": total, "attendances": attendances}


@router.get("/attendance/{attendance_id}", response_model=AttendanceResponse)
def get_attendance_record(attendance_id: int, db: Session = Depends(get_db)):
    """Get a specific attendance record"""
    attendance = db.query(TrainingSessionAttendance).options(
        selectinload(TrainingSessionAttendance.member)
    ).filter(TrainingSessionAttendance.id == attendance_id).first()

    if not attendance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance record not found")
    return attendance


@router.delete("/attendance/{attendance_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_attendance(attendance_id: int, db: Session = Depends(get_db)):
    """Delete an attendance record"""
    attendance = db.query(TrainingSessionAttendance).filter(TrainingSessionAttendance.id == attendance_id).first()
    if not attendance:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Attendance record not found")

    db.delete(attendance)
    db.commit()
    return None


# Season endpoints
@router.post("/seasons", response_model=SeasonResponse, status_code=status.HTTP_201_CREATED)
def create_season(season: SeasonCreate, db: Session = Depends(get_db)):
    """Create a new season"""
    db_season = Season(**season.model_dump())
    db.add(db_season)
    db.commit()
    db.refresh(db_season)
    return db_season


@router.get("/seasons", response_model=SeasonListResponse)
def get_seasons(
        skip: int = 0,
        limit: int = 100,
        is_finished: Optional[bool] = None,
        db: Session = Depends(get_db)
):
    """Get all seasons"""
    query = db.query(Season)
    if is_finished is not None:
        query = query.filter(Season.is_finished == is_finished)

    total = query.count()
    seasons = query.offset(skip).limit(limit).all()
    return {"total": total, "seasons": seasons}


@router.get("/seasons/schema", response_model=ModelMetaOut)
def get_season_schema(db: Session = Depends(get_db)):
    """Get table/form metadata for seasons."""
    return _schema(
        Season,
        db,
        filters=[("is_finished", "Zakończony?", "bool")],
    )


@router.get("/seasons/{season_id}", response_model=SeasonResponse)
def get_season(season_id: int, db: Session = Depends(get_db)):
    """Get a specific season"""
    season = db.query(Season).filter(Season.id == season_id).first()
    if not season:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Season not found")
    return season


@router.put("/seasons/{season_id}", response_model=SeasonResponse)
def update_season(season_id: int, season_update: SeasonUpdate, db: Session = Depends(get_db)):
    """Update a season"""
    season = db.query(Season).filter(Season.id == season_id).first()
    if not season:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Season not found")

    update_data = season_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(season, field, value)

    db.commit()
    db.refresh(season)
    return season


@router.delete("/seasons/{season_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_season(season_id: int, db: Session = Depends(get_db)):
    """Delete a season"""
    season = db.query(Season).filter(Season.id == season_id).first()
    if not season:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Season not found")

    season.is_finished = True
    db.commit()


# TrainingZone endpoints
@router.post("/zones", response_model=TrainingZoneResponse, status_code=status.HTTP_201_CREATED)
def create_training_zone(zone: TrainingZoneCreate, db: Session = Depends(get_db)):
    """Create a new training zone"""
    db_zone = TrainingZone(**zone.model_dump())
    db.add(db_zone)
    db.commit()
    db.refresh(db_zone)
    return db_zone


@router.get("/zones", response_model=TrainingZoneListResponse)
def get_training_zones(
        skip: int = 0,
        limit: int = 100,
        is_available: Optional[bool] = None,
        db: Session = Depends(get_db)
):
    """Get all training zones"""
    query = db.query(TrainingZone)
    if is_available is not None:
        query = query.filter(TrainingZone.is_available == is_available)

    total = query.count()
    zones = query.offset(skip).limit(limit).all()
    return {"total": total, "zones": zones}


@router.get("/zones/schema", response_model=ModelMetaOut)
def get_training_zone_schema(db: Session = Depends(get_db)):
    """Get table/form metadata for training zones."""
    return _schema(
        TrainingZone,
        db,
        filters=[("is_available", "Dostępna?", "bool")],
    )


@router.get("/zones/{zone_id}", response_model=TrainingZoneResponse)
def get_training_zone(zone_id: int, db: Session = Depends(get_db)):
    """Get a specific training zone"""
    zone = db.query(TrainingZone).filter(TrainingZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training zone not found")
    return zone


@router.put("/zones/{zone_id}", response_model=TrainingZoneResponse)
def update_training_zone(zone_id: int, zone_update: TrainingZoneUpdate, db: Session = Depends(get_db)):
    """Update a training zone"""
    zone = db.query(TrainingZone).filter(TrainingZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training zone not found")

    update_data = zone_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(zone, field, value)

    db.commit()
    db.refresh(zone)
    return zone


@router.delete("/zones/{zone_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_training_zone(zone_id: int, db: Session = Depends(get_db)):
    """Delete a training zone"""
    zone = db.query(TrainingZone).filter(TrainingZone.id == zone_id).first()
    if not zone:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Training zone not found")

    db.delete(zone)
    db.commit()
    return None
