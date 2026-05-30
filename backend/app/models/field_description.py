"""
Field description model for user-facing column labels and help text.
"""

from sqlalchemy import Column, Integer, String, Text, UniqueConstraint

from app.database import QuartermasterCRMBase


class FieldDescription(QuartermasterCRMBase):
    __tablename__ = "field_description"
    __table_args__ = (
        UniqueConstraint("table_name", "column_name", name="uq_field_description_table_name_column_name"),
    )

    id = Column(Integer, primary_key=True, index=True)
    table_name = Column(String(255), nullable=False)
    column_name = Column(String(255), nullable=False)
    transcription = Column(String(255), nullable=False)
    data_type = Column(String(255), nullable=False)
    value_type = Column(String(64), nullable=True)
    ui_type = Column(String(64), nullable=True)
    input_mode = Column(String(32), nullable=True)
    semantic = Column(String(64), nullable=True)
    rules_json = Column(Text, nullable=True)
    derive_json = Column(Text, nullable=True)
    display_json = Column(Text, nullable=True)
    allowed_values = Column(Text, nullable=True)
    description = Column(Text, nullable=False)
