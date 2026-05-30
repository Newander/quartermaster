"""
Fixture script to upload test expenses to the Quartermaster system
"""
import os
import requests
import random
from datetime import date, timedelta
from typing import Optional

BASE_URL = os.getenv("BASE_URL", "http://localhost:8080/api")


class ExpenseFixtureUploader:
    def __init__(self, base_url: str = BASE_URL):
        self.base_url = base_url
        self.session = requests.Session()

    def get_or_create_categories(self):
        """Get existing money categories or create them"""
        response = self.session.get(f"{self.base_url}/membership/categories")
        print(response.text)
        existing = response.json()
        if existing:
            print(f"Found {len(existing)} existing categories")
            return existing['categories']

    def create_expenses(self):
        """Create 20-30 diverse expenses"""
        categories = self.get_or_create_categories()
        if not categories:
            print("❌ No categories available. Cannot create expenses.")
            return
        get_random = lambda : random.choice(categories)['id']
        # Expense templates with realistic data
        expense_templates = [
            # Rent expenses
            {"category_id": get_random(), "description": "Monthly gym space rent", "amount": 2500.0, "is_recurring": True},
            {"category_id": get_random(), "description": "Storage room rental", "amount": 300.0, "is_recurring": True},

            # Utilities
            {"category_id": get_random(), "description": "Electricity bill", "amount": 450.0, "is_recurring": True},
            {"category_id": get_random(), "description": "Water and sewage", "amount": 120.0, "is_recurring": True},
            {"category_id": get_random(), "description": "Internet and phone", "amount": 180.0, "is_recurring": True},
            {"category_id": get_random(), "description": "Heating - winter months", "amount": 350.0, "is_recurring": False},

            # Equipment
            {"category_id": get_random(), "description": "New training swords (10 pcs)", "amount": 850.0, "is_recurring": False},
            {"category_id": get_random(), "description": "Protective gear set", "amount": 1200.0, "is_recurring": False},
            {"category_id": get_random(), "description": "Fencing masks (5 pcs)", "amount": 600.0, "is_recurring": False},
            {"category_id": get_random(), "description": "Training mats replacement", "amount": 950.0, "is_recurring": False},
            {"category_id": get_random(), "description": "Steel longswords (3 pcs)", "amount": 1500.0, "is_recurring": False},
            {"category_id": get_random(), "description": "Repair of damaged equipment", "amount": 230.0, "is_recurring": False},

            # Insurance
            {"category_id": get_random(), "description": "Liability insurance", "amount": 800.0, "is_recurring": True},
            {"category_id": get_random(), "description": "Property insurance", "amount": 400.0, "is_recurring": True},

            # Marketing
            {"category_id": get_random(), "description": "Social media advertising", "amount": 250.0, "is_recurring": True},
            {"category_id": get_random(), "description": "Website hosting and domain", "amount": 120.0, "is_recurring": True},
            {"category_id": get_random(), "description": "Promotional flyers printing", "amount": 180.0, "is_recurring": False},
            {"category_id": get_random(), "description": "Event banner design", "amount": 350.0, "is_recurring": False},

        ]

        created_count = 0
        failed_count = 0

        # Generate expenses over the last 3 months
        today = date.today()
        start_date = today - timedelta(days=90)

        for template in expense_templates:
            # Randomize expense date within the last 3 months
            days_ago = random.randint(0, 90)
            expense_date = today - timedelta(days=days_ago)

            # Add some variation to amounts (±10%)
            variation = random.uniform(0.9, 1.1)
            amount = round(template["amount"] * variation, 2)

            expense_data = {
                "category_id": template['category_id'],
                "description": template["description"],
                "amount": amount,
                "expense_date": expense_date.isoformat(),
                "is_recurring": template["is_recurring"],
                "status": "PAID",
                "notes": f"Generated fixture data for testing purposes"
            }

            try:
                response = self.session.post(
                    f"{self.base_url}/money/expenses",
                    json=expense_data
                )

                print(response.text)
                if response.status_code in [200, 201]:
                    created_count += 1
                    expense = response.json()
                    print(f"✓ Created expense #{expense['id']}: {template['description']} - ${amount}")
                else:
                    failed_count += 1
                    print(f"❌ Failed to create expense: {template['description']}")
                    print(f"   Status: {response.status_code}, Response: {response.text}")

            except Exception as e:
                failed_count += 1
                print(f"❌ Error creating expense: {template['description']}")
                print(f"   Error: {str(e)}")

        print(f"\n{'='*60}")
        print(f"Expense upload complete!")
        print(f"✓ Successfully created: {created_count} expenses")
        if failed_count > 0:
            print(f"❌ Failed: {failed_count} expenses")
        print(f"{'='*60}")


def main():
    """Main function to run the expense fixture uploader"""
    print("Starting expense fixture upload...\n")

    uploader = ExpenseFixtureUploader()
    uploader.create_expenses()

    print("\n✓ Expense fixture upload process completed!")


if __name__ == "__main__":
    main()
