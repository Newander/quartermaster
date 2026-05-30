from enum import Enum


class PaymentStatus(str, Enum):
    """Payment status enum"""
    SCHEDULED = "scheduled"
    PAID = "paid"
    OVERDUE = "overdue"
    CANCELLED = "cancelled"


class PaymentMethod(str, Enum):
    """Payment methods enum"""
    TRANSFER = "transfer"
    CASH = "cash"
    CARD = "card"
    BLIK = "blik"
    BARTER = "barter"


class MembershipType(str, Enum):
    """Membership type enum"""
    MONTHLY = "monthly"
    VISITS = "visits"  # Based on number of visits


class ShelfStatus(str, Enum):
    """Shelf status enum"""
    AVAILABLE = "available"
    OCCUPIED = "occupied"
    MAINTENANCE = "maintenance"
    RESERVED = "reserved"
