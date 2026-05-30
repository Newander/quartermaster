"""
Bulk fixture generator: creates 300 sample members and some related data.

Usage:
    python -m fixture_data.upload_test_data_300

Notes:
- Idempotent: re-running will reuse existing members (by unique email), money categories, plans, events, and payments when possible.
- Requires the FastAPI server to be running at BASE_URL.
"""
from __future__ import annotations

import os
import random
from datetime import date
from typing import Dict, Any, List

import requests

try:
    # Reuse the rich helper class with find_* utilities and creators
    from fixture_data.upload_all_data import HEMAGymAPITester
except Exception:  # pragma: no cover
    # Fallback import path if executed differently
    from .upload_all_data import HEMAGymAPITester


BASE_URL = os.getenv("BASE_URL", "http://localhost:8080/api")


def _unique_member_payload(idx: int) -> Dict[str, Any]:
    # Deterministic pseudo-random but stable generation
    first_names = [
        "Alex", "Sam", "Jordan", "Taylor", "Casey", "Riley", "Morgan", "Quinn", "Jamie", "Reese",
        "Avery", "Rowan", "Emerson", "Logan", "Cameron", "Parker", "Harper", "Finley", "Elliot", "Dakota",
    ]
    last_names = [
        "Smith", "Johnson", "Williams", "Brown", "Jones", "Garcia", "Miller", "Davis", "Rodriguez", "Martinez",
        "Hernandez", "Lopez", "Gonzalez", "Wilson", "Anderson", "Thomas", "Taylor", "Moore", "Jackson", "Martin",
    ]
    # Assign name deterministically by index
    fn = first_names[idx % len(first_names)]
    ln = last_names[(idx // len(first_names)) % len(last_names)]

    # Spread birthdays between 1970 and 2006
    year = 1970 + (idx % 37)
    month = (idx % 12) + 1
    day = (idx % 27) + 1

    # Ensure unique email and phone for idempotency key
    email = f"seed{idx:03d}@example.com"
    phone = f"+1555{idx:07d}"

    return {
        "first_name": fn,
        "last_name": ln,
        "email": email,
        "phone": phone,
        "date_of_birth": f"{year:04d}-{month:02d}-{day:02d}",
        "notes": f"Auto-generated seed member #{idx:03d}",
    }


def bulk_register_members(tester: HEMAGymAPITester, count: int = 300) -> List[Dict[str, Any]]:
    created: List[Dict[str, Any]] = []
    print(f"1. Creating {count} Members...")

    for i in range(count):
        payload = _unique_member_payload(i)
        existing = tester.find_member_by_email(payload["email"])  # idempotency
        if existing:
            print(f"✓ Member exists: {existing['email']}")
            created.append(existing)
            continue
        resp = tester.session.post(f"{tester.base_url}/member/", json=payload)
        resp.raise_for_status()
        member = resp.json()
        print(f"✓ Registered member: {member['first_name']} {member['last_name']} ({member['email']})")
        created.append(member)

    print(f"✓ Total members available now: {len(created)} (this run) — note: database may contain more)")
    return created


def ensure_prerequisites(tester: HEMAGymAPITester) -> Dict[str, Any]:
    # Money categories (membership income, event income, utilities, rent, etc.)
    categories = tester.create_money_categories()

    # Season will be auto-created by schedule creation in other flows, but plans need season_id; our
    # create_membership_plans() already uses season_id=1; training.schedule endpoint also auto-creates season 1 if missing.
    # So we simply proceed to plans here.
    plans = tester.create_membership_plans()

    # Create a couple of events to allow registrations dataset
    events = tester.create_events()

    return {
        "categories": categories,
        "plans": plans,
        "events": events,
    }


def create_random_memberships(
    tester: HEMAGymAPITester,
    members: List[Dict[str, Any]],
    plans: List[Dict[str, Any]],
    categories: List[Dict[str, Any]],
    fraction: float = 0.33,
) -> List[Dict[str, Any]]:
    """Create memberships for roughly a fraction of members.
    Each membership creates or reuses a payment first (as required by API).
    """
    random.seed(42)

    # Find membership income category id
    membership_category = next((c for c in categories if c["name"] == "Membership Income"), None)
    if not membership_category:
        raise RuntimeError("Membership Income category is required but was not created")
    membership_category_id = membership_category["id"]

    plan_ids = [p["id"] for p in plans]
    plan_by_id = {p["id"]: p for p in plans}

    memberships: List[Dict[str, Any]] = []

    target_count = max(1, int(len(members) * fraction))
    chosen_members = random.sample(members, target_count)

    for m in chosen_members:
        plan_id = random.choice(plan_ids)
        start_date = date(2025, (m["id"] % 12) + 1, ((m["id"] % 27) + 1)).isoformat()

        # Skip if already linked
        existing = tester.find_membership(m["id"], plan_id)
        if existing:
            memberships.append(existing)
            continue

        amount = float(plan_by_id[plan_id]["price"]) if plan_id in plan_by_id else 0.0
        description = f"Membership payment for member {m['id']}, plan {plan_id}"
        existing_payment = tester.find_payment(description, amount, start_date)
        if existing_payment:
            payment_id = existing_payment["id"]
        else:
            payment_payload = {
                "category_id": membership_category_id,
                "description": description,
                "amount": amount,
                "payment_date": start_date,
                "is_recurring": False,
                "payment_method": "card",
                "notes": f"Auto-generated for membership link (member {m['id']}, plan {plan_id})",
            }
            pay_resp = tester.session.post(f"{tester.base_url}/membership/payments", json=payment_payload)
            pay_resp.raise_for_status()
            payment_id = pay_resp.json()["id"]

        membership_payload = {
            "member_id": m["id"],
            "plan_id": plan_id,
            "payment_id": payment_id,
        }
        mem_resp = tester.session.post(f"{tester.base_url}/membership", json=membership_payload)
        mem_resp.raise_for_status()
        memberships.append(mem_resp.json())

    print(f"✓ Created/linked {len(memberships)} memberships for seeded members")
    return memberships


def create_event_registrations(
    tester: HEMAGymAPITester,
    events: List[Dict[str, Any]],
    members: List[Dict[str, Any]],
    categories: List[Dict[str, Any]],
    per_event: int = 30,
) -> List[Dict[str, Any]]:
    random.seed(99)
    registrations: List[Dict[str, Any]] = []

    # Ensure we have a generic income category for event payments, fall back to membership income if needed
    cat = next((c for c in categories if c["name"].lower().startswith("event")), None) or \
          next((c for c in categories if c["name"] == "Membership Income"), None)
    if not cat:
        raise RuntimeError("Required money category for event payments not found")

    for event in events[:2]:  # take first two events to avoid noise
        sample_members = random.sample(members, min(per_event, len(members)))
        for m in sample_members:
            amount = float(event.get("price", 25.0)) if isinstance(event, dict) else 25.0
            pay_desc = f"Event registration payment for member {m['id']} event {event['id']}"
            pay_date = event.get("date", "2025-02-01")

            existing_payment = tester.find_payment(pay_desc, amount, pay_date)
            if existing_payment:
                payment_id = existing_payment["id"]
            else:
                payment_payload = {
                    "category_id": cat["id"],
                    "description": pay_desc,
                    "amount": amount,
                    "payment_date": pay_date,
                    "is_recurring": False,
                    "payment_method": "card",
                    "notes": "Auto-generated for event registration",
                }
                pay_resp = tester.session.post(f"{tester.base_url}/membership/payments", json=payment_payload)
                pay_resp.raise_for_status()
                payment_id = pay_resp.json()["id"]

            reg_payload = {
                "event_id": event["id"],
                "member_id": m["id"],
                "notes": "Seed registration",
                "payment_id": payment_id,
            }
            reg_resp = tester.session.post(f"{tester.base_url}/events/registrations", json=reg_payload)
            if reg_resp.status_code in (200, 201):
                registrations.append(reg_resp.json())
            else:
                # 409 conflicts or duplicates can be ignored quietly for seeding
                if reg_resp.status_code == 409:
                    continue
                reg_resp.raise_for_status()

    print(f"✓ Created {len(registrations)} event registrations")
    return registrations


def run_seed_300():
    tester = HEMAGymAPITester(BASE_URL)

    prereq = ensure_prerequisites(tester)
    categories = prereq["categories"]
    plans = prereq["plans"]
    events = prereq["events"]

    members = bulk_register_members(tester, 300)

    # Create memberships for ~33% of created members
    create_random_memberships(tester, members, plans, categories, fraction=0.33)

    # Register ~30 members into first two events
    create_event_registrations(tester, events, members, categories, per_event=30)

    print("All done: 300 members plus related data have been seeded (idempotent).")


if __name__ == "__main__":
    run_seed_300()
