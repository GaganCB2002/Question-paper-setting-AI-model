from sqlalchemy import Column, String, BigInteger, Text, ForeignKey, Integer, Float, Boolean
from sqlalchemy import Uuid
from sqlalchemy.orm import relationship
import uuid
from app.models.base import Base, TimestampMixin


class UploadedFile(Base, TimestampMixin):
    __tablename__ = "uploaded_files"

    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False, index=True)
    folder_id = Column(Uuid, ForeignKey("folders.id"), nullable=True, index=True)
    original_filename = Column(String(500), nullable=False)
    stored_filename = Column(String(500), nullable=False)
    file_path = Column(String(1000), nullable=False)
    file_size = Column(BigInteger, nullable=False)
    mime_type = Column(String(100), nullable=False)
    file_hash = Column(String(128), nullable=True, index=True)
    extension = Column(String(20), nullable=False)
    language = Column(String(50), nullable=True, index=True)
    detected_language = Column(String(50), nullable=True)
    page_count = Column(Integer, nullable=True)
    extracted_text = Column(Text, nullable=True)
    extracted_text_path = Column(String(1000), nullable=True)
    ocr_text = Column(Text, nullable=True)
    ocr_text_path = Column(String(1000), nullable=True)
    ocr_confidence = Column(Float, nullable=True)
    ocr_processed = Column(Boolean, default=False, nullable=False)
    metadata_json = Column(Text, nullable=True)
    storage_mode = Column(String(20), default="local", nullable=False)
    storage_path = Column(String(1000), nullable=True)
    thumbnail_path = Column(String(1000), nullable=True)
    is_processed = Column(Boolean, default=False, nullable=False)
    processing_error = Column(Text, nullable=True)
    processing_started_at = Column(String(50), nullable=True)
    processing_completed_at = Column(String(50), nullable=True)

    uploaded_by_user = relationship("User", back_populates="uploaded_files")
    folder = relationship("Folder", back_populates="uploaded_files")
    ocr_data = relationship("OCRData", back_populates="file", uselist=False, cascade="all, delete-orphan")
    images = relationship("Image", back_populates="file", cascade="all, delete-orphan")
    syllabus = relationship("Syllabus", back_populates="file", uselist=False)
    exam_patterns = relationship("ExamPattern", back_populates="file")
    previous_year_questions = relationship("PreviousYearQuestion", back_populates="file")
    question_bank_entries = relationship("QuestionBank", back_populates="file")
