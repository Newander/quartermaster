"""
Event and expense models
"""
from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, Boolean, ForeignKey, Float, Date, Text
from sqlalchemy.orm import relationship

from app.database import Base


class Event(Base):
    """Special event model - workshops, tournaments, etc."""
    __tablename__ = "events"

    id = Column(Integer, primary_key=True, index=True)
    name = Column(String(200), nullable=False)
    description = Column(Text, nullable=True)
    registration_start_date = Column(Date, nullable=True)
    event_date = Column(Date, nullable=False)
    start_time = Column(DateTime, nullable=True)
    end_time = Column(DateTime, nullable=True)
    location = Column(String(200), nullable=True)
    max_participants = Column(Integer, nullable=True)
    price = Column(Float, nullable=False, default=0.0)
    is_closed = Column(Boolean, default=False)

    # Relationships
    registrations = relationship("EventRegistration", back_populates="event", cascade="all, delete-orphan")
    expenses = relationship("EventExpense", back_populates="event", cascade="all, delete-orphan")


class EventTrainingZone(Base):
    """Event training zone model - which zones are occupied for event"""
    __tablename__ = "event_training_zone_m2m"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    training_zone_id = Column(Integer, ForeignKey("training_zone.id"), nullable=False)


class EventRegistration(Base):
    """Event registration model - tracks member registrations for events"""
    __tablename__ = "event_registrations"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    member_id = Column(Integer, ForeignKey("member.id"), nullable=True)
    payment_id = Column(Integer, ForeignKey("payment.id", ondelete="SET NULL"), nullable=True)
    registration_date = Column(DateTime, default=datetime.now)
    discount = Column(Float, nullable=False, default=0.0)
    notes = Column(String(3000), nullable=True)

    # Relationships
    event = relationship("Event", back_populates="registrations")
    payment = relationship("Payment", back_populates="event_registrations")
    member = relationship("Member", back_populates="event_registrations")


class EventExpense(Base):
    """Event expense model - tracks expenses for specific events"""
    __tablename__ = "event_expenses"

    id = Column(Integer, primary_key=True, index=True)
    event_id = Column(Integer, ForeignKey("events.id"), nullable=False)
    expense_id = Column(Integer, ForeignKey("expense.id", ondelete="SET NULL"), nullable=True)
    description = Column(String(200), nullable=False)
    amount = Column(Float, nullable=False)
    expense_date = Column(Date, nullable=False)
    notes = Column(String(3000), nullable=True)

    # Relationships
    event = relationship("Event", back_populates="expenses")
    expense = relationship("Expense")

