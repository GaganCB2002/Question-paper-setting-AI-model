from sqlalchemy import Column, String, Text, ForeignKey, Integer, Float, Boolean
from sqlalchemy import Uuid
from sqlalchemy.orm import relationship
import uuid
from app.models.base import Base, TimestampMixin


class PDFNote(Base, TimestampMixin):
    __tablename__ = "pdf_notes"

    file_id = Column(Uuid, ForeignKey("uploaded_files.id"), nullable=False, index=True)
    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False, index=True)
    page_number = Column(Integer, nullable=False)
    note_type = Column(String(50), default="highlight", nullable=False, index=True)
    content = Column(Text, nullable=True)
    color = Column(String(20), nullable=True)
    position_x = Column(Float, nullable=True)
    position_y = Column(Float, nullable=True)
    width = Column(Float, nullable=True)
    height = Column(Float, nullable=True)
    rect_json = Column(Text, nullable=True)
    text_content = Column(String(1000), nullable=True)
    page_label = Column(String(50), nullable=True)
    is_public = Column(Boolean, default=False, nullable=False)
    tags = Column(String(500), nullable=True)
    metadata_json = Column(Text, nullable=True)
    is_archived = Column(Boolean, default=False, nullable=False)

    file = relationship("UploadedFile")
    user = relationship("User")


class PDFBookmark(Base, TimestampMixin):
    __tablename__ = "pdf_bookmarks"

    file_id = Column(Uuid, ForeignKey("uploaded_files.id"), nullable=False, index=True)
    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False, index=True)
    page_number = Column(Integer, nullable=False)
    label = Column(String(300), nullable=False)
    description = Column(Text, nullable=True)
    color = Column(String(20), nullable=True)

    file = relationship("UploadedFile")
    user = relationship("User")


class PDFAnnotation(Base, TimestampMixin):
    __tablename__ = "pdf_annotations"

    file_id = Column(Uuid, ForeignKey("uploaded_files.id"), nullable=False, index=True)
    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False, index=True)
    page_number = Column(Integer, nullable=False)
    annotation_type = Column(String(50), nullable=False)
    content = Column(Text, nullable=True)
    position_x = Column(Float, nullable=True)
    position_y = Column(Float, nullable=True)
    width = Column(Float, nullable=True)
    height = Column(Float, nullable=True)
    rect_json = Column(Text, nullable=True)
    color = Column(String(20), nullable=True)
    opacity = Column(Float, nullable=True)
    font_size = Column(Integer, nullable=True)
    font_color = Column(String(20), nullable=True)
    metadata_json = Column(Text, nullable=True)
    is_public = Column(Boolean, default=False, nullable=False)

    file = relationship("UploadedFile")
    user = relationship("User")
