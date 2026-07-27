from sqlalchemy import Column, String, BigInteger, Integer, Float, Boolean, DateTime, Text, ForeignKey
from sqlalchemy import Uuid
from sqlalchemy.orm import relationship
import uuid
from datetime import datetime, timezone
from app.models.base import Base, TimestampMixin


class TokenQuota(Base, TimestampMixin):
    __tablename__ = "token_quotas"

    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False, index=True, unique=True)
    daily_limit = Column(BigInteger, default=100000, nullable=False)
    daily_used = Column(BigInteger, default=0, nullable=False)
    total_quota = Column(BigInteger, default=1000000, nullable=False)
    total_used = Column(BigInteger, default=0, nullable=False)
    reset_date = Column(DateTime, nullable=True)
    last_notification_pct = Column(Integer, default=0, nullable=False)
    is_active = Column(Boolean, default=True, nullable=False)

    user = relationship("User", back_populates="token_quota")


class TokenUsageLog(Base, TimestampMixin):
    __tablename__ = "token_usage_logs"

    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False, index=True)
    date = Column(String(20), nullable=False, index=True)
    tokens_used = Column(Integer, default=0, nullable=False)
    endpoint = Column(String(200), nullable=True)
    model_used = Column(String(100), nullable=True)
    prompt_tokens = Column(Integer, default=0)
    completion_tokens = Column(Integer, default=0)
    estimated_cost = Column(Float, default=0.0)
    metadata_json = Column(Text, nullable=True)

    user = relationship("User", back_populates="token_usage_logs")
