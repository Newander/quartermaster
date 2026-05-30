"""
Memberships and payments API endpoints
"""
from datetime import date, timedelta
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, case
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.enums import PaymentStatus
from app.models import Payment, Member, ShelfRental
from app.models.membership import MembershipPayment, MembershipPlan
from app.models.money import MoneyCategory
from app.schemas.membership import (
    MoneyCategoryCreate,
    MoneyCategoryUpdate,
    MoneyCategoryResponse,
    MoneyCategoryListResponse,
    MembershipPlanCreate,
    MembershipPlanResponse,
    MembershipPlanUpdate,
    MembershipPlanListResponse,
    MembershipPaymentCreate,
    MembershipPaymentResponse,
    MembershipPaymentUpdate,
    MembershipPaymentListResponse,
    PaymentCreate,
    PaymentResponse,
    PaymentUpdate,
    PaymentListResponse,
)
from app.utils import model_to_dict_selective

router = APIRouter()


# Membership Plans endpoints
@router.post("/plans", response_model=MembershipPlanResponse, status_code=status.HTTP_201_CREATED)
def create_membership_plan(plan: MembershipPlanCreate, db: Session = Depends(get_db)):
    """Create a new membership plan"""
    existing = db.query(MembershipPlan).filter(MembershipPlan.name == plan.name,
                                               MembershipPlan.is_deleted == False).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Membership plan with this name already exists"
        )

    db_plan = MembershipPlan(**plan.model_dump())
    db.add(db_plan)
    db.commit()
    db.refresh(db_plan)
    return db_plan


@router.get("/plans", response_model=MembershipPlanListResponse)
def get_membership_plans(
        skip: int = 0,
        limit: int = 100,
        is_deleted: Optional[bool] = None,
        season_id: Optional[int] = None,
        db: Session = Depends(get_db)
):
    """Get all membership plans"""
    query = db.query(MembershipPlan).options(
        selectinload(MembershipPlan.season)
    )
    if is_deleted is not None:
        query = query.filter(MembershipPlan.is_deleted == is_deleted)
    if season_id is not None:
        query = query.filter(MembershipPlan.season_id == season_id)

    total = query.count()
    plans = query.offset(skip).limit(limit).all()
    return {"total": total, "plans": plans}


@router.get("/plans/{plan_id}", response_model=MembershipPlanResponse)
def get_membership_plan(plan_id: int, db: Session = Depends(get_db)):
    """Get a specific membership plan"""
    plan = db.query(MembershipPlan).options(
        selectinload(MembershipPlan.season)
    ).filter(MembershipPlan.id == plan_id, MembershipPlan.is_deleted == False).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership plan not found")
    return plan


@router.put("/plans/{plan_id}", response_model=MembershipPlanResponse)
def update_membership_plan(
        plan_id: int,
        plan_update: MembershipPlanUpdate,
        db: Session = Depends(get_db)
):
    """Update a membership plan"""
    plan = db.query(MembershipPlan).filter(MembershipPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership plan not found")

    update_data = plan_update.model_dump(exclude_unset=True)
    for field, value in update_data.items():
        setattr(plan, field, value)

    db.commit()
    db.refresh(plan)
    return plan


@router.delete("/plans/{plan_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_membership_plan(plan_id: int, db: Session = Depends(get_db)):
    """Delete a membership plan"""
    plan = db.query(MembershipPlan).filter(
        MembershipPlan.id == plan_id, MembershipPlan.is_deleted == False
    ).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership plan not found")

    plan.is_deleted = True
    db.commit()
    return None


# Membership Payments endpoints
@router.post("/", response_model=MembershipPaymentResponse, status_code=status.HTTP_201_CREATED)
def create_membership_payment(membership: MembershipPaymentCreate, db: Session = Depends(get_db)):
    """Create a new membership payment (links member, plan, and payment)"""
    # Validate member exists
    member = db.get(Member, membership.member_id)
    if not member:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Member with ID {membership.member_id} not found"
        )

    # Validate plan exists
    plan = db.get(MembershipPlan, membership.plan_id)
    if not plan:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Membership plan with ID {membership.plan_id} not found"
        )

    # Validate payment exists
    payment = db.get(Payment, membership.payment_id)
    if not payment:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Payment with ID {membership.payment_id} not found"
        )

    db_membership = MembershipPayment(**membership.model_dump())
    db.add(db_membership)
    db.commit()
    db.refresh(db_membership)
    return db_membership


@router.get("/", response_model=MembershipPaymentListResponse)
def get_membership_payments(
        skip: int = 0,
        limit: int = 100,
        member_id: Optional[int] = None,
        plan_id: Optional[int] = None,
        only_actual: Optional[bool] = None,
        db: Session = Depends(get_db)
):
    """Get all membership payments"""
    query = db.query(MembershipPayment).options(
        selectinload(MembershipPayment.member),
        selectinload(MembershipPayment.plan).selectinload(MembershipPlan.season),
        selectinload(MembershipPayment.payment).selectinload(Payment.category),
    )
    if only_actual is not None:
        query = query.join(MembershipPayment.payment).filter(
            Payment.payment_date > (date.today() - timedelta(days=60))
        )
    if member_id is not None:
        query = query.filter(MembershipPayment.member_id == member_id)
    if plan_id is not None:
        query = query.filter(MembershipPayment.plan_id == plan_id)

    total = query.count()
    memberships = query.order_by(MembershipPayment.id.desc()).offset(skip).limit(limit).distinct().all()
    return {"total": total, "memberships": memberships}


# Payments endpoints (static routes before dynamic)
@router.post("/payments", response_model=PaymentResponse, status_code=status.HTTP_201_CREATED)
def create_payment(payment: PaymentCreate, db: Session = Depends(get_db)):
    """Create a new payment"""
    # Validate category exists
    category = db.get(MoneyCategory, payment.category_id)
    if not category:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail=f"Money category with ID {payment.category_id} not found"
        )

    db_payment = Payment(**payment.model_dump())
    db.add(db_payment)
    db.commit()
    db.refresh(db_payment)
    return db_payment


@router.get("/payments", response_model=PaymentListResponse)
def get_payments(
        db: Session = Depends(get_db),
        # Paginating
        skip: int = 0,
        limit: int = 100,
        # Ordering
        order_by_col: str | None = None,
        order_by_asc: Literal['asc', 'desc'] = 'desc',
        # Filtering
        start_date: Optional[date] = None,
        end_date: Optional[date] = None,
        category_id: Optional[int] = None,
        status: Optional[PaymentStatus] = None,
):
    """Get all payments"""
    data_query = (
        db.query(Payment,
                 MembershipPayment.member_id.label('member_id'),
                 ShelfRental.shelf_id.label('shelf_id'))
        .join(MembershipPayment, MembershipPayment.payment_id == Payment.id, isouter=True)
        .join(ShelfRental, ShelfRental.payment_id == Payment.id, isouter=True)
        .options(selectinload(Payment.category))
    ).distinct()
    metrics_query = db.query(
        func.sum(Payment.amount).label('total_amount'),
        func.sum(case((Payment.status == PaymentStatus.PAID, Payment.amount), else_=0)).label('paid_amount'),
        func.sum(case((Payment.status == PaymentStatus.SCHEDULED, Payment.amount), else_=0)).label('pending_amount'),
    )

    if category_id is not None:
        data_query = data_query.filter(Payment.category_id == category_id)
        metrics_query = metrics_query.filter(Payment.category_id == category_id)
    if status is not None:
        data_query = data_query.filter(Payment.status == status)
        metrics_query = metrics_query.filter(Payment.status == status)
    if start_date is not None:
        data_query = data_query.filter(Payment.payment_date >= start_date)
        metrics_query = metrics_query.filter(Payment.payment_date >= start_date)
    if end_date is not None:
        data_query = data_query.filter(Payment.payment_date <= end_date)
        metrics_query = metrics_query.filter(Payment.payment_date <= end_date)

    total = data_query.count()
    payments = data_query.order_by(
        getattr(Payment.id if order_by_col is None else getattr(Payment, order_by_col), order_by_asc)()
    ).offset(skip).limit(limit).all()
    total_amount, paid_amount, pending_amount = metrics_query.one()

    return {
        "total": total,
        "total_amount": total_amount,
        "paid_amount": paid_amount,
        "pending_amount": pending_amount,
        "payments": [
            PaymentResponse.model_validate(
                model_to_dict_selective(payment) | {'member_id': member_id, 'shelf_id': shelf_id})
            for payment, member_id, shelf_id in payments
        ]
    }


@router.get("/payments/{payment_id}", response_model=PaymentResponse)
def get_payment(payment_id: int, db: Session = Depends(get_db)):
    """Get a specific payment"""
    payment = db.query(Payment).options(
        selectinload(Payment.category)
    ).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")
    return payment


@router.put("/payments/{payment_id}", response_model=PaymentResponse)
def update_payment(
        payment_id: int,
        payment_update: PaymentUpdate,
        db: Session = Depends(get_db)
):
    """Update a payment"""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    update_data = payment_update.model_dump(exclude_unset=True)

    # If updating category_id, validate it exists
    if 'category_id' in update_data:
        category = db.get(MoneyCategory, update_data['category_id'])
        if not category:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Money category with ID {update_data['category_id']} not found"
            )

    for field, value in update_data.items():
        setattr(payment, field, value)

    db.commit()
    db.refresh(payment)
    return payment


@router.delete("/payments/{payment_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_payment(payment_id: int, db: Session = Depends(get_db)):
    """Delete a payment"""
    payment = db.query(Payment).filter(Payment.id == payment_id).first()
    if not payment:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Payment not found")

    db.delete(payment)
    db.commit()
    return None


# MoneyCategory endpoints (must come before /{membership_id} to avoid route conflicts)
@router.post("/categories", response_model=MoneyCategoryResponse, status_code=status.HTTP_201_CREATED)
def create_money_category(category: MoneyCategoryCreate, db: Session = Depends(get_db)):
    """Create a new money category"""
    existing = db.query(MoneyCategory).filter(MoneyCategory.name == category.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Money category with this name already exists"
        )

    db_category = MoneyCategory(**category.model_dump())
    db.add(db_category)
    db.commit()
    db.refresh(db_category)
    return db_category


@router.get("/categories", response_model=MoneyCategoryListResponse)
def get_money_categories(
        skip: int = 0,
        limit: int = 100,
        db: Session = Depends(get_db)
):
    """Get all money categories"""
    query = db.query(MoneyCategory)
    total = query.count()
    categories = query.offset(skip).limit(limit).all()
    return {"total": total, "categories": categories}


@router.get("/categories/{category_id}", response_model=MoneyCategoryResponse)
def get_money_category(category_id: int, db: Session = Depends(get_db)):
    """Get a specific money category"""
    category = db.query(MoneyCategory).filter(MoneyCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Money category not found")
    return category


@router.put("/categories/{category_id}", response_model=MoneyCategoryResponse)
def update_money_category(
        category_id: int,
        category_update: MoneyCategoryUpdate,
        db: Session = Depends(get_db)
):
    """Update a money category"""
    category = db.query(MoneyCategory).filter(MoneyCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Money category not found")

    update_data = category_update.model_dump(exclude_unset=True)

    # Check for name uniqueness if updating name
    if 'name' in update_data and update_data['name'] != category.name:
        existing = db.query(MoneyCategory).filter(MoneyCategory.name == update_data['name']).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Money category with this name already exists"
            )

    for field, value in update_data.items():
        setattr(category, field, value)

    db.commit()
    db.refresh(category)
    return category


@router.delete("/categories/{category_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_money_category(category_id: int, db: Session = Depends(get_db)):
    """Delete a money category"""
    category = db.query(MoneyCategory).filter(MoneyCategory.id == category_id).first()
    if not category:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Money category not found")

    db.delete(category)
    db.commit()
    return None


@router.get("/{membership_id}", response_model=MembershipPaymentResponse)
def get_membership_payment(membership_id: int, db: Session = Depends(get_db)):
    """Get a specific membership payment"""
    membership = db.query(MembershipPayment).options(
        selectinload(MembershipPayment.member),
        selectinload(MembershipPayment.plan).selectinload(MembershipPlan.season),
        selectinload(MembershipPayment.payment).selectinload(Payment.category),
    ).filter(MembershipPayment.id == membership_id).first()
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership payment not found")
    return membership


@router.put("/{membership_id}", response_model=MembershipPaymentResponse)
def update_membership_payment(
        membership_id: int,
        membership_update: MembershipPaymentUpdate,
        db: Session = Depends(get_db)
):
    """Update a membership payment"""
    membership = db.query(MembershipPayment).filter(MembershipPayment.id == membership_id).first()
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership payment not found")

    update_data = membership_update.model_dump(exclude_unset=True)

    # If updating payment_id, validate it exists
    if 'payment_id' in update_data:
        payment = db.get(Payment, update_data['payment_id'])
        if not payment:
            raise HTTPException(
                status_code=status.HTTP_404_NOT_FOUND,
                detail=f"Payment with ID {update_data['payment_id']} not found"
            )

    for field, value in update_data.items():
        setattr(membership, field, value)

    db.commit()
    db.refresh(membership)
    return membership


@router.delete("/{membership_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_membership_payment(membership_id: int, db: Session = Depends(get_db)):
    """Delete a membership payment"""
    membership = db.query(MembershipPayment).filter(MembershipPayment.id == membership_id).first()
    if not membership:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Membership payment not found")

    db.delete(membership)
    db.commit()
    return None
