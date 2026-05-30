"""
Contract models - contracts that members can sign
"""
from datetime import datetime

from sqlalchemy import Column, Integer, String, DateTime, Boolean, Date, ForeignKey, UniqueConstraint
from sqlalchemy.orm import relationship

from app.database import Base


class Contract(Base):
    """Contract model - represents a contract/agreement available to members"""
    __tablename__ = "contract"

    id = Column(Integer, primary_key=True, index=True)
    title = Column(String(150), nullable=False, unique=True)
    description = Column(String(1000), nullable=True)
    version = Column(String(50), nullable=True)
    effective_from = Column(Date, nullable=True)
    effective_to = Column(Date, nullable=True)

    # Relationships
    members = relationship("MemberContract", back_populates="contract", cascade="all, delete-orphan")

    # Computed properties for API responses
    @property
    def assigned_count(self) -> int:
        """Number of member assignments to this contract"""
        return len(self.members) if self.members is not None else 0

    @property
    def signed_count(self) -> int:
        """Number of member assignments that are signed"""
        return sum(1 for mc in (self.members or []) if getattr(mc, "signed", False))

    @property
    def is_active(self) -> bool:
        """Is this contract active?"""
        if self.effective_from is not None and self.effective_to is not None:
            return self.effective_from <= datetime.now().date() <= self.effective_to
        if self.effective_from is not None:
            return self.effective_from <= datetime.now().date()
        if self.effective_to is not None:
            return datetime.now().date() <= self.effective_to
        return True


class MemberContract(Base):
    """Association model: which contracts a member signed"""
    __tablename__ = "member_contracts"
    __table_args__ = (
        UniqueConstraint("member_id", "contract_id", name="uq_member_contract"),
    )

    id = Column(Integer, primary_key=True, index=True)
    member_id = Column(Integer, ForeignKey("member.id"), nullable=False, index=True)
    contract_id = Column(Integer, ForeignKey("contract.id"), nullable=False, index=True)
    signed = Column(Boolean, default=False)
    signed_at = Column(DateTime, nullable=True)
    notes = Column(String(3000), nullable=True)

    # Relationships
    member = relationship("Member", back_populates="member_contracts")
    contract = relationship("Contract", back_populates="members")
