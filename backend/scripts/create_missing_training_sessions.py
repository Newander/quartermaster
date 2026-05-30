"""Create missing training_session rows from active schedules.

Usage from the backend directory:
    .venv/Scripts/python.exe scripts/create_missing_training_sessions.py --dry-run
    .venv/Scripts/python.exe scripts/create_missing_training_sessions.py

Optional date limits:
    .venv/Scripts/python.exe scripts/create_missing_training_sessions.py --start-date 2025-09-29 --end-date 2026-05-24
"""

from __future__ import annotations

import argparse
import sys
from collections import defaultdict
from datetime import date, datetime, timedelta
from pathlib import Path

from sqlalchemy import or_
from sqlalchemy.orm import selectinload


BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.database import SessionLocal  # noqa: E402
from app.models.training import (  # noqa: E402
    DayOfWeek,
    Schedule,
    ScheduleCycle,
    Season,
    TrainingSession,
)


def parse_date(value: str) -> date:
    try:
        return date.fromisoformat(value)
    except ValueError as error:
        raise argparse.ArgumentTypeError(
            f"Expected date in YYYY-MM-DD format, got {value!r}"
        ) from error


def coerce_day_of_week(value: DayOfWeek | str) -> DayOfWeek:
    if isinstance(value, DayOfWeek):
        return value

    normalized = value.strip()
    return DayOfWeek.__members__.get(normalized.upper()) or DayOfWeek(normalized.lower())


def coerce_schedule_cycle(value: ScheduleCycle | str) -> ScheduleCycle:
    if isinstance(value, ScheduleCycle):
        return value

    normalized = value.strip()
    return ScheduleCycle.__members__.get(normalized.upper()) or ScheduleCycle(normalized.lower())


def schedule_occurrences_in_range(
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

    target_weekday = coerce_day_of_week(schedule.day_of_week)
    first_date = target_weekday.first_on_or_after(overlap_start)
    if first_date > overlap_end:
        return []

    cycle_weeks = coerce_schedule_cycle(schedule.schedule_cycle).week_num
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


def resolve_default_range(schedules: list[Schedule]) -> tuple[date, date]:
    season_dates = [
        (schedule.seasons.start_date, schedule.seasons.end_date)
        for schedule in schedules
        if schedule.seasons is not None
    ]
    if not season_dates:
        today = date.today()
        return today, today

    return min(start for start, _ in season_dates), max(end for _, end in season_dates)


def build_parser() -> argparse.ArgumentParser:
    parser = argparse.ArgumentParser(
        description="Create missing training_session rows from schedules."
    )
    parser.add_argument(
        "--start-date",
        type=parse_date,
        default=None,
        help="Optional inclusive lower bound in YYYY-MM-DD format.",
    )
    parser.add_argument(
        "--end-date",
        type=parse_date,
        default=None,
        help="Optional inclusive upper bound in YYYY-MM-DD format.",
    )
    parser.add_argument(
        "--include-deleted-schedules",
        action="store_true",
        help="Also generate sessions from schedules marked as deleted.",
    )
    parser.add_argument(
        "--dry-run",
        action="store_true",
        help="Calculate and print what would be created without inserting rows.",
    )
    return parser


def main() -> int:
    args = build_parser().parse_args()

    with SessionLocal() as session:
        query = (
            session.query(Schedule)
            .join(Schedule.seasons)
            .options(selectinload(Schedule.seasons), selectinload(Schedule.training_form))
        )
        if not args.include_deleted_schedules:
            query = query.filter(
                or_(Schedule.is_deleted.is_(False), Schedule.is_deleted.is_(None))
            )

        schedules = query.all()
        if not schedules:
            print("No schedules found.")
            return 0

        default_start, default_end = resolve_default_range(schedules)
        start_date = args.start_date or default_start
        end_date = args.end_date or default_end

        if end_date < start_date:
            print("ERROR: --end-date cannot be earlier than --start-date.", file=sys.stderr)
            return 2

        schedule_ids = [schedule.id for schedule in schedules]
        existing_sessions = (
            session.query(TrainingSession.schedule_id, TrainingSession.session_date)
            .filter(
                TrainingSession.schedule_id.in_(schedule_ids),
                TrainingSession.session_date >= start_date,
                TrainingSession.session_date <= end_date,
            )
            .all()
        )
        existing_schedule_dates = {
            (schedule_id, session_date)
            for schedule_id, session_date in existing_sessions
        }

        sessions_to_create: list[TrainingSession] = []
        created_by_schedule: dict[int, int] = defaultdict(int)

        for schedule in schedules:
            for occurrence_date in schedule_occurrences_in_range(
                schedule=schedule,
                start_date=start_date,
                end_date=end_date,
            ):
                schedule_date_key = (schedule.id, occurrence_date)
                if schedule_date_key in existing_schedule_dates:
                    continue

                sessions_to_create.append(
                    TrainingSession(
                        schedule_id=schedule.id,
                        session_date=occurrence_date,
                        is_cancelled=False,
                    )
                )
                existing_schedule_dates.add(schedule_date_key)
                created_by_schedule[schedule.id] += 1

        print(f"Range: {start_date.isoformat()} .. {end_date.isoformat()}")
        print(f"Schedules scanned: {len(schedules)}")
        print(f"Missing training sessions: {len(sessions_to_create)}")

        for schedule in schedules:
            count = created_by_schedule.get(schedule.id, 0)
            if count == 0:
                continue

            training_form_name = (
                schedule.training_form.name
                if schedule.training_form is not None
                else f"training_form_id={schedule.training_form_id}"
            )
            print(
                f"  schedule_id={schedule.id}: {count} "
                f"({training_form_name}, {schedule.day_of_week}, "
                f"{schedule.start_time}-{schedule.end_time})"
            )

        if args.dry_run:
            print("Dry run: no rows inserted.")
            return 0

        if not sessions_to_create:
            print("Nothing to insert.")
            return 0

        session.add_all(sessions_to_create)
        session.commit()
        print(
            f"Inserted {len(sessions_to_create)} training_session rows at "
            f"{datetime.now().isoformat(timespec='seconds')}."
        )

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
