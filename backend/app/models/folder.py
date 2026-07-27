from sqlalchemy import Column, String, Text, ForeignKey, Integer, Boolean
from sqlalchemy import Uuid
from sqlalchemy.orm import relationship
import uuid
from app.models.base import Base, TimestampMixin


class Folder(Base, TimestampMixin):
    __tablename__ = "folders"

    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False, index=True)
    parent_id = Column(Uuid, ForeignKey("folders.id"), nullable=True, index=True)
    name = Column(String(255), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(20), nullable=True)
    icon = Column(String(50), nullable=True)
    sort_order = Column(Integer, default=0, nullable=True)

    user = relationship("User", back_populates="folders")
    parent = relationship("Folder", remote_side="Folder.id", back_populates="children")
    children = relationship("Folder", back_populates="parent", cascade="all, delete-orphan")
    uploaded_files = relationship("UploadedFile", back_populates="folder")
