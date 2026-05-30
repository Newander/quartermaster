"""
Import shelf rental documents and links from a local CSV file.

The script intentionally does not print row values from the CSV. Its output is
limited to aggregate counters and optional non-PII row-number error reports.
By default it runs in dry-run mode; pass --apply to commit changes.
"""

from __future__ import annotations

import argparse
import csv
import json
import re
import sys
from collections import Counter
from dataclasses import dataclass
from datetime import date, datetime, time, timedelta
from pathlib import Path
from typing import Any

from sqlalchemy import func, or_
from sqlalchemy.orm import Session

BACKEND_ROOT = Path(__file__).resolve().parents[1]
if str(BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(BACKEND_ROOT))

from app.database import SessionLocal  # noqa: E402
from app.enums import PaymentMethod, PaymentStatus  # noqa: E402
from app.models import Contract, Member, MemberContract  # noqa: E402
from app.models.money import MoneyCategory, Payment  # noqa: E402
from app.models.shelf import Rack, Shelf, ShelfPlan, ShelfRental  # noqa: E402


CSV_COLUMNS = {
    "contract_number": "NR Umowy",
    "person": "OSOBA",
    "phone": "Szybki kontakt",
    "email": "Mail",
    "rental_type": "Typ wynajmu",
    "contract_status": "Status Umowy",
    "shelf": "Polka",
    "no_fee_indefinite": "Bezterminowo Bez oplat",
    "paid_until": "Oplacona Do",
    "payment_status": "Status Oplacenia",
    "comment": "Komentarz",
}

INDEFINITE_END_DATE = date(9999, 12, 31)


@dataclass(slots=True)
class ImportIssue:
    row_number: int
    reason: str


@dataclass(slots=True)
class CsvRentalRow:
    row_number: int
    contract_number: str
    person: str
    email: str
    rental_type: str
    contract_status: str
    shelf: str
    no_fee_indefinite: bool
    paid_until: date | None
    payment_status: str
    comment: str


def normalized(value: str | None) -> str:
    return (value or "").strip()


def normalized_lower(value: str | None) -> str:
    return normalized(value).lower()


def parse_bool(value: str | None) -> bool:
    return normalized_lower(value) in {"1", "1.0", "true", "tak", "yes", "y"}


def parse_date(value: str | None) -> date | None:
    raw_value = normalized(value)
    if not raw_value:
        return None

    for date_format in ("%Y-%m-%d", "%d.%m.%Y", "%d/%m/%Y"):
        try:
            return datetime.strptime(raw_value, date_format).date()
        except ValueError:
            continue

    raise ValueError("unsupported_date_format")


def read_rows(csv_path: Path) -> tuple[list[CsvRentalRow], list[ImportIssue]]:
    rows: list[CsvRentalRow] = []
    issues: list[ImportIssue] = []

    with csv_path.open("r", encoding="utf-8-sig", newline="") as csv_file:
        reader = csv.DictReader(csv_file)
        missing_columns = [column for column in CSV_COLUMNS.values() if column not in (reader.fieldnames or [])]
        if missing_columns:
            raise ValueError(f"CSV is missing required columns: {', '.join(missing_columns)}")

        for row_number, raw_row in enumerate(reader, start=2):
            if not any(normalized(value) for value in raw_row.values()):
                continue

            try:
                rows.append(
                    CsvRentalRow(
                        row_number=row_number,
                        contract_number=normalized(raw_row[CSV_COLUMNS["contract_number"]]),
                        person=normalized(raw_row[CSV_COLUMNS["person"]]),
                        email=normalized(raw_row[CSV_COLUMNS["email"]]),
                        rental_type=normalized(raw_row[CSV_COLUMNS["rental_type"]]),
                        contract_status=normalized(raw_row[CSV_COLUMNS["contract_status"]]),
                        shelf=normalized(raw_row[CSV_COLUMNS["shelf"]]),
                        no_fee_indefinite=parse_bool(raw_row[CSV_COLUMNS["no_fee_indefinite"]]),
                        paid_until=parse_date(raw_row[CSV_COLUMNS["paid_until"]]),
                        payment_status=normalized(raw_row[CSV_COLUMNS["payment_status"]]),
                        comment=normalized(raw_row[CSV_COLUMNS["comment"]]),
                    )
                )
            except ValueError as exc:
                issues.append(ImportIssue(row_number=row_number, reason=str(exc)))

    return rows, issues


def build_contract_title(contract_number: str, row_number: int) -> str:
    if contract_number and contract_number != "?":
        return f"Umowa najmu półki {contract_number}"
    return f"Umowa najmu półki import row {row_number}"


def parse_shelf_reference(value: str) -> tuple[str, list[str]] | None:
    match = re.match(r"^(?P<rack>.+?)\s+(?P<shelf>P\s*\d+)$", value.strip(), flags=re.IGNORECASE)
    if match is None:
        return None

    rack_name = re.sub(r"\s+", " ", match.group("rack").strip())
    shelf_token = re.sub(r"\s+", "", match.group("shelf").upper())
    shelf_number = shelf_token.removeprefix("P")
    return rack_name, [shelf_token, shelf_number]


def find_member(session: Session, row: CsvRentalRow) -> tuple[Member | None, str | None]:
    if row.email:
        member = (
            session.query(Member)
            .filter(func.lower(Member.email) == row.email.lower(), Member.is_deleted.is_(False))
            .one_or_none()
        )
        if member is not None:
            return member, None

    person_parts = [part for part in row.person.split() if part]
    if len(person_parts) < 2:
        return None, "member_not_found"

    first_token = person_parts[0]
    remaining = " ".join(person_parts[1:])
    candidates = (
        session.query(Member)
        .filter(
            Member.is_deleted.is_(False),
            or_(
                func.lower(Member.first_name) == first_token.lower(),
                func.lower(Member.last_name) == first_token.lower(),
                func.lower(Member.first_name) == remaining.lower(),
                func.lower(Member.last_name) == remaining.lower(),
            ),
        )
        .all()
    )
    exact_matches = [
        member
        for member in candidates
        if {
            f"{member.first_name} {member.last_name}".lower(),
            f"{member.last_name} {member.first_name}".lower(),
        }
        & {row.person.lower()}
    ]

    if len(exact_matches) == 1:
        return exact_matches[0], None
    if len(exact_matches) > 1:
        return None, "member_ambiguous"
    return None, "member_not_found"


def find_shelf(session: Session, shelf_reference: str) -> tuple[Shelf | None, str | None]:
    parsed_reference = parse_shelf_reference(shelf_reference)
    if parsed_reference is None:
        return None, "shelf_reference_invalid"

    rack_name, shelf_numbers = parsed_reference
    shelves = (
        session.query(Shelf)
        .join(Rack)
        .filter(
            Shelf.is_deleted.is_(False),
            Rack.is_deleted.is_(False),
            func.lower(Rack.name) == rack_name.lower(),
            func.lower(Shelf.shelf_number).in_([value.lower() for value in shelf_numbers]),
        )
        .all()
    )

    if len(shelves) == 1:
        return shelves[0], None
    if len(shelves) > 1:
        return None, "shelf_ambiguous"
    return None, "shelf_not_found"


def load_plan_map(raw_plan_map: str | None) -> dict[str, str]:
    if not raw_plan_map:
        return {}
    data = json.loads(raw_plan_map)
    if not isinstance(data, dict) or not all(isinstance(key, str) and isinstance(value, str) for key, value in data.items()):
        raise ValueError("--plan-map-json must be a JSON object with string keys and values")
    return data


def find_plan(
    session: Session,
    rental_type: str,
    default_plan_name: str | None,
    plan_map: dict[str, str],
) -> tuple[ShelfPlan | None, str | None]:
    mapped_plan_name = plan_map.get(rental_type) or plan_map.get(rental_type.lower())
    candidate_names = [name for name in [mapped_plan_name, rental_type, default_plan_name] if name]

    for plan_name in candidate_names:
        plan = (
            session.query(ShelfPlan)
            .filter(func.lower(ShelfPlan.name) == plan_name.lower(), ShelfPlan.is_deleted.is_(False))
            .one_or_none()
        )
        if plan is not None:
            return plan, None

    return None, "plan_not_found"


def map_payment_status(raw_status: str) -> PaymentStatus:
    status = normalized_lower(raw_status)
    if status == "ok":
        return PaymentStatus.PAID
    if "nie" in status or "not" in status or "overdue" in status:
        return PaymentStatus.OVERDUE
    return PaymentStatus.SCHEDULED


def is_contract_signed(raw_status: str) -> bool:
    return normalized_lower(raw_status) in {"aktywna", "active"}


def get_or_create_category(session: Session) -> MoneyCategory:
    category = session.query(MoneyCategory).filter(MoneyCategory.name == "shelf_rental").one_or_none()
    if category is not None:
        return category

    category = MoneyCategory(name="shelf_rental")
    session.add(category)
    session.flush()
    return category


def build_notes(row: CsvRentalRow) -> str:
    parts = [
        f"Import CSV row: {row.row_number}",
        f"Typ wynajmu: {row.rental_type or '-'}",
        f"Status umowy: {row.contract_status or '-'}",
        f"Polka: {row.shelf or '-'}",
        f"Bezterminowo bez oplat: {'tak' if row.no_fee_indefinite else 'nie'}",
        f"Oplacona do: {row.paid_until.isoformat() if row.paid_until else '-'}",
        f"Status oplacenia: {row.payment_status or '-'}",
    ]
    if row.comment:
        parts.append(f"Komentarz: {row.comment}")
    return "\n".join(parts)


def import_rows(
    session: Session,
    rows: list[CsvRentalRow],
    start_date: date,
    default_plan_name: str | None,
    plan_map: dict[str, str],
    payment_amount: float,
) -> tuple[Counter[str], list[ImportIssue]]:
    counters: Counter[str] = Counter()
    issues: list[ImportIssue] = []

    for row in rows:
        counters["rows_seen"] += 1

        member, member_error = find_member(session, row)
        if member_error is not None or member is None:
            counters[f"skipped_{member_error or 'member_not_found'}"] += 1
            issues.append(ImportIssue(row.row_number, member_error or "member_not_found"))
            continue

        shelf, shelf_error = find_shelf(session, row.shelf)
        if shelf_error is not None or shelf is None:
            counters[f"skipped_{shelf_error or 'shelf_not_found'}"] += 1
            issues.append(ImportIssue(row.row_number, shelf_error or "shelf_not_found"))
            continue

        plan, plan_error = find_plan(session, row.rental_type, default_plan_name, plan_map)
        if plan_error is not None or plan is None:
            counters[f"skipped_{plan_error or 'plan_not_found'}"] += 1
            issues.append(ImportIssue(row.row_number, plan_error or "plan_not_found"))
            continue

        contract_title = build_contract_title(row.contract_number, row.row_number)
        end_date = (
            INDEFINITE_END_DATE
            if row.no_fee_indefinite
            else row.paid_until or start_date + timedelta(days=plan.duration_days)
        )
        if end_date < start_date:
            counters["skipped_invalid_date_range"] += 1
            issues.append(ImportIssue(row.row_number, "invalid_date_range"))
            continue

        contract = session.query(Contract).filter(Contract.title == contract_title).one_or_none()
        if contract is None:
            contract = Contract(
                title=contract_title,
                description=build_notes(row),
                version="csv-import",
                effective_from=start_date,
                effective_to=None if row.no_fee_indefinite else end_date,
            )
            session.add(contract)
            session.flush()
            counters["contracts_created"] += 1
        else:
            counters["contracts_reused"] += 1

        member_contract = (
            session.query(MemberContract)
            .filter(MemberContract.member_id == member.id, MemberContract.contract_id == contract.id)
            .one_or_none()
        )
        signed = is_contract_signed(row.contract_status)
        if member_contract is None:
            member_contract = MemberContract(
                member_id=member.id,
                contract_id=contract.id,
                signed=signed,
                signed_at=datetime.combine(start_date, time.min) if signed else None,
                notes=build_notes(row),
            )
            session.add(member_contract)
            counters["member_contracts_created"] += 1
        else:
            member_contract.notes = build_notes(row)
            if signed and not member_contract.signed:
                member_contract.signed = True
                member_contract.signed_at = datetime.combine(start_date, time.min)
            counters["member_contracts_reused"] += 1

        existing_rental = (
            session.query(ShelfRental)
            .filter(
                ShelfRental.member_id == member.id,
                ShelfRental.shelf_id == shelf.id,
                ShelfRental.contract_id == contract.id,
            )
            .one_or_none()
        )
        if existing_rental is not None:
            counters["rentals_reused"] += 1
            continue

        category = get_or_create_category(session)
        payment = Payment(
            category_id=category.id,
            description=f"Shelf rental import row {row.row_number}",
            amount=payment_amount,
            payment_date=start_date,
            is_recurring=False,
            payment_method=PaymentMethod.TRANSFER,
            status=map_payment_status(row.payment_status),
            notes=build_notes(row),
        )
        session.add(payment)
        session.flush()
        counters["payments_created"] += 1

        rental = ShelfRental(
            shelf_id=shelf.id,
            member_id=member.id,
            plan_id=plan.id,
            payment_id=payment.id,
            contract_id=contract.id,
            start_date=start_date,
            end_date=end_date,
            notes=build_notes(row),
        )
        session.add(rental)
        counters["rentals_created"] += 1

    return counters, issues


def write_issue_report(path: Path, issues: list[ImportIssue]) -> None:
    with path.open("w", encoding="utf-8", newline="") as report_file:
        writer = csv.DictWriter(report_file, fieldnames=["row_number", "reason"])
        writer.writeheader()
        for issue in issues:
            writer.writerow({"row_number": issue.row_number, "reason": issue.reason})


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Import shelf rental CSV without printing personal data.")
    parser.add_argument("csv_path", type=Path, help="Path to the input CSV file.")
    parser.add_argument("--apply", action="store_true", help="Commit changes. Without this flag, the script rolls back.")
    parser.add_argument("--start-date", type=parse_date, default=date.today(), help="Rental start date, default: today.")
    parser.add_argument(
        "--default-plan-name",
        default="Monthly Locker",
        help="Fallback ShelfPlan.name when Typ wynajmu does not match a plan.",
    )
    parser.add_argument(
        "--plan-map-json",
        default=None,
        help='Optional mapping from CSV "Typ wynajmu" to ShelfPlan.name, e.g. {"VAETTIR":"Monthly Locker"}.',
    )
    parser.add_argument("--payment-amount", type=float, default=0.0, help="Payment amount to store for imported rentals.")
    parser.add_argument("--errors-csv", type=Path, default=None, help="Optional non-PII row-number error report path.")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    plan_map = load_plan_map(args.plan_map_json)
    rows, parse_issues = read_rows(args.csv_path)

    with SessionLocal() as session:
        counters, import_issues = import_rows(
            session=session,
            rows=rows,
            start_date=args.start_date,
            default_plan_name=args.default_plan_name,
            plan_map=plan_map,
            payment_amount=args.payment_amount,
        )

        if args.apply:
            session.commit()
            mode = "applied"
        else:
            session.rollback()
            mode = "dry_run"

    issues = parse_issues + import_issues
    if args.errors_csv is not None:
        write_issue_report(args.errors_csv, issues)

    summary = Counter(counters)
    summary["parse_issues"] = len(parse_issues)
    summary["import_issues"] = len(import_issues)

    print(f"mode={mode}")
    for key in sorted(summary):
        print(f"{key}={summary[key]}")
    if args.errors_csv is not None:
        print(f"errors_csv_written={len(issues)}")

    return 0 if not issues else 2


if __name__ == "__main__":
    raise SystemExit(main())
