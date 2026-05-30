"""
Membership and payment models
"""
import typing
from datetime import date

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Float, Enum as SQLEnum
from sqlalchemy.orm import relationship, Mapped, Session

from app.database import Base
from app.enums import MembershipType
from app.models.money import Payment

if typing.TYPE_CHECKING:
    from app.models.hr import Member


class MembershipPlan(Base):
    """Membership plan model - defines available membership types"""
    __tablename__ = "membership_plan"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)
    description = Column(String(500), nullable=True)
    membership_type = Column(SQLEnum(MembershipType), nullable=False)
    price = Column(Float, nullable=False)
    duration_days = Column(Integer, nullable=True)  # For monthly memberships
    visit_count = Column(Integer, nullable=True)  # For visit-based memberships
    is_deleted = Column(Boolean, default=False)

    season_id = Column(Integer, ForeignKey("season.id"), nullable=False)

    # Relationships
    season = relationship("Season", back_populates="membership_plans")
    memberships = relationship("MembershipPayment", back_populates="plan")


class MembershipPayment(Base):
    """Membership model - member's subscription"""
    __tablename__ = "membership_payment_m2m"

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("member.id"), nullable=False)
    plan_id = Column(Integer, ForeignKey("membership_plan.id"), nullable=False)
    payment_id = Column(Integer, ForeignKey("payment.id", ondelete="SET NULL"), nullable=True)

    # Relationships
    member: Mapped["Member"] = relationship("Member", back_populates="memberships")
    plan: Mapped[MembershipPlan] = relationship("MembershipPlan", back_populates="memberships")
    payment: Mapped["Payment"] = relationship("Payment", back_populates="membership_payments")

    @classmethod
    def count_active_members(cls, db: Session, start_date: date, end_date: date) -> int:
        return db.query(cls.member_id).join(Payment).filter(
            Payment.payment_date.between(start_date, end_date),
        ).distinct().count()
