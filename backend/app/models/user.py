from sqlalchemy import Column, String, Boolean, DateTime, ForeignKey, Text, Integer
from sqlalchemy import Uuid
from sqlalchemy.orm import relationship
import uuid
from app.models.base import Base, TimestampMixin


class Role(Base, TimestampMixin):
    __tablename__ = "roles"

    name = Column(String(100), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    is_system_role = Column(Boolean, default=False, nullable=False)

    users = relationship("User", back_populates="role")
    permissions = relationship("RolePermission", back_populates="role", cascade="all, delete-orphan")


class Permission(Base, TimestampMixin):
    __tablename__ = "permissions"

    name = Column(String(150), unique=True, nullable=False, index=True)
    code = Column(String(150), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    module = Column(String(100), nullable=False, index=True)

    roles = relationship("RolePermission", back_populates="permission", cascade="all, delete-orphan")


class RolePermission(Base, TimestampMixin):
    __tablename__ = "role_permissions"

    role_id = Column(Uuid, ForeignKey("roles.id", ondelete="CASCADE"), nullable=False)
    permission_id = Column(Uuid, ForeignKey("permissions.id", ondelete="CASCADE"), nullable=False)

    role = relationship("Role", back_populates="permissions")
    permission = relationship("Permission", back_populates="roles")


class User(Base, TimestampMixin):
    __tablename__ = "users"

    email = Column(String(255), unique=True, nullable=False, index=True)
    username = Column(String(100), unique=True, nullable=False, index=True)
    full_name = Column(String(255), nullable=False)
    password_hash = Column(String(255), nullable=False)
    role_id = Column(Uuid, ForeignKey("roles.id"), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    is_verified = Column(Boolean, default=False, nullable=False)
    is_superuser = Column(Boolean, default=False, nullable=False)
    phone = Column(String(20), nullable=True)
    avatar_url = Column(String(500), nullable=True)
    last_login_at = Column(DateTime(timezone=True), nullable=True)
    last_login_ip = Column(String(45), nullable=True)
    login_attempts = Column(Integer, default=0, nullable=False)
    locked_until = Column(DateTime(timezone=True), nullable=True)
    preferences = Column(Text, nullable=True)

    role = relationship("Role", back_populates="users")
    uploaded_files = relationship("UploadedFile", back_populates="uploaded_by_user")
    generated_papers = relationship("GeneratedPaper", back_populates="created_by_user")
    activity_logs = relationship("ActivityLog", back_populates="user")
    folders = relationship("Folder", back_populates="user", cascade="all, delete-orphan")
    token_quota = relationship("TokenQuota", back_populates="user", uselist=False, cascade="all, delete-orphan")
    token_usage_logs = relationship("TokenUsageLog", back_populates="user", cascade="all, delete-orphan")
    generation_tasks = relationship("GenerationTask", back_populates="user", cascade="all, delete-orphan")
