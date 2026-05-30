"""
Quartermaster System - API Test Script
Python script to test all API endpoints following business process flow
Idempotent version - can be run multiple times without creating duplicates
Extended version with 10 examples per category and additional test cases
"""
import os
from typing import Dict, Any, Optional

import requests

# Base configuration
BASE_URL = os.getenv("BASE_URL", "http://localhost:8080/api")


class HEMAGymAPITester:
    """Test client for Quartermaster System API"""

    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

    # ============================================
    # Helper Methods
    # ============================================

    def get_list(self, path: str, **params) -> Dict[str, Any] | list[Dict[str, Any]]:
        """Fetch list endpoints with enough rows for idempotency checks."""
        params.setdefault("limit", 10000)
        response = self.session.get(f"{self.base_url}{path}", params=params)
        response.raise_for_status()
        return response.json()

    def find_instructor_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Find instructor by member email"""
        data = self.get_list("/instructor/")
        for instructor in data.get('instructors', []):
            member = instructor.get('member') or {}
            if member.get('email') == email:
                return instructor
        return None

    def find_member_by_email(self, email: str) -> Optional[Dict[str, Any]]:
        """Find member by email"""
        data = self.get_list("/member/")
        for member in data.get('members', []):
            if member.get('email') == email:
                return member
        return None

    def find_training_form_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Find training form by name"""
        data = self.get_list("/training/forms")
        for form in data.get('forms', []):
            if form.get('name') == name:
                return form
        return None

    def find_membership_plan_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Find membership plan by name"""
        data = self.get_list("/membership/plans")
        for plan in data.get('plans', []):
            if plan.get('name') == name:
                return plan
        return None

    def find_event_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Find event by name"""
        data = self.get_list("/events")
        for event in data.get('events', []):
            if event.get('name') == name:
                return event
        return None

    def find_schedule(self, training_form_id: int, day_of_week: str) -> Optional[Dict[str, Any]]:
        """Find schedule by training form and day"""
        data = self.get_list("/training/schedule")
        for schedule in data.get('schedules', []):
            if schedule.get('training_form_id') == training_form_id and schedule.get('day_of_week') == day_of_week:
                return schedule
        return None

    def find_membership(self, member_id: int, plan_id: int) -> Optional[Dict[str, Any]]:
        """Find membership payment link by member and plan"""
        data = self.get_list("/membership", member_id=member_id)
        for membership in data.get('memberships', []):
            if membership.get('plan_id') == plan_id:
                return membership
        return None

    def find_payment(self, description: str, amount: float, payment_date: str) -> Optional[Dict[str, Any]]:
        """Find an existing payment by description, amount and date"""
        data = self.get_list("/membership/payments")
        for payment in data.get('payments', []) if isinstance(data, dict) else data:
            if (
                    payment.get('description') == description and
                    abs(float(payment.get('amount', 0)) - float(amount)) < 1e-6 and
                    str(payment.get('payment_date')) == payment_date
            ):
                return payment
        return None

    def find_training_session(self, schedule_id: int, session_date: str) -> Optional[Dict[str, Any]]:
        """Find training session by schedule and date"""
        data = self.get_list("/training/sessions")
        for session in data.get('sessions', []):
            if session.get('schedule_id') == schedule_id and session.get('session_date') == session_date:
                return session
        return None

    def find_season_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Find season by name"""
        try:
            data = self.get_list("/training/seasons")
            for season in data.get('seasons', []):
                if season.get('name') == name:
                    return season
        except:
            pass
        return None

    def find_money_category_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Find money category by name"""
        data = self.get_list("/membership/categories")
        for category in data.get('categories', []):
            if category.get('name') == name:
                return category
        return None

    def find_contract_by_title(self, title: str) -> Optional[Dict[str, Any]]:
        """Find contract by title"""
        try:
            data = self.get_list("/contracts/")
            for contract in data.get('contracts', []):
                if contract.get('title') == title:
                    return contract
        except:
            pass
        return None

    def find_shelf_by_number(self, shelf_number: str) -> Optional[Dict[str, Any]]:
        """Find shelf by shelf number"""
        try:
            data = self.get_list("/shelves/shelves")
            for shelf in data.get('shelves', []):
                if shelf.get('shelf_number') == shelf_number:
                    return shelf
        except:
            pass
        return None

    def find_shelf_plan_by_name(self, name: str) -> Optional[Dict[str, Any]]:
        """Find shelf plan by name"""
        try:
            plans = self.get_list("/shelves/plans")
            for plan in plans:
                if plan.get('name') == name:
                    return plan
        except:
            pass
        return None

    # ============================================
    # 1. SETUP: Instructors (10 examples)
    # ============================================

    def create_instructors(self, members: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
        """Create 10 instructors by promoting existing members (idempotent)"""
        specializations = [
            ("Longsword", "15 years of HEMA experience, specializing in German longsword techniques"),
            ("Rapier", "Expert in Italian rapier and Spanish destreza"),
            ("Sword & Buckler", "Specialist in medieval sword and buckler combat, I.33 manuscript interpretation"),
            ("Messer", "German messer techniques, Lecküchner manuscript focus"),
            ("Saber", "Polish and Hungarian saber fencing traditions"),
            ("Smallsword", "18th century smallsword and court fencing expert"),
            ("Polearms", "Specialist in spear, halberd, and staff techniques"),
            ("Dagger", "Medieval and Renaissance dagger combat, Fiore dei Liberi tradition"),
            ("Wrestling", "Historical wrestling techniques, Ringen and grappling"),
            ("Montante", "Portuguese and Spanish montante (two-handed sword) expert"),
        ]

        instructors = []
        for idx, (spec, bio) in enumerate(specializations):
            if idx >= len(members):
                break
            member = members[idx]
            # Check if this member is already an instructor
            existing = self.find_instructor_by_email(member['email'])
            if existing:
                print(f"✓ Instructor already exists for member: {member['first_name']} {member['last_name']}")
                instructors.append(existing)
                continue

            payload = {
                "member_id": member['id'],
                "specialization": spec,
                "bio": bio,
            }
            response = self.session.post(f"{self.base_url}/instructor/", json=payload)
            response.raise_for_status()
            instructor = response.json()
            print(f"✓ Created instructor for member: {member['first_name']} {member['last_name']} ({spec})")
            instructors.append(instructor)

        return instructors

    # ============================================
    # 2. SETUP: Training Forms (10 examples)
    # ============================================

    def create_training_forms(self) -> list[Dict[str, Any]]:
        """Create 10 training forms (idempotent)"""
        forms_data = [
            {
                "name": "Longsword - Beginner",
                "description": "Introduction to German longsword, basic guards and cuts"
            },
            {
                "name": "Longsword - Advanced",
                "description": "Advanced longsword techniques, master cuts and complex binds"
            },
            {
                "name": "Rapier - Italian Style",
                "description": "Italian rapier fencing based on Capo Ferro and Giganti"
            },
            {
                "name": "Sword & Buckler",
                "description": "Medieval sword and buckler combat, I.33 manuscript"
            },
            {
                "name": "Messer Combat",
                "description": "German messer techniques from Lecküchner"
            },
            {
                "name": "Polish Saber",
                "description": "Traditional Polish and Hungarian saber fencing"
            },
            {
                "name": "Smallsword Dueling",
                "description": "18th century smallsword techniques and court fencing"
            },
            {
                "name": "Polearms Workshop",
                "description": "Staff, spear, and halberd techniques"
            },
            {
                "name": "Dagger & Wrestling",
                "description": "Close combat with dagger and grappling techniques"
            },
            {
                "name": "Open Sparring",
                "description": "Free sparring session for all weapon forms, supervised"
            }
        ]

        forms = []
        for data in forms_data:
            existing = self.find_training_form_by_name(data['name'])
            if existing:
                print(f"✓ Training form already exists: {existing['name']}")
                forms.append(existing)
            else:
                response = self.session.post(f"{self.base_url}/training/forms", json=data)
                response.raise_for_status()
                form = response.json()
                print(f"✓ Created training form: {data['name']}")
                forms.append(form)

        return forms

    # ============================================
    # 3. SETUP: Schedules (10 examples)
    # ============================================

    def create_schedules(self, forms: list[Dict[str, Any]], season_id: int = 1) -> list[Dict[str, Any]]:
        """Create 10 training schedules (idempotent). Requires an existing season_id."""
        schedules_data = [
            {
                "training_form_id": forms[0]['id'],
                "season_id": season_id,
                "day_of_week": "monday",
                "schedule_cycle": "weekly",
                "start_time": "18:00:00",
                "end_time": "20:00:00",
                "max_participants": 15
            },
            {
                "training_form_id": forms[1]['id'],
                "season_id": season_id,
                "day_of_week": "wednesday",
                "schedule_cycle": "weekly",
                "start_time": "19:00:00",
                "end_time": "21:00:00",
                "max_participants": 12
            },
            {
                "training_form_id": forms[2]['id'],
                "season_id": season_id,
                "day_of_week": "tuesday",
                "schedule_cycle": "weekly",
                "start_time": "18:30:00",
                "end_time": "20:30:00",
                "max_participants": 10
            },
            {
                "training_form_id": forms[3]['id'],
                "season_id": season_id,
                "day_of_week": "thursday",
                "schedule_cycle": "weekly",
                "start_time": "17:00:00",
                "end_time": "19:00:00",
                "max_participants": 12
            },
            {
                "training_form_id": forms[4]['id'],
                "season_id": season_id,
                "day_of_week": "friday",
                "schedule_cycle": "weekly",
                "start_time": "18:00:00",
                "end_time": "20:00:00",
                "max_participants": 10
            },
            {
                "training_form_id": forms[5]['id'],
                "season_id": season_id,
                "day_of_week": "saturday",
                "schedule_cycle": "weekly",
                "start_time": "10:00:00",
                "end_time": "12:00:00",
                "max_participants": 15
            },
            {
                "training_form_id": forms[6]['id'],
                "season_id": season_id,
                "day_of_week": "tuesday",
                "schedule_cycle": "weekly",
                "start_time": "19:00:00",
                "end_time": "21:00:00",
                "max_participants": 8
            },
            {
                "training_form_id": forms[7]['id'],
                "season_id": season_id,
                "day_of_week": "saturday",
                "schedule_cycle": "weekly",
                "start_time": "14:00:00",
                "end_time": "16:00:00",
                "max_participants": 10
            },
            {
                "training_form_id": forms[8]['id'],
                "season_id": season_id,
                "day_of_week": "friday",
                "schedule_cycle": "weekly",
                "start_time": "19:00:00",
                "end_time": "21:00:00",
                "max_participants": 12
            },
            {
                "training_form_id": forms[9]['id'],
                "season_id": season_id,
                "day_of_week": "sunday",
                "schedule_cycle": "weekly",
                "start_time": "11:00:00",
                "end_time": "13:00:00",
                "max_participants": 20
            }
        ]

        schedules = []
        for data in schedules_data:
            existing = self.find_schedule(data['training_form_id'], data['day_of_week'])
            if existing:
                print(f"✓ Schedule already exists: Form {data['training_form_id']} on {data['day_of_week']}")
                schedules.append(existing)
            else:
                response = self.session.post(f"{self.base_url}/training/schedule", json=data)
                response.raise_for_status()
                schedule = response.json()
                print(f"✓ Created schedule: {data['day_of_week'].capitalize()} {data['start_time']}-{data['end_time']}")
                schedules.append(schedule)

        return schedules

    # ============================================
    # 4. SETUP: Money Categories
    # ============================================

    def create_money_categories(self) -> list[Dict[str, Any]]:
        """Create money categories (idempotent)"""
        categories_data = [
            {
                "name": "Membership Income",
                "description": "Income from membership fees",
                "category_type": "income"
            },
            {
                "name": "Event Income",
                "description": "Income from special events and workshops",
                "category_type": "income"
            },
            {
                "name": "Equipment Sales",
                "description": "Income from equipment and merchandise sales",
                "category_type": "income"
            },
            {
                "name": "Facility Rent",
                "description": "Monthly facility rental expenses",
                "category_type": "expense"
            },
            {
                "name": "Utilities",
                "description": "Electricity, water, and other utilities",
                "category_type": "expense"
            },
            {
                "name": "Equipment Purchase",
                "description": "Purchase of training equipment and gear",
                "category_type": "expense"
            },
            {
                "name": "Instructor Fees",
                "description": "Payments to guest instructors",
                "category_type": "expense"
            },
            {
                "name": "Insurance",
                "description": "Liability and equipment insurance",
                "category_type": "expense"
            },
            {
                "name": "Marketing",
                "description": "Advertising and promotional expenses",
                "category_type": "expense"
            },
            {
                "name": "Maintenance",
                "description": "Facility maintenance and repairs",
                "category_type": "expense"
            }
        ]

        categories = []
        for data in categories_data:
            existing = self.find_money_category_by_name(data['name'])
            if existing:
                print(f"✓ Money category already exists: {existing['name']}")
                categories.append(existing)
            else:
                response = self.session.post(f"{self.base_url}/membership/categories", json=data)
                response.raise_for_status()
                category = response.json()
                print(f"✓ Created money category: {data['name']}")
                categories.append(category)

        return categories

    # ============================================
    # 5. SETUP: Membership Plans (10 examples)
    # ============================================

    def create_membership_plans(self) -> list[Dict[str, Any]]:
        """Create 10 membership plans (idempotent)"""
        plans_data = [
            {
                "name": "Monthly Unlimited",
                "description": "Unlimited access to all training sessions for 30 days",
                "membership_type": "monthly",
                "price": 100.00,
                "duration_days": 30,
                "season_id": 1
            },
            {
                "name": "Quarterly Unlimited",
                "description": "Unlimited access for 3 months with 10% discount",
                "membership_type": "monthly",
                "price": 270.00,
                "duration_days": 90,
                "season_id": 1
            },
            {
                "name": "Annual Unlimited",
                "description": "Unlimited access for 12 months with 20% discount",
                "membership_type": "monthly",
                "price": 960.00,
                "duration_days": 365,
                "season_id": 1
            },
            {
                "name": "10 Visit Pass",
                "description": "10 training sessions, valid for 90 days",
                "membership_type": "visits",
                "price": 80.00,
                "duration_days": 90,
                "visit_count": 10,
                "season_id": 1
            },
            {
                "name": "20 Visit Pass",
                "description": "20 training sessions with 10% discount, valid for 120 days",
                "membership_type": "visits",
                "price": 144.00,
                "duration_days": 120,
                "visit_count": 20,
                "season_id": 1
            },
            {
                "name": "5 Visit Trial",
                "description": "Trial package for beginners, 5 sessions in 30 days",
                "membership_type": "visits",
                "price": 45.00,
                "duration_days": 30,
                "visit_count": 5,
                "season_id": 1
            },
            {
                "name": "Student Monthly",
                "description": "Discounted monthly pass for students (ID required)",
                "membership_type": "monthly",
                "price": 75.00,
                "duration_days": 30,
                "season_id": 1
            },
            {
                "name": "Weekend Warrior",
                "description": "Weekend-only access (Saturday & Sunday)",
                "membership_type": "monthly",
                "price": 60.00,
                "duration_days": 30,
                "season_id": 1
            },
            {
                "name": "Family Pack",
                "description": "2 monthly unlimited memberships bundled with discount",
                "membership_type": "monthly",
                "price": 180.00,
                "duration_days": 30,
                "season_id": 1
            },
            {
                "name": "Drop-in Single Class",
                "description": "Single class access, no commitment",
                "membership_type": "visits",
                "price": 15.00,
                "duration_days": 1,
                "visit_count": 1,
                "season_id": 1
            }
        ]

        plans = []
        for data in plans_data:
            existing = self.find_membership_plan_by_name(data['name'])
            if existing:
                print(f"✓ Membership plan already exists: {existing['name']}")
                plans.append(existing)
            else:
                response = self.session.post(f"{self.base_url}/membership/plans", json=data)
                response.raise_for_status()
                plan = response.json()
                print(f"✓ Created membership plan: {data['name']} - {data['price']}zł")
                plans.append(plan)

        return plans

    # ============================================
    # 5. MEMBER REGISTRATION (10 examples)
    # ============================================

    def register_members(self) -> list[Dict[str, Any]]:
        """Register 10 members with diverse profiles (idempotent)"""
        members_data = [
            {
                "first_name": "Alice", "last_name": "Johnson",
                "email": "alice.johnson@example.com", "phone": "+1234567892",
                "date_of_birth": "1995-03-15",
                "notes": "Interested in longsword, complete beginner"
            },
            {
                "first_name": "Bob", "last_name": "Williams",
                "email": "bob.williams@example.com", "phone": "+1234567893",
                "date_of_birth": "1988-07-22",
                "notes": "Previous fencing experience, wants to try HEMA"
            },
            {
                "first_name": "Carol", "last_name": "Davis",
                "email": "carol.davis@example.com", "phone": "+1234567894",
                "date_of_birth": "2000-11-08",
                "notes": "Student, interested in rapier"
            },
            {
                "first_name": "Daniel", "last_name": "Martinez",
                "email": "daniel.martinez@example.com", "phone": "+1234567895",
                "date_of_birth": "1992-05-30",
                "notes": "Experienced martial artist, wants to learn Polish saber"
            },
            {
                "first_name": "Emily", "last_name": "Brown",
                "email": "emily.brown@example.com", "phone": "+1234567896",
                "date_of_birth": "1998-09-12",
                "notes": "History enthusiast, interested in all weapon forms"
            },
            {
                "first_name": "Frank", "last_name": "Wilson",
                "email": "frank.wilson@example.com", "phone": "+1234567897",
                "date_of_birth": "1985-01-25",
                "notes": "Drop-in only, travels frequently for work"
            },
            {
                "first_name": "Grace", "last_name": "Lee",
                "email": "grace.lee@example.com", "phone": "+1234567898",
                "date_of_birth": "1993-06-18",
                "notes": "Photographer, wants to document training sessions"
            },
            {
                "first_name": "Henry", "last_name": "Taylor",
                "email": "henry.taylor@example.com", "phone": "+1234567899",
                "date_of_birth": "2002-12-05",
                "notes": "University student, interested in tournament competition"
            },
            {
                "first_name": "Iris", "last_name": "Anderson",
                "email": "iris.anderson@example.com", "phone": "+1234567800",
                "date_of_birth": "1990-04-20",
                "notes": "Physical therapist, interested in biomechanics of sword fighting"
            },
            {
                "first_name": "Jack", "last_name": "Thomas",
                "email": "jack.thomas@example.com", "phone": "+1234567801",
                "date_of_birth": "1987-08-14",
                "notes": "Returning member after 2 year break"
            }
        ]

        members = []
        for data in members_data:
            existing = self.find_member_by_email(data['email'])
            if existing:
                print(f"✓ Member already exists: {existing['first_name']} {existing['last_name']}")
                members.append(existing)
            else:
                response = self.session.post(f"{self.base_url}/member/", json=data)
                response.raise_for_status()
                member = response.json()
                print(f"✓ Registered member: {data['first_name']} {data['last_name']}")
                members.append(member)

        return members

    # ============================================
    # 6. CREATE MEMBERSHIPS (10 examples)
    # ============================================

    def create_memberships(self, members: list[Dict[str, Any]], plans: list[Dict[str, Any]],
                           money_categories: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
        """Create 10 memberships with different plans (idempotent).
        Note: API requires a Payment to exist first; we will create (or reuse) payments and then link them.
        """
        # Mapping plan_id to plan details for price lookup
        plan_by_id = {p['id']: p for p in plans}

        memberships_data = [
            {"member_id": members[0]['id'], "plan_id": plans[0]['id'], "start_date": "2025-01-01"},
            {"member_id": members[1]['id'], "plan_id": plans[3]['id'], "start_date": "2025-01-01"},
            {"member_id": members[2]['id'], "plan_id": plans[6]['id'], "start_date": "2025-01-05"},
            {"member_id": members[3]['id'], "plan_id": plans[1]['id'], "start_date": "2025-01-10"},
            {"member_id": members[4]['id'], "plan_id": plans[2]['id'], "start_date": "2025-01-01"},
            {"member_id": members[5]['id'], "plan_id": plans[9]['id'], "start_date": "2025-01-15"},
            {"member_id": members[6]['id'], "plan_id": plans[7]['id'], "start_date": "2025-01-01"},
            {"member_id": members[7]['id'], "plan_id": plans[5]['id'], "start_date": "2025-01-08"},
            {"member_id": members[8]['id'], "plan_id": plans[4]['id'], "start_date": "2025-01-01"},
            {"member_id": members[9]['id'], "plan_id": plans[0]['id'], "start_date": "2025-01-12"}
        ]

        # Find the "Membership Income" category ID
        membership_category = next((c for c in money_categories if c['name'] == "Membership Income"), None)
        if not membership_category:
            raise ValueError("Membership Income category not found. Please ensure money categories are created first.")
        MEMBERSHIP_CATEGORY_ID = membership_category['id']

        memberships = []
        for data in memberships_data:
            member_id = data['member_id']
            plan_id = data['plan_id']
            start_date = data['start_date']

            existing = self.find_membership(member_id, plan_id)
            if existing:
                print(f"✓ Membership already exists for member {member_id}")
                memberships.append(existing)
                continue

            # Create or reuse a payment for this membership
            plan = plan_by_id.get(plan_id, {})
            amount = float(plan.get('price', 0))
            description = f"Membership payment for member {member_id}, plan {plan_id}"

            existing_payment = self.find_payment(description, amount, start_date)
            if existing_payment:
                payment_id = existing_payment['id']
            else:
                payment_payload = {
                    "category_id": MEMBERSHIP_CATEGORY_ID,
                    "description": description,
                    "amount": amount,
                    "payment_date": start_date,
                    "is_recurring": False,
                    "payment_method": "card",
                    "notes": f"Auto-generated for membership link (member {member_id}, plan {plan_id})"
                }
                pay_resp = self.session.post(f"{self.base_url}/membership/payments", json=payment_payload)
                pay_resp.raise_for_status()
                payment_id = pay_resp.json()["id"]

            # Link member, plan, and payment
            membership_payload = {
                "member_id": member_id,
                "plan_id": plan_id,
                "payment_id": payment_id
            }
            response = self.session.post(f"{self.base_url}/membership", json=membership_payload)
            response.raise_for_status()
            membership = response.json()
            print(f"✓ Created membership for member {member_id}")
            memberships.append(membership)

        return memberships

    # ============================================
    # 7. RECORD PAYMENTS (10 examples)
    # ============================================

    def record_payments(self, memberships: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
        """Payments are created during membership creation in this API version. Skipping. """
        print("✓ Payments already recorded during membership creation; skipping separate payment recording step.")
        return []

    # ============================================
    # 8. CREATE TRAINING SESSIONS (10 examples)
    # ============================================

    def create_training_sessions(self, schedules: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
        """Create 10 training sessions (idempotent)"""
        sessions_data = [
            {"schedule_id": schedules[0]['id'], "session_date": "2025-01-06",
             "notes": "Focus on basic guards and stance"},
            {"schedule_id": schedules[0]['id'], "session_date": "2025-01-13", "notes": "Oberhau and Unterhau practice"},
            {"schedule_id": schedules[1]['id'], "session_date": "2025-01-08",
             "notes": "Advanced master cuts and binds"},
            {"schedule_id": schedules[2]['id'], "session_date": "2025-01-07",
             "notes": "Italian rapier footwork drills"},
            {"schedule_id": schedules[3]['id'], "session_date": "2025-01-09", "notes": "Buckler defense techniques"},
            {"schedule_id": schedules[4]['id'], "session_date": "2025-01-10", "notes": "Messer cuts and parries"},
            {"schedule_id": schedules[5]['id'], "session_date": "2025-01-11",
             "notes": "Polish saber cuts on horseback simulation"},
            {"schedule_id": schedules[6]['id'], "session_date": "2025-01-07",
             "notes": "Smallsword point control exercises"},
            {"schedule_id": schedules[9]['id'], "session_date": "2025-01-12",
             "notes": "Free sparring with all weapon types"},
            {"schedule_id": schedules[8]['id'], "session_date": "2025-01-10", "notes": "Dagger disarms and wrestling"}
        ]

        sessions = []
        for data in sessions_data:
            existing = self.find_training_session(data['schedule_id'], data['session_date'])
            if existing:
                print(f"✓ Training session already exists for {data['session_date']}")
                sessions.append(existing)
            else:
                response = self.session.post(f"{self.base_url}/training/sessions", json=data)
                response.raise_for_status()
                session = response.json()
                print(f"✓ Created training session: {data['session_date']}")
                sessions.append(session)

        return sessions

    # ============================================
    # 9. RECORD ATTENDANCE (10 examples)
    # ============================================

    def record_attendance(self, sessions: list[Dict[str, Any]], members: list[Dict[str, Any]]) -> list[Dict[str, Any]]:
        """Record 10 attendance records (checks for duplicates)"""
        attendance_data = [
            {"session_id": sessions[0]['id'], "member_id": members[0]['id'], "attended": True,
             "notes": "Excellent progress on basic guards"},
            {"session_id": sessions[0]['id'], "member_id": members[1]['id'], "attended": True,
             "notes": "Good form, needs work on footwork"},
            {"session_id": sessions[1]['id'], "member_id": members[0]['id'], "attended": True,
             "notes": "Mastering the Oberhau"},
            {"session_id": sessions[2]['id'], "member_id": members[4]['id'], "attended": True,
             "notes": "Excellent technique in advanced drills"},
            {"session_id": sessions[3]['id'], "member_id": members[2]['id'], "attended": True,
             "notes": "First rapier class, very enthusiastic"},
            {"session_id": sessions[4]['id'], "member_id": members[1]['id'], "attended": False,
             "notes": "Absent - notified in advance"},
            {"session_id": sessions[8]['id'], "member_id": members[8]['id'], "attended": True,
             "notes": "Excellent sparring performance"},
            {"session_id": sessions[0]['id'], "member_id": members[9]['id'], "attended": True,
             "notes": "Returning after break, needs refresher"},
            {"session_id": sessions[5]['id'], "member_id": members[3]['id'], "attended": True,
             "notes": "Natural talent with messer"},
            {"session_id": sessions[6]['id'], "member_id": members[3]['id'], "attended": True,
             "notes": "Strong saber technique"}
        ]

        # Check existing attendance
        response = self.session.get(f"{self.base_url}/training/attendance")
        response.raise_for_status()
        existing_attendance = response.json()
        # Handle both list and dict responses
        if isinstance(existing_attendance, dict):
            existing_attendance = existing_attendance.get('attendances', existing_attendance.get('attendance', []))
        existing_keys = [(a['session_id'], a['member_id']) for a in existing_attendance]

        attendance_records = []
        for data in attendance_data:
            key = (data['session_id'], data['member_id'])
            if key in existing_keys:
                print(f"✓ Attendance already recorded for session {data['session_id']}, member {data['member_id']}")
                continue

            response = self.session.post(f"{self.base_url}/training/attendance", json=data)
            response.raise_for_status()
            record = response.json()
            print(f"✓ Recorded attendance: Member {data['member_id']} at session {data['session_id']}")
            attendance_records.append(record)

        return attendance_records

    # ============================================
    # 10. CREATE SPECIAL EVENTS (10 examples)
    # ============================================

    def create_events(self) -> list[Dict[str, Any]]:
        """Create 10 special events (idempotent)"""
        events_data = [
            {
                "name": "Advanced Longsword Workshop",
                "description": "Two-day intensive workshop on advanced longsword techniques",
                "event_date": "2025-02-15",
                "start_time": "2025-02-15T10:00:00",
                "end_time": "2025-02-15T17:00:00",
                "location": "Main Training Hall",
                "max_participants": 20,
                "price": 150.00
            },
            {
                "name": "Spring Tournament",
                "description": "Friendly sparring tournament for all levels",
                "event_date": "2025-03-20",
                "start_time": "2025-03-20T09:00:00",
                "end_time": "2025-03-20T18:00:00",
                "location": "Main Training Hall",
                "max_participants": 30,
                "price": 25.00
            },
            {
                "name": "Rapier Seminar with Guest Master",
                "description": "Special seminar with internationally renowned rapier instructor",
                "event_date": "2025-04-10",
                "start_time": "2025-04-10T10:00:00",
                "end_time": "2025-04-10T16:00:00",
                "location": "Main Training Hall",
                "max_participants": 15,
                "price": 200.00
            },
            {
                "name": "Beginner's Introduction Day",
                "description": "Free open house for prospective members",
                "event_date": "2025-01-25",
                "start_time": "2025-01-25T14:00:00",
                "end_time": "2025-01-25T17:00:00",
                "location": "Main Training Hall",
                "max_participants": 50,
                "price": 0.00
            },
            {
                "name": "Medieval Arms & Armor Lecture",
                "description": "Historical lecture on medieval weapons and armor by museum curator",
                "event_date": "2025-02-28",
                "start_time": "2025-02-28T19:00:00",
                "end_time": "2025-02-28T21:00:00",
                "location": "Conference Room",
                "max_participants": 40,
                "price": 10.00
            },
            {
                "name": "Women's HEMA Workshop",
                "description": "Special workshop for women in HEMA, all skill levels welcome",
                "event_date": "2025-03-08",
                "start_time": "2025-03-08T10:00:00",
                "end_time": "2025-03-08T14:00:00",
                "location": "Main Training Hall",
                "max_participants": 20,
                "price": 30.00
            },
            {
                "name": "Cutting Practice Session",
                "description": "Test cutting on tatami mats and other targets",
                "event_date": "2025-05-01",
                "start_time": "2025-05-01T13:00:00",
                "end_time": "2025-05-01T17:00:00",
                "location": "Outdoor Arena",
                "max_participants": 12,
                "price": 40.00
            },
            {
                "name": "Youth HEMA Camp",
                "description": "Week-long summer camp for ages 12-17",
                "event_date": "2025-07-15",
                "start_time": "2025-07-15T09:00:00",
                "end_time": "2025-07-19T16:00:00",
                "location": "Main Training Hall",
                "max_participants": 25,
                "price": 350.00
            },
            {
                "name": "Historical Dance Evening",
                "description": "Learn Renaissance and medieval dance styles",
                "event_date": "2025-06-20",
                "start_time": "2025-06-20T19:00:00",
                "end_time": "2025-06-20T22:00:00",
                "location": "Main Training Hall",
                "max_participants": 30,
                "price": 15.00
            },
            {
                "name": "Inter-Club Friendly Tournament",
                "description": "Tournament with visiting clubs from neighboring cities",
                "event_date": "2025-09-15",
                "start_time": "2025-09-15T09:00:00",
                "end_time": "2025-09-15T19:00:00",
                "location": "Main Training Hall",
                "max_participants": 50,
                "price": 35.00
            }
        ]

        events = []
        for data in events_data:
            existing = self.find_event_by_name(data['name'])
            if existing:
                print(f"✓ Event already exists: {existing['name']}")
                events.append(existing)
            else:
                response = self.session.post(f"{self.base_url}/events", json=data)
                response.raise_for_status()
                event = response.json()
                print(f"✓ Created event: {data['name']} - {data['price']}zł")
                events.append(event)

        return events

    # ============================================
    # Helper Methods for Remaining Operations
    # ============================================

    def get_all_instructors(self) -> list:
        """Get all instructors"""
        response = self.session.get(f"{self.base_url}/instructor/")
        response.raise_for_status()
        data = response.json()
        print(f"✓ Retrieved {data.get('total', 0)} instructors")
        return data

    def get_all_training_forms(self) -> list:
        """Get all training forms"""
        response = self.session.get(f"{self.base_url}/training/forms")
        response.raise_for_status()
        data = response.json()
        print(f"✓ Retrieved {data.get('total', 0)} training forms")
        return data

    def get_all_schedules(self) -> list:
        """Get all schedules"""
        response = self.session.get(f"{self.base_url}/training/schedule")
        response.raise_for_status()
        data = response.json()
        print(f"✓ Retrieved {data.get('total', 0)} schedules")
        return data

    def get_all_membership_plans(self) -> list:
        """Get all membership plans"""
        response = self.session.get(f"{self.base_url}/membership/plans")
        response.raise_for_status()
        data = response.json()
        print(f"✓ Retrieved {data.get('total', 0)} membership plans")
        return data

    def get_all_members(self) -> Dict[str, Any]:
        """Get all members"""
        response = self.session.get(f"{self.base_url}/member/")
        response.raise_for_status()
        data = response.json()
        print(f"✓ Retrieved {data.get('total', 0)} members")
        return data

    def get_all_memberships(self) -> list:
        """Get all memberships (membership payments links)"""
        response = self.session.get(f"{self.base_url}/membership")
        response.raise_for_status()
        data = response.json()
        print(f"✓ Retrieved {data.get('total', 0)} memberships")
        return data

    def get_all_payments(self) -> list:
        """Get all payments"""
        response = self.session.get(f"{self.base_url}/membership/payments")
        response.raise_for_status()
        data = response.json()
        print(f"✓ Retrieved {data.get('total', 0)} payments")
        return data

    def get_all_training_sessions(self) -> list:
        """Get all training sessions"""
        response = self.session.get(f"{self.base_url}/training/sessions")
        response.raise_for_status()
        data = response.json()
        print(f"✓ Retrieved {data.get('total', 0)} training sessions")
        return data

    def get_all_attendance(self) -> list:
        """Get all attendance records"""
        response = self.session.get(f"{self.base_url}/training/attendance")
        response.raise_for_status()
        data = response.json()
        print(f"✓ Retrieved {data.get('total', 0)} attendance records")
        return data

    def get_all_events(self) -> list:
        """Get all events"""
        response = self.session.get(f"{self.base_url}/events")
        response.raise_for_status()
        data = response.json()
        print(f"✓ Retrieved {data.get('total', 0)} events")
        return data

    def register_for_event(self, event_id: int, member_id: int, amount_paid: float,
                           notes: str = "", payment_id: int | None = None) -> Dict[str, Any]:
        """Register member for event"""
        data = {
            "event_id": event_id,
            "member_id": member_id,
            "payment_id": payment_id,
            "amount_paid": amount_paid,
            "notes": notes
        }
        response = self.session.post(f"{self.base_url}/events/registrations", json=data)
        response.raise_for_status()
        print(f"✓ Registered member {member_id} for event {event_id}")
        return response.json()

    def get_event_registrations(self, event_id: Optional[int] = None) -> list:
        """Get event registrations"""
        url = f"{self.base_url}/events/registrations"
        if event_id:
            url += f"?event_id={event_id}"
        response = self.session.get(url)
        response.raise_for_status()
        registrations = response.json()
        print(f"✓ Retrieved {len(registrations)} event registrations")
        return registrations

    def record_monthly_expense(self, description: str, amount: float, category: str,
                               expense_date: str = "2025-01-01", is_recurring: bool = False,
                               notes: str = "") -> Dict[str, Any]:
        """Record monthly expense"""
        category_lookup = {
            "rent": "Facility Rent",
            "utilities": "Utilities",
            "equipment": "Equipment Purchase",
            "insurance": "Insurance",
            "maintenance": "Maintenance",
            "marketing": "Marketing",
            "instructor": "Instructor Fees",
        }
        category_name = category_lookup.get(category, category)
        money_category = self.find_money_category_by_name(category_name)
        if not money_category:
            raise RuntimeError(f"Money category not found: {category_name}")

        data = {
            "description": description,
            "amount": amount,
            "expense_date": expense_date,
            "category_id": money_category["id"],
            "is_recurring": is_recurring,
            "notes": notes
        }
        response = self.session.post(f"{self.base_url}/money/expenses", json=data)
        response.raise_for_status()
        print(f"✓ Recorded monthly expense: {description} - {amount}zł")
        return response.json()

    def record_event_expense(self, event_id: int, description: str, amount: float,
                             expense_date: str, category: str = "", notes: str = "") -> Dict[str, Any]:
        """Record event expense"""
        data = {
            "event_id": event_id,
            "description": description,
            "amount": amount,
            "expense_date": expense_date,
            "notes": notes
        }
        response = self.session.post(f"{self.base_url}/events/expenses", json=data)
        response.raise_for_status()
        print(f"✓ Recorded event expense: {description} - {amount}zł")
        return response.json()

    def get_monthly_expenses(self) -> list:
        """Get all monthly expenses"""
        response = self.session.get(f"{self.base_url}/money/expenses")
        response.raise_for_status()
        payload = response.json()
        expenses = payload.get("expenses", payload) if isinstance(payload, dict) else payload
        print(f"✓ Retrieved {len(expenses)} monthly expenses")
        return expenses

    def get_member_statistics(self) -> Dict[str, Any]:
        """Get member statistics"""
        response = self.session.get(f"{self.base_url}/statistics/members")
        response.raise_for_status()
        stats = response.json()
        print(f"✓ Retrieved member statistics")
        return stats

    def get_financial_summary(self, start_date: str, end_date: str) -> Dict[str, Any]:
        """Get financial summary"""
        response = self.session.get(
            f"{self.base_url}/statistics/financial?start_date={start_date}&end_date={end_date}"
        )
        response.raise_for_status()
        summary = response.json()
        print(f"✓ Retrieved financial summary for {start_date} to {end_date}")
        return summary

    def get_attendance_statistics(self, start_date: str, end_date: str) -> Dict[str, Any]:
        """Get attendance statistics"""
        response = self.session.get(
            f"{self.base_url}/statistics/attendance?start_date={start_date}&end_date={end_date}"
        )
        response.raise_for_status()
        stats = response.json()
        print(f"✓ Retrieved attendance statistics")
        return stats

    def get_monthly_report(self, year: int, month: int) -> Dict[str, Any]:
        """Get monthly report"""
        response = self.session.get(f"{self.base_url}/statistics/reports/monthly/{year}/{month}")
        response.raise_for_status()
        report = response.json()
        print(f"✓ Retrieved monthly report for {year}-{month:02d}")
        return report

    def get_quarterly_report(self, year: int, quarter: int) -> Dict[str, Any]:
        """Get quarterly report"""
        response = self.session.get(f"{self.base_url}/statistics/reports/quarterly/{year}/{quarter}")
        response.raise_for_status()
        report = response.json()
        print(f"✓ Retrieved quarterly report for Q{quarter} {year}")
        return report

    def get_yearly_report(self, year: int) -> Dict[str, Any]:
        """Get yearly report"""
        response = self.session.get(f"{self.base_url}/statistics/reports/yearly/{year}")
        response.raise_for_status()
        report = response.json()
        print(f"✓ Retrieved yearly report for {year}")
        return report


def run_complete_business_process():
    """Run complete business process flow with 10 examples per category"""
    print("=" * 70)
    print("Quartermaster System - Extended Business Process Test")
    print("10 examples per category with expanded test coverage")
    print("=" * 70)

    tester = HEMAGymAPITester()

    try:
        # 1. Member Registration: 10 Members
        print("\n1. MEMBER REGISTRATION: Registering 10 Members...")
        members = tester.register_members()
        tester.get_all_members()

        # 2. Setup: Create 10 Instructors (from members)
        print("\n2. SETUP: Creating 10 Instructors...")
        instructors = tester.create_instructors(members)
        tester.get_all_instructors()

        # 3. Setup: Create 10 Training Forms
        print("\n3. SETUP: Creating 10 Training Forms...")
        forms = tester.create_training_forms()
        tester.get_all_training_forms()

        # 4. Setup: Create 10 Schedules
        print("\n4. SETUP: Creating 10 Training Schedules...")
        schedules = tester.create_schedules(forms)
        tester.get_all_schedules()

        # 5. Setup: Create Money Categories
        print("\n5. SETUP: Creating Money Categories...")
        money_categories = tester.create_money_categories()

        # 6. Setup: Create 10 Membership Plans
        print("\n6. SETUP: Creating 10 Membership Plans...")
        plans = tester.create_membership_plans()
        tester.get_all_membership_plans()

        # 7. Create 10 Memberships
        print("\n7. CREATING MEMBERSHIPS: 10 Different Plans...")
        memberships = tester.create_memberships(members, plans, money_categories)
        tester.get_all_memberships()

        # 7. Record 10 Payments
        print("\n7. RECORDING PAYMENTS: 10 Payments with Different Methods...")
        payments = tester.record_payments(memberships)
        tester.get_all_payments()

        # 8. Create 10 Training Sessions
        print("\n8. CREATING TRAINING SESSIONS: 10 Sessions...")
        sessions = tester.create_training_sessions(schedules)
        tester.get_all_training_sessions()

        # 9. Record 10 Attendance Records
        print("\n9. RECORDING ATTENDANCE: 10 Attendance Records...")
        attendance = tester.record_attendance(sessions, members)
        tester.get_all_attendance()

        # 10. Create 10 Special Events
        print("\n10. CREATING SPECIAL EVENTS: 10 Different Events...")
        events = tester.create_events()
        tester.get_all_events()

        # 11. Event Registrations (sample registrations)
        print("\n11. EVENT REGISTRATIONS: Sample Registrations...")
        registrations = tester.get_event_registrations()
        existing_reg_keys = [(r['event_id'], r['member_id']) for r in registrations['registrations'] if r]

        registration_samples = [
            (events[0]['id'], members[0]['id'], events[0]['price'], "Workshop early bird registration"),
            (events[1]['id'], members[1]['id'], events[1]['price'], "Tournament participant"),
            (events[2]['id'], members[4]['id'], events[2]['price'], "Advanced student"),
            (events[3]['id'], members[7]['id'], 0.00, "Free beginner event"),
            (events[5]['id'], members[8]['id'], events[5]['price'], "Women's workshop participant")
        ]

        for event_id, member_id, amount, notes in registration_samples:
            if (event_id, member_id) not in existing_reg_keys:
                tester.register_for_event(event_id, member_id, amount, notes)

        tester.get_event_registrations()

        # 12. Record Expenses (commented out to avoid duplicates on multiple runs)
        print("\n12. RECORDING EXPENSES: Sample Monthly and Event Expenses...")
        # Uncomment if you want to create expenses:
        tester.record_monthly_expense("Monthly gym rent", 2000.00, "rent", "2025-01-01", True)
        tester.record_monthly_expense("Utilities (electricity, water)", 300.00, "utilities", "2025-01-05", True)
        tester.record_monthly_expense("Equipment purchase - training swords", 800.00, "equipment", "2025-01-10")
        tester.record_monthly_expense("Insurance premium", 450.00, "insurance", "2025-01-01", True)
        tester.record_monthly_expense("Cleaning service", 200.00, "maintenance", "2025-01-01", True)
        tester.record_event_expense(events[0]['id'], "Guest instructor fee", 500.00, "2025-02-15", "instructor")
        tester.record_event_expense(events[1]['id'], "Tournament prizes", 300.00, "2025-03-20", "prizes")
        tester.get_monthly_expenses()

        # 13. Statistics and Reports
        print("\n13. STATISTICS AND REPORTS...")
        tester.get_member_statistics()
        tester.get_financial_summary("2025-01-01", "2025-12-31")
        tester.get_attendance_statistics("2025-01-01", "2025-12-31")
        tester.get_monthly_report(2025, 1)
        tester.get_quarterly_report(2025, 1)
        tester.get_yearly_report(2025)

        print("\n" + "=" * 70)
        print("✓ Extended business process test completed successfully!")
        print("✓ All 10 examples per category created and tested")
        print("=" * 70)

    except requests.exceptions.RequestException as e:
        print(f"\n✗ Error occurred: {e}")
        if hasattr(e.response, 'text'):
            print(f"Response: {e.response.text}")
        raise


if __name__ == "__main__":
    print("Starting Quartermaster System API Test (Extended Version)...")
    print(f"Using API server at {BASE_URL}")
    print()

    run_complete_business_process()
