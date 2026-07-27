import uuid
from datetime import datetime, timezone
from sqlalchemy import Column, String, DateTime, Boolean, Text, Integer, Uuid
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.sql import func


class Base(DeclarativeBase):
    pass


class TimestampMixin:
    id = Column(
        Uuid,
        primary_key=True,
        default=uuid.uuid4,
        index=True,
    )
    created_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        nullable=False,
        index=True,
    )
    updated_at = Column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
    created_by = Column(
        String(255),
        nullable=True,
        index=True,
    )
    updated_by = Column(
        String(255),
        nullable=True,
    )
    status = Column(
        String(50),
        default="active",
        nullable=False,
        index=True,
    )
    version = Column(
        Integer,
        default=1,
        nullable=False,
    )
    is_deleted = Column(
        Boolean,
        default=False,
        nullable=False,
        index=True,
    )
    deleted_at = Column(
        DateTime(timezone=True),
        nullable=True,
    )
    deleted_by = Column(
        String(255),
        nullable=True,
    )
    notes = Column(
        Text,
        nullable=True,
    )

    def soft_delete(self, user: str = "system"):
        self.is_deleted = True
        self.deleted_at = datetime.now(timezone.utc)
        self.deleted_by = user
        self.status = "deleted"
        self.updated_at = datetime.now(timezone.utc)

    def restore(self):
        self.is_deleted = False
        self.deleted_at = None
        self.deleted_by = None
        self.status = "active"
        self.updated_at = datetime.now(timezone.utc)
