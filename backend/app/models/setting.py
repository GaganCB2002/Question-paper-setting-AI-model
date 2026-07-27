from sqlalchemy import Column, String, Text, Boolean
from app.models.base import Base, TimestampMixin


class Setting(Base, TimestampMixin):
    __tablename__ = "settings"

    key = Column(String(255), unique=True, nullable=False, index=True)
    value = Column(Text, nullable=True)
    value_type = Column(String(50), default="string", nullable=False)
    group = Column(String(100), nullable=True, index=True)
    description = Column(String(500), nullable=True)
    is_encrypted = Column(Boolean, default=False, nullable=False)
    is_public = Column(Boolean, default=True, nullable=False)
    is_system = Column(Boolean, default=False, nullable=False)
    validation_rules = Column(Text, nullable=True)
    options_json = Column(Text, nullable=True)
