"""
Events and expenses API endpoints
"""
from datetime import date
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.models.money import Expense, MoneyCategory
from app.schemas.event import (
    ExpenseCreate,
    ExpenseUpdate,
    ExpenseResponse,
    ExpenseListResponse,
)

router = APIRouter()


# General Expenses endpoints (monthly/recurring expenses)
@router.post("/expenses", response_model=ExpenseResponse, status_code=status.HTTP_201_CREATED)
def create_general_expense(expense: ExpenseCreate, db: Session = Depends(get_db)):
    """Create a new general expense (monthly/recurring)"""
    # Validate category exists
    category = db.get(MoneyCategory, expense.category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Money category with ID {expense.category_id} not found"
        )

    db_expense = Expense(**expense.model_dump())
    db.add(db_expense)
    db.commit()
    db.refresh(db_expense)
    return db_expense


@router.get("/expenses", response_model=ExpenseListResponse)
def get_general_expenses(
        # Paginating
        skip: int = 0,
        limit: int = 100,
        # ordering
        order_by_col: str = 'id',
        order_by_asc: Literal['asc', 'desc'] = 'desc',
        # Filtering
        category_id: Optional[int] = None,
        is_recurring: Optional[bool] = None,
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        db: Session = Depends(get_db)
):
    """Get general expenses (monthly/recurring)"""
    query = db.query(Expense).options(
        selectinload(Expense.category)
    )
    if category_id is not None:
        query = query.filter(Expense.category_id == category_id)
    if is_recurring is not None:
        query = query.filter(Expense.is_recurring == is_recurring)
    if start_date:
        query = query.filter(Expense.expense_date >= start_date)
    if end_date:
        query = query.filter(Expense.expense_date <= end_date)

    total = query.count()
    expenses = query.order_by(
        getattr(Expense.id if order_by_col is None else getattr(Expense, order_by_col), order_by_asc)()
    ).offset(skip).limit(limit).all()
    return {"total": total, "expenses": expenses}


@router.get("/expenses/{expense_id}", response_model=ExpenseResponse)
def get_general_expense(expense_id: int, db: Session = Depends(get_db)):
    """Get a specific general expense"""
    expense = db.query(Expense).options(
        selectinload(Expense.category)
    ).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")
    return expense


@router.put("/expenses/{expense_id}", response_model=ExpenseResponse)
def update_general_expense(
        expense_id: int,
        expense_update: ExpenseUpdate,
        db: Session = Depends(get_db)
):
    """Update a general expense"""
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")

    update_data = expense_update.model_dump(exclude_unset=True)

    # Validate category if being updated
    if 'category_id' in update_data:
        category = db.get(MoneyCategory, update_data['category_id'])
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Money category with ID {update_data['category_id']} not found"
            )

    for field, value in update_data.items():
        setattr(expense, field, value)

    db.commit()
    db.refresh(expense)
    return expense


@router.delete("/expenses/{expense_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_general_expense(expense_id: int, db: Session = Depends(get_db)):
    """Delete a general expense"""
    expense = db.query(Expense).filter(Expense.id == expense_id).first()
    if not expense:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Expense not found")

    db.delete(expense)
    db.commit()
    return None
