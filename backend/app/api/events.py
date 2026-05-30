"""
Events and expenses API endpoints
"""
from datetime import date
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models import Member, Payment
from app.models.event import Event, EventRegistration, EventExpense
from app.schemas.event import (
    EventCreate,
    EventUpdate,
    EventResponse,
    EventListResponse,
    EventRegistrationCreate,
    EventRegistrationUpdate,
    EventRegistrationResponse,
    EventRegistrationListResponse,
    EventExpenseCreate,
    EventExpenseUpdate,
    EventExpenseResponse,
    EventExpenseListResponse,
)

router = APIRouter()


# Events endpoints
@router.post("/", response_model=EventResponse, status_code=status.HTTP_201_CREATED)
def create_event(event: EventCreate, db: Session = Depends(get_db)):
    """Create a new event"""
    db_event = Event(**event.model_dump())
    db.add(db_event)
    db.commit()
    db.refresh(db_event)
    return db_event


@router.get("/", response_model=EventListResponse)
def get_events(
        skip: int = 0,
        limit: int = 100,
        is_closed: Optional[bool] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        db: Session = Depends(get_db)
):
    """Get all events"""
    query = db.query(Event).options(
        selectinload(Event.registrations),
        selectinload(Event.expenses),
    )
    if is_closed is not None:
        query = query.filter(Event.is_closed == is_closed)
    if start_date:
        query = query.filter(Event.event_date >= start_date)
    if end_date:
        query = query.filter(Event.event_date <= end_date)

    total = query.count()
    events = query.offset(skip).limit(limit).all()
    return {"total": total, "events": events}


@router.get("/registrations", response_model=EventRegistrationListResponse)
def get_event_registrations(
        skip: int = 0,
        limit: int = 100,
        event_id: Optional[int] = None,
        member_id: Optional[int] = None,
        db: Session = Depends(get_db)
):
    """Get event registrations"""
    query = db.query(EventRegistration).options(
        selectinload(EventRegistration.event),
        selectinload(EventRegistration.member),
        selectinload(EventRegistration.payment),
    )
    if event_id is not None:
        query = query.filter(EventRegistration.event_id == event_id)
    if member_id is not None:
        query = query.filter(EventRegistration.member_id == member_id)

    total = query.count()
    registrations = query.offset(skip).limit(limit).all()
    return {"total": total, "registrations": registrations}


@router.get("/{event_id}", response_model=EventResponse)
def get_event(event_id: int, db: Session = Depends(get_db)):
    """Get a specific event"""
    event = db.query(Event).options(
        selectinload(Event.registrations),
        selectinload(Event.expenses),
    ).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")
    return event


@router.put("/{event_id}", response_model=EventResponse)
def update_event(event_id: int, event_update: EventUpdate, db: Session = Depends(get_db)):
    """Update an event"""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    update_data = event_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(event, field, value)

    db.commit()
    db.refresh(event)
    return event


@router.delete("/{event_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event(event_id: int, db: Session = Depends(get_db)):
    """Delete an event"""
    event = db.query(Event).filter(Event.id == event_id).first()
    if not event:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event not found")

    db.delete(event)
    db.commit()
    return None


# Event Registrations endpoints
@router.post("/registrations", response_model=EventRegistrationResponse, status_code=status.HTTP_201_CREATED)
def create_event_registration(registration: EventRegistrationCreate, db: Session = Depends(get_db)):
    """Register a member for an event"""
    # Validate event exists
    event = db.get(Event, registration.event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {registration.event_id} not found"
        )

    # Validate member exists if provided
    if registration.member_id:
        member = db.get(Member, registration.member_id)
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Member with ID {registration.member_id} not found"
            )

    # Validate payment exists if provided
    if registration.payment_id:
        payment = db.get(Payment, registration.payment_id)
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Payment with ID {registration.payment_id} not found"
            )

    db_registration = EventRegistration(**registration.model_dump())
    db.add(db_registration)
    db.commit()
    db.refresh(db_registration)
    return db_registration


@router.get("/registrations/{registration_id}", response_model=EventRegistrationResponse)
def get_event_registration(registration_id: int, db: Session = Depends(get_db)):
    """Get a specific event registration"""
    registration = db.query(EventRegistration).options(
        selectinload(EventRegistration.event),
        selectinload(EventRegistration.member),
        selectinload(EventRegistration.payment),
    ).filter(EventRegistration.id == registration_id).first()
    if not registration:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event registration not found")
    return registration


@router.put("/registrations/{registration_id}", response_model=EventRegistrationResponse)
def update_event_registration(
        registration_id: int,
        registration_update: EventRegistrationUpdate,
        db: Session = Depends(get_db)
):
    """Update an event registration"""
    registration = db.query(EventRegistration).filter(EventRegistration.id == registration_id).first()
    if not registration:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event registration not found")

    update_data = registration_update.model_dump(exclude_unset=True)

    # Validate member if being updated
    if 'member_id' in update_data and update_data['member_id']:
        member = db.get(Member, update_data['member_id'])
        if not member:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Member with ID {update_data['member_id']} not found"
            )

    # Validate payment if being updated
    if 'payment_id' in update_data and update_data['payment_id']:
        payment = db.get(Payment, update_data['payment_id'])
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Payment with ID {update_data['payment_id']} not found"
            )

    for field, value in update_data.items():
        setattr(registration, field, value)

    db.commit()
    db.refresh(registration)
    return registration


@router.delete("/registrations/{registration_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event_registration(registration_id: int, db: Session = Depends(get_db)):
    """Delete an event registration"""
    registration = db.query(EventRegistration).filter(EventRegistration.id == registration_id).first()
    if not registration:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event registration not found")

    db.delete(registration)
    db.commit()
    return None


# Event Expenses endpoints
@router.post("/expenses", response_model=EventExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_event_expense(expense: EventExpenseCreate, db: Session = Depends(get_db)):
    """Create a new event expense"""
    # Validate event exists
    event = db.get(Event, expense.event_id)
    if not event:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Event with ID {expense.event_id} not found"
        )

    db_expense = EventExpense(**expense.model_dump())
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense


@router.get("/expenses", response_model=EventExpenseListResponse)
def get_event_expenses(
        skip: int = 0,
        limit: int = 100,
        # Ordering
        order_by_col: str | None = None,
        order_by_asc: Literal['asc', 'desc'] = 'desc',
        # Filtering
        event_id: Optional[int] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        db: Session = Depends(get_db)
):
    """Get event expenses"""
    query = db.query(EventExpense).options(
        selectinload(EventExpense.event)
    )
    if event_id is not None:
        query = query.filter(EventExpense.event_id == event_id)
    if start_date is not None:
        query = query.filter(EventExpense.expense_date >= start_date)
    if end_date is not None:
        query = query.filter(EventExpense.expense_date <= end_date)

    total = query.count()
    order_col = getattr(EventExpense, order_by_col) if order_by_col else EventExpense.id
    expenses = query.order_by(
        order_col.asc() if order_by_asc == 'asc' else order_col.desc()
    ).offset(skip).limit(limit).all()
    return {"total": total, "expenses": expenses}


@router.get("/expenses/{expense_id}", response_model=EventExpenseResponse)
def get_event_expense(expense_id: int, db: Session = Depends(get_db)):
    """Get a specific event expense"""
    expense = db.query(EventExpense).options(
        selectinload(EventExpense.event)
    ).filter(EventExpense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event expense not found")
    return expense


@router.put("/expenses/{expense_id}", response_model=EventExpenseResponse)
def update_event_expense(
        expense_id: int,
        expense_update: EventExpenseUpdate,
        db: Session = Depends(get_db)
):
    """Update an event expense"""
    expense = db.query(EventExpense).filter(EventExpense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event expense not found")

    update_data = expense_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(expense, field, value)

    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_event_expense(expense_id: int, db: Session = Depends(get_db)):
    """Delete an event expense"""
    expense = db.query(EventExpense).filter(EventExpense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Event expense not found")

    db.delete(expense)
    db.commit()
    return None
