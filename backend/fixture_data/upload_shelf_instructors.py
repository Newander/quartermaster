"""
Quartermaster System - Extended API Test Script
Adds missing entities: Seasons, MoneyCategories, TrainingZones, Contracts, Shelves
"""
import os
import requests
from datetime import datetime, date, timedelta
from typing import Dict, Any, Optional

BASE_URL = os.getenv("BASE_URL", "http://localhost:8080/api")


class HEMAGymExtendedTester:
    """Extended test client for missing entities"""

    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.session = requests.Session()
        self.session.headers.update({"Content-Type": "application/json"})

    # ============================================
    # FOUNDATION: Seasons
    # ============================================

    def create_seasons(self) -> list[Dict[str, Any]]:
        """Create seasons (idempotent)"""
        seasons_data = [
            {
                "name": "2025 Season",
                "start_date": "2025-01-01",
                "end_date": "2025-12-31"
            },
            {
                "name": "2024 Season",
                "start_date": "2024-01-01",
                "end_date": "2024-12-31"
            }
        ]

        seasons = []
        for data in seasons_data:
            try:
                response = self.session.post(f"{self.base_url}/training/seasons", json=data)
                response.raise_for_status()
                season = response.json()
                print(f"✓ Created season: {data['name']}")
                seasons.append(season)
            except requests.exceptions.HTTPError as e:
                if e.response.status_code == 400:
                    print(f"✓ Season already exists: {data['name']}")
                    # Try to get it
                    resp = self.session.get(f"{self.base_url}/training/seasons")
                    resp.raise_for_status()
                    all_seasons = resp.json().get('seasons', [])
                    for s in all_seasons:
                        if s['name'] == data['name']:
                            seasons.append(s)
                            break
                else:
                    raise

        return seasons

    # ============================================
    # FOUNDATION: Money Categories
    # ============================================

    def create_money_categories(self) -> list[Dict[str, Any]]:
        """Create money categories (idempotent)"""
        categories_data = [
            {"name": "membership"},
            {"name": "event_registration"},
            {"name": "shelf_rental"},
            {"name": "rent"},
            {"name": "utilities"},
            {"name": "equipment"},
            {"name": "insurance"},
            {"name": "maintenance"},
            {"name": "instructor_fees"},
            {"name": "other"}
        ]

        categories = []
        for data in categories_data:
            try:
                response = self.session.post(f"{self.base_url}/membership/categories", json=data)
                response.raise_for_status()
                category = response.json()
                print(f"✓ Created money category: {data['name']}")
                categories.append(category)
            except requests.exceptions.HTTPError as e:
                if e.response.status_code == 400:
                    print(f"✓ Money category already exists: {data['name']}")
                    # Try to get it
                    resp = self.session.get(f"{self.base_url}/membership/categories")
                    resp.raise_for_status()
                    all_cats = resp.json().get('categories', [])
                    for c in all_cats:
                        if c['name'] == data['name']:
                            categories.append(c)
                            break
                else:
                    raise

        return categories

    # ============================================
    # FOUNDATION: Training Zones
    # ============================================

    def create_training_zones(self) -> list[Dict[str, Any]]:
        """Create training zones (idempotent)"""
        zones_data = [
            {
                "name": "Main Hall - Zone A",
                "size": "15m x 10m",
                "description": "Primary training area with full equipment"
            },
            {
                "name": "Main Hall - Zone B",
                "size": "15m x 10m",
                "description": "Secondary training area"
            },
            {
                "name": "Sparring Area",
                "size": "20m x 15m",
                "description": "Large open area for sparring and competitions"
            },
            {
                "name": "Equipment Room",
                "size": "8m x 6m",
                "description": "Storage and equipment area"
            },
            {
                "name": "Outdoor Arena",
                "size": "25m x 20m",
                "description": "Outdoor training and cutting practice area"
            }
        ]

        zones = []
        for data in zones_data:
            try:
                response = self.session.post(f"{self.base_url}/training/zones", json=data)
                response.raise_for_status()
                zone = response.json()
                print(f"✓ Created training zone: {data['name']}")
                zones.append(zone)
            except requests.exceptions.HTTPError as e:
                if e.response.status_code == 400:
                    print(f"✓ Training zone might already exist: {data['name']}")
                else:
                    print(f"⚠ Error creating zone {data['name']}: {e}")

        return zones

    # ============================================
    # CONTRACTS
    # ============================================

    def create_contracts(self) -> list[Dict[str, Any]]:
        """Create contracts (idempotent)"""
        contracts_data = [
            {
                "title": "Standard Membership Agreement",
                "description": "Standard terms and conditions for gym membership",
                "version": "1.0",
                "effective_from": "2025-01-01"
            },
            {
                "title": "Waiver of Liability",
                "description": "Standard liability waiver for HEMA training",
                "version": "1.0",
                "effective_from": "2025-01-01"
            },
            {
                "title": "Photo/Video Release",
                "description": "Permission to use photos and videos for promotional purposes",
                "version": "1.0",
                "effective_from": "2025-01-01"
            },
            {
                "title": "Equipment Usage Agreement",
                "description": "Terms for using gym equipment",
                "version": "1.0",
                "effective_from": "2025-01-01"
            },
            {
                "title": "Code of Conduct",
                "description": "Expected behavior and conduct guidelines",
                "version": "1.0",
                "effective_from": "2025-01-01"
            }
        ]

        contracts = []
        for data in contracts_data:
            try:
                response = self.session.post(f"{self.base_url}/contract/", json=data)
                response.raise_for_status()
                contract = response.json()
                print(f"✓ Created contract: {data['title']}")
                contracts.append(contract)
            except requests.exceptions.HTTPError as e:
                if e.response.status_code == 400:
                    print(f"✓ Contract already exists: {data['title']}")
                else:
                    print(f"⚠ Error creating contract: {e}")

        return contracts

    def sign_contracts(self, members: list[Dict[str, Any]], contracts: list[Dict[str, Any]]):
        """Have members sign contracts"""
        if not contracts or not members:
            print("⚠ No contracts or members to sign")
            return

        # Have first 5 members sign first 2 contracts
        for i in range(min(5, len(members))):
            member_id = members[i]['id']
            for j in range(min(2, len(contracts))):
                contract_id = contracts[j]['id']
                try:
                    payload = {
                        "contract_id": contract_id,
                        "signed": True,
                        "signed_at": datetime.now().isoformat(),
                        "notes": "Signed during registration"
                    }
                    response = self.session.post(
                        f"{self.base_url}/contract/member/{member_id}/contract",
                        json=payload
                    )
                    response.raise_for_status()
                    print(f"✓ Member {member_id} signed contract {contract_id}")
                except requests.exceptions.HTTPError as e:
                    if e.response.status_code == 400:
                        print(f"✓ Member {member_id} already signed contract {contract_id}")
                    else:
                        print(f"⚠ Error: {e}")

    # ============================================
    # SHELF SYSTEM
    # ============================================

    def create_shelves(self) -> list[Dict[str, Any]]:
        """Create shelves/lockers (idempotent)"""
        shelves_data = []
        # Create 20 shelves
        for i in range(1, 21):
            shelves_data.append({
                "shelf_number": f"L-{i:03d}",
                "location": "Main Hall - Locker Area",
                "size": "medium",
                "description": f"Standard locker #{i}"
            })

        shelves = []
        for data in shelves_data:
            try:
                response = self.session.post(f"{self.base_url}/shelves/shelves", json=data)
                response.raise_for_status()
                shelf = response.json()
                shelves.append(shelf)
            except requests.exceptions.HTTPError as e:
                if e.response.status_code == 400:
                    # Already exists
                    pass
                else:
                    print(f"⚠ Error creating shelf {data['shelf_number']}: {e}")

        print(f"✓ Created/verified {len(shelves)} shelves")
        return shelves

    def create_shelf_plans(self) -> list[Dict[str, Any]]:
        """Create shelf rental plans (idempotent)"""
        plans_data = [
            {
                "name": "Monthly Locker",
                "description": "30-day locker rental",
                "price": 10.00,
                "duration_days": 30
            },
            {
                "name": "Quarterly Locker",
                "description": "90-day locker rental with discount",
                "price": 25.00,
                "duration_days": 90
            },
            {
                "name": "Annual Locker",
                "description": "Full year locker rental",
                "price": 80.00,
                "duration_days": 365
            }
        ]

        plans = []
        for data in plans_data:
            try:
                response = self.session.post(f"{self.base_url}/shelves/plans", json=data)
                response.raise_for_status()
                plan = response.json()
                print(f"✓ Created shelf plan: {data['name']}")
                plans.append(plan)
            except requests.exceptions.HTTPError as e:
                if e.response.status_code == 400:
                    print(f"✓ Shelf plan already exists: {data['name']}")
                else:
                    print(f"⚠ Error: {e}")

        return plans

    def create_shelf_rentals(self, shelves: list[Dict[str, Any]], 
                           shelf_plans: list[Dict[str, Any]], 
                           members: list[Dict[str, Any]]):
        """Create shelf rentals for members"""
        if not shelves or not shelf_plans or not members:
            print("⚠ Missing data for shelf rentals")
            return

        # Rent first 5 shelves to first 5 members
        rentals = []
        for i in range(min(5, len(shelves), len(members))):
            try:
                payload = {
                    "shelf_id": shelves[i]['id'],
                    "member_id": members[i]['id'],
                    "plan_id": shelf_plans[0]['id'],  # Monthly plan
                    "start_date": "2025-01-01",
                    "payment_amount": shelf_plans[0]['price'],
                    "payment_method": "card",
                    "notes": f"Rental for {members[i]['first_name']}"
                }
                response = self.session.post(f"{self.base_url}/shelves/rentals", json=payload)
                response.raise_for_status()
                rental = response.json()
                print(f"✓ Created shelf rental for member {members[i]['first_name']}")
                rentals.append(rental)
            except requests.exceptions.HTTPError as e:
                print(f"⚠ Error creating rental: {e}")

        return rentals


def run_extended_setup():
    """Run extended setup for missing entities"""
    print("=" * 70)
    print("HEMA Gym - Extended Setup (Missing Entities)")
    print("=" * 70)

    tester = HEMAGymExtendedTester()

    try:
        # Phase 0: Foundation
        print("\n=== PHASE 0: FOUNDATION SETUP ===")
        
        print("\n1. Creating Seasons...")
        seasons = tester.create_seasons()
        
        print("\n2. Creating Money Categories...")
        categories = tester.create_money_categories()
        
        print("\n3. Creating Training Zones...")
        zones = tester.create_training_zones()

        # Phase 1: Contracts
        print("\n=== PHASE 1: CONTRACTS ===")
        
        print("\n4. Creating Contracts...")
        contracts = tester.create_contracts()
        
        # Get existing members
        print("\n5. Getting existing members for contract signing...")
        members_resp = tester.session.get(f"{tester.base_url}/member/")
        members_resp.raise_for_status()
        members = members_resp.json().get('members', [])[:5]  # First 5
        
        if members and contracts:
            print("\n6. Signing contracts...")
            tester.sign_contracts(members, contracts)

        # Phase 2: Shelf System
        print("\n=== PHASE 2: SHELF SYSTEM ===")
        
        print("\n7. Creating Shelves/Lockers...")
        shelves = tester.create_shelves()
        
        print("\n8. Creating Shelf Plans...")
        shelf_plans = tester.create_shelf_plans()
        
        if shelves and shelf_plans and members:
            print("\n9. Creating Shelf Rentals...")
            tester.create_shelf_rentals(shelves, shelf_plans, members)

        print("\n" + "=" * 70)
        print("✓ Extended setup completed successfully!")
        print("✓ All foundation entities created")
        print("=" * 70)

    except requests.exceptions.RequestException as e:
        print(f"\n✗ Error occurred: {e}")
        if hasattr(e, 'response') and e.response is not None:
            print(f"Response: {e.response.text}")
        raise


if __name__ == "__main__":
    print("Starting HEMA Gym Extended Setup...")
    print(f"Using API server at {BASE_URL}")
    print()

    run_extended_setup()
