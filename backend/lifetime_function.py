import json
import logging
from contextlib import asynccontextmanager
from datetime import date, timedelta
from pathlib import Path

from apscheduler.schedulers.asyncio import AsyncIOScheduler
from fastapi import FastAPI
from sqlalchemy.orm import Session

from app.database import engine, Base, SessionLocal
from app.enums import PaymentStatus
from app.models import Member, MembershipPlan, TrainingForm, Contract, Shelf, Payment, Expense
from app.search_engine import SearchDict, SearchResult

Scheduler = AsyncIOScheduler()
LookupMap = SearchDict(max_search_word_size=50)


def update_recurrent_payments():
    db = SessionLocal()
    try:
        payments = db.query(Payment).filter(
            Payment.is_recurring == True,
            Payment.status == PaymentStatus.PAID,
            Payment.payment_date > (date.today() - timedelta(days=60)),
        ).order_by(Payment.payment_date.desc()).all()

        unique_payments = {}
        for payment in payments:
            if prev_payment := unique_payments.get(payment.description):
                if payment.payment_date > prev_payment.payment_date:
                    unique_payments[payment.description] = payment
            else:
                unique_payments[payment.description] = payment

        logging.info(f"Recurring payments found: {len(unique_payments)}")
        first_day_of_month = date.today().replace(day=1)
        for payment in unique_payments.values():
            if payment.payment_date > first_day_of_month:
                continue

            db.add(
                Payment(
                    category_id=payment.category_id,
                    description=payment.description,
                    amount=payment.amount,
                    payment_date=payment.payment_date,
                    is_recurring=payment.is_recurring,
                    payment_method=PaymentStatus.SCHEDULED,
                    status=payment.status,
                    notes=payment.notes,
                )
            )
        db.commit()
        logging.info("Update Recurrent payments completed")
    except:
        logging.error("[Not successful] Update Recurrent payments failed")
        raise
    finally:
        db.close()


def update_status_payments():
    db = SessionLocal()
    try:
        payments = db.query(Payment).filter(
            Payment.is_recurring == True,
            Payment.status == PaymentStatus.SCHEDULED,
            Payment.payment_date < (date.today() - timedelta(days=90)),
        ).order_by(Payment.payment_date.desc()).all()

        for payment in payments:
            payment.status = PaymentStatus.OVERDUE

        logging.info(f"Scheduled payments with payment date more than 3 months were found: {len(payments)}")
        db.commit()
        logging.info("Update payment status completed")
    except:
        logging.error("[Not successful] Periodic Update payment status failed")
        raise
    finally:
        db.close()


def update_recurrent_expenses():
    db = SessionLocal()
    try:
        expenses = db.query(Expense).filter(
            Expense.is_recurring == True,
            Expense.status == PaymentStatus.PAID,
            Expense.expense_date > (date.today() - timedelta(days=60)),
        ).order_by(Expense.expense_date.desc()).all()

        unique_expenses = {}
        for expense in expenses:
            if prev_expense := unique_expenses.get(expense.description):
                if expense.expense_date > prev_expense.expense_date:
                    unique_expenses[expense.description] = expense
            else:
                unique_expenses[expense.description] = expense

        logging.info(f"Recurring expenses found: {len(unique_expenses)}")
        first_day_of_month = date.today().replace(day=1)
        for expense in unique_expenses.values():
            if expense.expense_date > first_day_of_month:
                continue

            db.add(
                Expense(
                    category_id=expense.category_id,
                    description=expense.description,
                    amount=expense.amount,
                    expense_date=expense.expense_date,
                    is_recurring=expense.is_recurring,
                    status=expense.status,
                    notes=expense.notes,
                )
            )
        db.commit()
        logging.info("Update Recurrent expenses completed")
    except:
        logging.error("[Not successful] Update Recurrent expenses failed")
        raise
    finally:
        db.close()


def update_search_map(db: Session):
    logging.info(f"Updating {LookupMap=}")

    for member in db.query(Member).filter(Member.is_deleted == False).all():  # type: Member
        profile = f'{member.first_name.capitalize()} {member.last_name.capitalize()}'
        for search_by in (member.email, member.phone):
            LookupMap.add(
                f'{profile} {search_by}',
                SearchResult(path=f'/members/{member.id}',
                             caption=f'{profile}: {search_by}')
            )
    for plan in db.query(MembershipPlan).filter(MembershipPlan.is_deleted == False).all():  # type: MembershipPlan
        LookupMap.add(
            plan.name,
            SearchResult(path=f'/memberships/{plan.id}',
                         caption=f'Plan {plan.name}')
        )
    for form in db.query(TrainingForm).all():  # type: TrainingForm
        LookupMap.add(
            form.name,
            SearchResult(path=f'/training-forms/{form.id}',
                         caption=f'Form {form.name}')
        )
    for contract in db.query(Contract).all():  # type: Contract
        LookupMap.add(
            contract.title,
            SearchResult(path=f'/contracts/{contract.id}',
                         caption=f'Contract {contract.title}')
        )
    for shelf in db.query(Shelf).filter(Shelf.is_deleted == False).all():  # type: Shelf
        rack_name = shelf.rack.name if shelf.rack else "Default rack"
        LookupMap.add(
            f'{shelf.shelf_number} {rack_name} {shelf.description or ""}',
            SearchResult(path=f'/shelves/{shelf.id}',
                         caption=f'Shelf {shelf.shelf_number}/{rack_name}')
        )
    LookupMap.sort()
    logging.info(
        f"Updated {LookupMap=} of occupied size {LookupMap.memory_usage_readable()} "
        f"and overall size {LookupMap.items_num()}"
    )


def update_search_lookup_object_periodically():
    """This runs periodically"""
    db = SessionLocal()
    try:
        update_search_map(db)
        logging.info("Periodic search map update completed")
    except:
        logging.error("[Not successful] Periodic search map update failed")
        raise
    finally:
        db.close()


# Create database tables
@asynccontextmanager
async def lifespan_callback(app: FastAPI):
    # Database stuff
    Base.metadata.create_all(bind=engine)
    logging.info(f"Starting filling {LookupMap=}")

    for search_word, path in [
        ("dashboard", "dashboard"),
        ("pulpit", "dashboard"),
        ("members", "members"),
        ("Członkowie", "members"),
        ("instructors", "instructors"),
        ("Instruktorzy", "instructors"),
        ("schedule", "schedule"),
        ("sessions", "sessions"),
        ("memberships", "memberships"),
        ("Członkostwa", "memberships"),
        ("training-forms", "training-forms"),
        ("Formy treningowe", "training-forms"),
        ("income", "finance/income"),
        ("Przychody", "finance/income"),
        ("expenses", "finance/expenses"),
        ("Wydatki", "finance/expenses"),
        ("checkpoints", "finance/checkpoints"),
        ("Checkpointy", "finance/checkpoints"),
        ("reports", "finance/reports"),
        ("Raporty", "finance/reports"),
        ("analytics", "analytics"),
        ("contracts", "contracts"),
        ("Umowy", "contracts"),
        ("shelves", "shelves"),
        ("Szafki", "shelves"),
        ("Półki", "shelves"),
        ("shelf-plans", "shelf-plans"),
        ("Wynajmy Półek", "shelf-plans"),
        ("shelf-rentals", "shelf-rentals"),
        ("Wynajem Półek", "shelf-rentals"),
    ]:
        LookupMap.add(
            search_word,
            SearchResult(path=path, caption=f"{search_word.capitalize()} page")
        )

    db = SessionLocal()
    update_search_map(db)
    db.close()
    logging.info("Finished")

    # Update OpenAPI doc
    Scheduler.add_job(update_search_lookup_object_periodically, 'interval', minutes=7.5)

    update_recurrent_payments()
    update_status_payments()
    update_recurrent_expenses()

    Scheduler.add_job(update_recurrent_payments, 'cron', hour=0, minute=5)
    Scheduler.add_job(update_status_payments, 'cron', hour=0, minute=10)
    Scheduler.add_job(update_recurrent_expenses, 'cron', hour=0, minute=15)
    Scheduler.start()
    logging.info("Scheduler started")

    yield

    Scheduler.shutdown()
    logging.info("Scheduler stopped")
