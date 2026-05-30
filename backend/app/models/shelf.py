"""
Shelf models - locker/shelf rental system for gym members
"""
import typing
from datetime import datetime

from sqlalchemy import Column, Integer, String, Boolean, Float, Date, ForeignKey, case, func, literal
from sqlalchemy import Text
from sqlalchemy.orm import relationship, Mapped, Session, Query

from app.database import Base
from app.models.contract import Contract
from app.enums import ShelfStatus, PaymentStatus

if typing.TYPE_CHECKING:
    from app.models.hr import Member
    from app.models.money import Payment


class Rack(Base):
    """Physical rack/group where shelves are located."""
    __tablename__ = "rack"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(250), nullable=False, unique=True)
    owner = Column(String(250), nullable=True)
    is_deleted = Column(Boolean, nullable=False, default=False)

    shelves: Mapped[list["Shelf"]] = relationship("Shelf", back_populates="rack")


class Shelf(Base):
    """Shelf/Locker model - physical storage units in the gym"""
    __tablename__ = "shelf"

    id = Column(Integer, primary_key=True, index=True)
    shelf_number = Column(String(50), nullable=False, unique=True)  # e.g., "A-01", "B-12"
    rack_id = Column(Integer, ForeignKey("rack.id"), nullable=False)
    size = Column(String(50), nullable=True)  # e.g., "small", "medium", "large"
    description = Column(Text, nullable=True)
    is_deleted = Column(Boolean, nullable=False, default=False)

    # Relationships
    rack: Mapped["Rack"] = relationship("Rack", back_populates="shelves")
    rentals: Mapped["list[ShelfRental]"] = relationship(
        "ShelfRental", back_populates="shelf", cascade="all, delete-orphan"
    )

    @property
    def status(self) -> ShelfStatus:
        if not self.rentals:
            return ShelfStatus.AVAILABLE
        if active_rentals := [r for r in (
                (self.rentals if isinstance(self.rentals, list) else [self.rentals]) or []
        ) if r.is_active]:
            rental = active_rentals[0]
            if rental.contract.is_active:
                return ShelfStatus.OCCUPIED
            return ShelfStatus.RESERVED

        return ShelfStatus.AVAILABLE

    @classmethod
    def generate_all(
            cls,
            db: Session,
            is_active: bool | None,
            status_filter: ShelfStatus | None,
            order_by_col: str,
            order_by_asc: str
    ) -> Query:
        # Build the CTE (Common Table Expression)
        cte_query = db.query(
            cls.id,
            cls.shelf_number,
            cls.rack_id,
            cls.size,
            cls.description,
            cls.is_deleted,
            cls.created_at,
            cls.updated_at,
            case(
                (func.count(ShelfRental.id) == 0, literal('available')),
                (func.sum(case((Contract.is_active == True, 1), else_=0)) > 0, literal('occupied')),
                else_=literal('reserved')
            ).label('status')
        ).outerjoin(
            ShelfRental,
            cls.id == ShelfRental.shelf_id
        ).outerjoin(
            Contract,
            Contract.id == ShelfRental.contract_id
        )
        if is_active is not None:
            cte_query = cte_query.filter(cls.is_deleted == (not is_active))
        else:
            cte_query = cte_query.filter(cls.is_deleted == False)

        cte_query = cte_query.group_by(
            cls.id,
            cls.shelf_number,
            cls.rack_id,
            cls.size,
            cls.description,
            cls.is_deleted,
            cls.created_at,
            cls.updated_at,
        )
        cte = cte_query.subquery('cte')
        main_query = db.query(cte)

        if status_filter:
            main_query = main_query.filter(cte.c.status == status_filter.value)

        # Apply ordering
        order_column = getattr(cte.c, order_by_col, cte.c.id)
        if order_by_asc == 'asc':
            main_query = main_query.order_by(order_column.asc())
        else:
            main_query = main_query.order_by(order_column.desc())

        return main_query


class ShelfPlan(Base):
    """Shelf rental plan - defines pricing and duration for shelf rentals"""
    __tablename__ = "shelf_plan"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)  # e.g., "Monthly Locker", "Annual Storage"
    description = Column(String(500), nullable=True)
    price = Column(Float, nullable=False)
    duration_days = Column(Integer, nullable=False)  # 30, 90, 365, etc.
    is_deleted = Column(Boolean, nullable=False, default=False)

    # Relationships
    rentals: Mapped[list["ShelfRental"]] = relationship(
        "ShelfRental", back_populates="plan", uselist=True
    )


class ShelfRental(Base):
    """Shelf rental - tracks member shelf/locker rentals with payments"""
    __tablename__ = "shelf_rental"

    id = Column(Integer, primary_key=True, index=True)
    shelf_id = Column(Integer, ForeignKey("shelf.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("member.id"), nullable=False)
    plan_id = Column(Integer, ForeignKey("shelf_plan.id"), nullable=False)
    payment_id = Column(Integer, ForeignKey("payment.id", ondelete="SET NULL"), nullable=True)
    contract_id = Column(Integer, ForeignKey("contract.id"), nullable=False)

    start_date = Column(Date, nullable=False)
    end_date = Column(Date, nullable=False)
    notes = Column(Text, nullable=True)

    # Relationships
    shelf: Mapped["Shelf"] = relationship("Shelf", back_populates="rentals")
    member: Mapped["Member"] = relationship("Member", back_populates="shelf_rentals")
    plan: Mapped["ShelfPlan"] = relationship("ShelfPlan", back_populates="rentals")
    payment: Mapped["Payment"] = relationship("Payment", back_populates="shelf_rentals")
    contract: Mapped["Contract"] = relationship("Contract")

    @property
    def is_active(self) -> bool:
        return all([self.start_date <= datetime.now().date() <= self.end_date,
                    self.contract.is_active,
                    self.contract.signed_count >= 1,
                    self.payment.status == PaymentStatus.PAID])
