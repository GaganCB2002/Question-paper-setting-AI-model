from sqlalchemy import Column, String, Text, ForeignKey, Integer, Boolean
from sqlalchemy import Uuid
from sqlalchemy.orm import relationship
import uuid
from app.models.base import Base, TimestampMixin


class AuditLog(Base, TimestampMixin):
    __tablename__ = "audit_logs"

    user_id = Column(Uuid, ForeignKey("users.id"), nullable=True, index=True)
    action = Column(String(100), nullable=False, index=True)
    resource_type = Column(String(100), nullable=False, index=True)
    resource_id = Column(String(255), nullable=True, index=True)
    details_json = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    request_method = Column(String(10), nullable=True)
    request_path = Column(String(500), nullable=True)
    request_body = Column(Text, nullable=True)
    response_status = Column(Integer, nullable=True)
    response_body = Column(Text, nullable=True)
    execution_time_ms = Column(Integer, nullable=True)
    is_error = Column(Boolean, default=False, nullable=False)
    error_message = Column(Text, nullable=True)
    session_id = Column(String(255), nullable=True)


class ActivityLog(Base, TimestampMixin):
    __tablename__ = "activity_logs"

    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False, index=True)
    activity_type = Column(String(100), nullable=False, index=True)
    description = Column(String(500), nullable=False)
    resource_type = Column(String(100), nullable=True)
    resource_id = Column(String(255), nullable=True)
    metadata_json = Column(Text, nullable=True)
    ip_address = Column(String(45), nullable=True)
    user_agent = Column(String(500), nullable=True)
    session_duration = Column(Integer, nullable=True)
    is_important = Column(Boolean, default=False, nullable=False)

    user = relationship("User", back_populates="activity_logs")
