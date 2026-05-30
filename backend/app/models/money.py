from datetime import datetime

from sqlalchemy import Column, Integer, String, Boolean, ForeignKey, Float, Date, DateTime
from sqlalchemy import Enum as SQLEnum
from sqlalchemy.orm import relationship

from app.database import Base
from app.enums import PaymentMethod, PaymentStatus


class MoneyCategory(Base):
    """ e.g., "rent", "utilities", "equipment", "insurance", @membership """
    __tablename__ = "money_category"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(100), nullable=False, unique=True)


class Expense(Base):
    __tablename__ = "expense"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("money_category.id"), nullable=False)
    description = Column(String(5000), nullable=False)
    amount = Column(Float, nullable=False)
    expense_date = Column(Date, nullable=False)
    is_recurring = Column(Boolean, default=False)
    status = Column(SQLEnum(PaymentStatus), default=PaymentStatus.PAID)
    notes = Column(String(3000), nullable=True)

    # Relationships
    category = relationship("MoneyCategory")


class Payment(Base):
    """Payment model - tracks payments for memberships"""
    __tablename__ = "payment"

    id = Column(Integer, primary_key=True, index=True)
    category_id = Column(Integer, ForeignKey("money_category.id"), nullable=False)
    description = Column(String(5000), nullable=False)
    amount = Column(Float, nullable=False)
    payment_date = Column(Date, nullable=False)
    is_recurring = Column(Boolean, default=False)
    payment_method = Column(SQLEnum(PaymentMethod), nullable=True, default=PaymentMethod.TRANSFER)
    status = Column(SQLEnum(PaymentStatus), default=PaymentStatus.PAID)
    notes = Column(String(3000), nullable=True)

    # Relationships
    category = relationship("MoneyCategory")
    event_registrations = relationship("EventRegistration", back_populates="payment", cascade="all, delete-orphan")
    membership_payments = relationship("MembershipPayment", back_populates="payment", cascade="all, delete-orphan")
    shelf_rentals = relationship("ShelfRental", back_populates="payment", cascade="all, delete-orphan")


class CheckPoint(Base):
    """ Allowing to set the club's financial account for some day (source of truth) """
    __tablename__ = "checkpoint"

    date = Column(Date, primary_key=True, index=True)
    balance = Column(Float, nullable=False)

    created_at = Column(DateTime, default=datetime.now)
    updated_at = Column(DateTime, onupdate=datetime.now)
