"""
Shelves API endpoints - locker/shelf rental management
"""
from datetime import timedelta
from typing import Optional, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import func, or_
from sqlalchemy.orm import Session, selectinload

from app.database import get_db
from app.enums import PaymentStatus
from app.models import Contract, MemberContract
from app.enums import PaymentMethod, ShelfStatus
from app.models.money import Payment, MoneyCategory
from app.db_schemas import ColumnMetaOut, ModelMetaOut
from app.models.shelf import Rack, Shelf, ShelfPlan, ShelfRental
from app.schemas.shelf import (
    ShelfCreate, ShelfUpdate, ShelfResponse, ShelfListResponse,
    ShelfPlanCreate, ShelfPlanUpdate, ShelfPlanResponse,
    ShelfRentalCreate, ShelfRentalUpdate, ShelfRentalResponse, ShelfRentalListResponse,
    RackCreate, RackUpdate, RackResponse, RackListResponse,
)

router = APIRouter()


def _rack_schema() -> ModelMetaOut:
    def field(
        name: str,
        transcription: str,
        data_type: str,
        *,
        nullable: bool = False,
        primary_key: bool = False,
        default=None,
    ) -> ColumnMetaOut:
        return ColumnMetaOut(
            name=name,
            transcription=transcription,
            description=transcription,
            data_type=data_type,
            value_type=data_type,
            ui_type="checkbox" if data_type == "bool" else "text",
            input_mode="manual",
            semantic=None,
            nullable=nullable,
            primary_key=primary_key,
            default=default,
            foreign_keys=[],
            allowed_values=None,
        )

    return ModelMetaOut(
        name="rack",
        fields=[
            field("id", "ID", "int", primary_key=True),
            field("name", "Nazwa", "string"),
            field("owner", "Właściciel", "string", nullable=True),
            field("is_deleted", "Usunięty", "bool", default=False),
        ],
        filters=[],
        relation_lookups={},
    )


def _get_or_create_rack(db: Session, name: str | None) -> Rack:
    rack_name = (name or "Default rack").strip() or "Default rack"
    rack = db.query(Rack).filter(Rack.name == rack_name).first()
    if rack:
        return rack

    rack = Rack(name=rack_name, owner=None, is_deleted=False)
    db.add(rack)
    db.flush()
    return rack


def _shelf_payload(db: Session, shelf_data: ShelfCreate | ShelfUpdate) -> dict:
    payload = shelf_data.model_dump(exclude_unset=True, exclude={"location", "status"})
    if payload.get("rack_id") is None and shelf_data.location:
        payload["rack_id"] = _get_or_create_rack(db, shelf_data.location).id
    if payload.get("rack_id") is None and isinstance(shelf_data, ShelfCreate):
        payload["rack_id"] = _get_or_create_rack(db, None).id
    return payload


# ============================================
# Rack Endpoints
# ============================================

@router.get("/racks/schema", response_model=ModelMetaOut)
def get_rack_schema():
    return _rack_schema()


@router.get("/racks", response_model=RackListResponse)
def list_racks(
        db: Session = Depends(get_db),
        skip: int = 0,
        limit: int = 100,
        search: Optional[str] = None,
        order_by_col: str = "id",
        order_by_asc: Literal["asc", "desc"] = "asc",
):
    query = db.query(Rack).filter(Rack.is_deleted == False)
    if normalized_search := (search or "").strip():
        search_pattern = f"%{normalized_search}%"
        query = query.filter(or_(Rack.name.like(search_pattern), Rack.owner.like(search_pattern)))

    total = query.count()
    order_column = getattr(Rack, order_by_col, Rack.id)
    query = query.order_by(order_column.asc() if order_by_asc == "asc" else order_column.desc())
    return {"total": total, "records": query.offset(skip).limit(limit).all()}


@router.post("/racks", response_model=RackResponse, status_code=status.HTTP_201_CREATED)
def create_rack(rack_data: RackCreate, db: Session = Depends(get_db)):
    if db.query(Rack).filter(Rack.name == rack_data.name).first():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rack already exists")

    rack = Rack(**rack_data.model_dump())
    db.add(rack)
    db.commit()
    db.refresh(rack)
    return rack


@router.get("/racks/{rack_id}", response_model=RackResponse)
def get_rack(rack_id: int, db: Session = Depends(get_db)):
    rack = db.query(Rack).filter(Rack.id == rack_id).first()
    if not rack:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rack not found")
    return rack


@router.put("/racks/{rack_id}", response_model=RackResponse)
@router.patch("/racks/{rack_id}", response_model=RackResponse)
def update_rack(rack_id: int, rack_data: RackUpdate, db: Session = Depends(get_db)):
    rack = db.query(Rack).filter(Rack.id == rack_id).first()
    if not rack:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rack not found")

    update_data = rack_data.model_dump(exclude_unset=True)
    if name := update_data.get("name"):
        existing = db.query(Rack).filter(Rack.name == name, Rack.id != rack_id).first()
        if existing:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Rack already exists")

    for field, value in update_data.items():
        setattr(rack, field, value)
    db.commit()
    db.refresh(rack)
    return rack


@router.delete("/racks/{rack_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_rack(rack_id: int, db: Session = Depends(get_db)):
    rack = db.query(Rack).filter(Rack.id == rack_id).first()
    if not rack:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rack not found")
    if db.query(Shelf).filter(Shelf.rack_id == rack_id, Shelf.is_deleted == False).count() > 0:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Cannot delete rack with active shelves")
    rack.is_deleted = True
    db.commit()


@router.post("/shelves", response_model=ShelfResponse, status_code=status.HTTP_201_CREATED)
def create_shelf(shelf_data: ShelfCreate, db: Session = Depends(get_db)):
    """Create a new shelf/locker"""
    # Check if shelf_number already exists
    existing = db.query(Shelf).filter(Shelf.shelf_number == shelf_data.shelf_number).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Shelf number already exists"
        )

    shelf = Shelf(**_shelf_payload(db, shelf_data))
    db.add(shelf)
    db.commit()
    db.refresh(shelf)
    return shelf


@router.get("/shelves", response_model=ShelfListResponse)
def list_shelves(
        db: Session = Depends(get_db),
        # pagination
        skip: int = 0,
        limit: int = 100,
        # ordering
        order_by_col: str = 'id',
        order_by_asc: Literal['asc', 'desc'] = 'desc',
        # filter
        status_filter: Optional[ShelfStatus] = None,
        is_active: Optional[bool] = None,
):
    """List all shelves with optional filtering"""
    main_query = Shelf.generate_all(
        db, is_active, status_filter, order_by_col, order_by_asc
    )

    # Get total count before pagination
    total = main_query.count()

    # Apply pagination
    results = main_query.offset(skip).limit(limit).all()

    return {"total": total, "shelves": results}


@router.get("/shelves/{shelf_id}", response_model=ShelfResponse)
def get_shelf(shelf_id: int, db: Session = Depends(get_db)):
    """Get a specific shelf by ID"""
    shelf = db.query(Shelf).filter(Shelf.id == shelf_id).first()
    if not shelf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shelf not found")
    return shelf


@router.patch("/shelves/{shelf_id}", response_model=ShelfResponse)
def update_shelf(shelf_id: int, shelf_data: ShelfUpdate, db: Session = Depends(get_db)):
    """Update a shelf"""
    shelf = db.query(Shelf).filter(Shelf.id == shelf_id).first()
    if not shelf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shelf not found")

    # Check shelf_number uniqueness if updating
    if shelf_data.shelf_number and shelf_data.shelf_number != shelf.shelf_number:
        existing = db.query(Shelf).filter(Shelf.shelf_number == shelf_data.shelf_number).first()
        if existing:
            raise HTTPException(
                status_code=status.HTTP_400_BAD_REQUEST,
                detail="Shelf number already exists"
            )

    update_data = _shelf_payload(db, shelf_data)
    for field, value in update_data.items():
        setattr(shelf, field, value)

    db.commit()
    db.refresh(shelf)
    return shelf


@router.delete("/shelves/{shelf_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shelf(shelf_id: int, db: Session = Depends(get_db)):
    """Delete a shelf"""
    shelf = db.query(Shelf).filter(Shelf.id == shelf_id).first()
    if not shelf:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shelf not found")

    # Check if shelf has active rentals
    active_rentals = db.query(ShelfRental).filter(
        ShelfRental.shelf_id == shelf_id,
        ShelfRental.is_active == True
    ).count()

    if active_rentals > 0:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Cannot delete shelf with active rentals"
        )

    db.delete(shelf)
    db.commit()


# ============================================
# Shelf Plan Endpoints
# ============================================

@router.post("/plans", response_model=ShelfPlanResponse, status_code=status.HTTP_201_CREATED)
def create_shelf_plan(plan_data: ShelfPlanCreate, db: Session = Depends(get_db)):
    """Create a new shelf rental plan"""
    # Check if plan name already exists
    existing = db.query(ShelfPlan).filter(ShelfPlan.name == plan_data.name).first()
    if existing:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Plan name already exists"
        )

    plan = ShelfPlan(**plan_data.model_dump())
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


@router.get("/plans", response_model=list[ShelfPlanResponse])
def list_shelf_plans(
        skip: int = 0,
        limit: int = 100,
        db: Session = Depends(get_db)
):
    """List all shelf rental plans"""
    query = db.query(ShelfPlan)
    plans = query.offset(skip).limit(limit).all()
    return plans


@router.get("/plans/{plan_id}", response_model=ShelfPlanResponse)
def get_shelf_plan(plan_id: int, db: Session = Depends(get_db)):
    """Get a specific shelf plan"""
    plan = db.query(ShelfPlan).filter(ShelfPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")
    return plan


@router.patch("/plans/{plan_id}", response_model=ShelfPlanResponse)
def update_shelf_plan(plan_id: int, plan_data: ShelfPlanUpdate, db: Session = Depends(get_db)):
    """Update a shelf plan"""
    plan = db.query(ShelfPlan).filter(ShelfPlan.id == plan_id).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    for field, value in plan_data.model_dump(exclude_unset=True).items():
        setattr(plan, field, value)

    db.commit()
    db.refresh(plan)
    return plan


# ============================================
# Shelf Rental Endpoints
# ============================================

@router.post("/rentals", response_model=ShelfRentalResponse, status_code=status.HTTP_201_CREATED)
def create_shelf_rental(
        rental_data: ShelfRentalCreate,
        db: Session = Depends(get_db)
):
    """Create a new shelf rental with payment"""
    # Validate shelf exists and is available
    if not (shelf := db.query(Shelf).filter(Shelf.id == rental_data.shelf_id).first()):
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Shelf not found")

    if shelf.status != ShelfStatus.AVAILABLE:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Shelf is not available (status: {shelf.status})"
        )

    # Validate plan exists
    plan = db.query(ShelfPlan).filter(ShelfPlan.id == rental_data.plan_id).first()
    if not plan:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Plan not found")

    if plan.is_deleted:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Plan is removed"
        )

    # Calculate end_date based on plan duration
    end_date = rental_data.start_date + timedelta(days=plan.duration_days)

    # Get or create shelf rental category
    category = db.query(MoneyCategory).filter(MoneyCategory.name == "shelf_rental").first()
    if not category:
        category = MoneyCategory(name="shelf_rental")
        db.add(category)
        db.flush()

    # Create payment
    payment = Payment(
        category_id=category.id,
        description=f"Shelf rental: {shelf.shelf_number} - {plan.name}",
        amount=rental_data.payment_amount,
        payment_date=rental_data.start_date,
        payment_method=PaymentMethod(rental_data.payment_method),
        status=PaymentStatus.SCHEDULED
    )
    db.add(payment)
    db.flush()

    # Create contract
    existed_contracts_num = db.query(Contract).filter(
        Contract.title.like('%półk%')
    ).count()
    new_contract = Contract(
        title=f"Umowa najmu półki №{existed_contracts_num + 1}",
        description=f"Wynajem polki {shelf.shelf_number} z data startu {rental_data.start_date.strftime('%Y-%m-%d')}",
        effective_from=rental_data.start_date,
        effective_to=end_date,
        version='v1',
    )
    db.add(new_contract)
    db.flush()
    contract_membership = MemberContract(
        member_id=rental_data.member_id,
        contract_id=new_contract.id,
        signed=False,
        signed_at=None,
        notes="Sgenerowane automatyczne",
    )
    db.add(contract_membership)

    # Create rental
    rental = ShelfRental(
        shelf_id=rental_data.shelf_id,
        member_id=rental_data.member_id,
        plan_id=rental_data.plan_id,
        payment_id=payment.id,
        contract_id=new_contract.id,
        start_date=rental_data.start_date,
        end_date=end_date,
        notes=rental_data.notes
    )
    db.add(rental)
    db.commit()

    return rental


@router.get("/rentals", response_model=ShelfRentalListResponse)
def list_shelf_rentals(
        skip: int = 0,
        limit: int = 100,
        member_id: Optional[int] = None,
        shelf_id: Optional[int] = None,
        is_active: Optional[bool] = None,
        db: Session = Depends(get_db)
):
    """List all shelf rentals with optional filtering"""
    query = db.query(ShelfRental).options(
        selectinload(ShelfRental.shelf),
        selectinload(ShelfRental.plan),
        selectinload(ShelfRental.payment),
        selectinload(ShelfRental.contract),
    )

    if member_id:
        query = query.filter(ShelfRental.member_id == member_id)
    if shelf_id:
        query = query.filter(ShelfRental.shelf_id == shelf_id)
    if is_active is not None:
        query = query.join(Contract)
        if is_active:
            query = query.filter(
                ShelfRental.start_date <= func.now(),
                ShelfRental.end_date >= func.now(),
                Contract.is_active == is_active,
            )
        else:
            query = query.filter(
                or_(ShelfRental.start_date > func.now(),
                    ShelfRental.end_date < func.now(),
                    Contract.is_active.in_([False, None]))
            )

    total = query.count()
    rentals = query.offset(skip).limit(limit).all()

    return {"total": total, "rentals": rentals}


@router.get("/rentals/{rental_id}", response_model=ShelfRentalResponse)
def get_shelf_rental(rental_id: int, db: Session = Depends(get_db)):
    """Get a specific shelf rental"""
    rental = db.query(ShelfRental).options(
        selectinload(ShelfRental.shelf),
        selectinload(ShelfRental.plan)
    ).filter(ShelfRental.id == rental_id).first()

    if not rental:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rental not found")
    return rental


@router.patch("/rentals/{rental_id}", response_model=ShelfRentalResponse)
def update_shelf_rental(
        rental_id: int,
        rental_data: ShelfRentalUpdate,
        db: Session = Depends(get_db)
):
    """Update a shelf rental (e.g., deactivate)"""
    rental = db.query(ShelfRental).filter(ShelfRental.id == rental_id).first()
    if not rental:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rental not found")

    # If deactivating rental, update shelf status
    if rental_data.is_active is False and rental.is_active:
        shelf = db.query(Shelf).filter(Shelf.id == rental.shelf_id).first()
        if shelf:
            shelf.status = ShelfStatus.AVAILABLE

    for field, value in rental_data.model_dump(exclude_unset=True).items():
        setattr(rental, field, value)

    db.commit()
    db.refresh(rental)

    # Load relationships
    rental = db.query(ShelfRental).options(
        selectinload(ShelfRental.shelf),
        selectinload(ShelfRental.plan)
    ).filter(ShelfRental.id == rental.id).first()

    return rental


@router.delete("/rentals/{rental_id}", status_code=status.HTTP_204_NO_CONTENT)
def delete_shelf_rental(rental_id: int, db: Session = Depends(get_db)):
    """Cancel/delete a shelf rental"""
    rental = db.query(ShelfRental).filter(ShelfRental.id == rental_id).first()
    if not rental:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Rental not found")

    # Update shelf status to available
    shelf = db.query(Shelf).filter(Shelf.id == rental.shelf_id).first()
    if shelf:
        shelf.status = ShelfStatus.AVAILABLE

    db.delete(rental)
    db.commit()
