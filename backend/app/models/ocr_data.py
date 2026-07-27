from sqlalchemy import Column, String, Text, ForeignKey, Integer, Float, Boolean
from sqlalchemy import Uuid
from sqlalchemy.orm import relationship
import uuid
from app.models.base import Base, TimestampMixin


class OCRData(Base, TimestampMixin):
    __tablename__ = "ocr_data"

    file_id = Column(Uuid, ForeignKey("uploaded_files.id"), nullable=False, unique=True, index=True)
    raw_text = Column(Text, nullable=True)
    cleaned_text = Column(Text, nullable=True)
    ocr_engine = Column(String(50), nullable=True)
    ocr_confidence = Column(Float, nullable=True)
    language_detected = Column(String(50), nullable=True)
    language_confidence = Column(Float, nullable=True)
    processing_time_ms = Column(Integer, nullable=True)
    page_count = Column(Integer, nullable=True)
    total_words = Column(Integer, nullable=True)
    total_characters = Column(Integer, nullable=True)
    orientation = Column(String(20), nullable=True)
    image_quality = Column(String(50), nullable=True)
    enhancement_applied = Column(Boolean, default=False, nullable=False)
    noise_removed = Column(Boolean, default=False, nullable=False)
    deskewed = Column(Boolean, default=False, nullable=False)
    tables_detected = Column(Integer, default=0, nullable=True)
    tables_json = Column(Text, nullable=True)
    headings_detected = Column(Integer, default=0, nullable=True)
    headings_json = Column(Text, nullable=True)
    page_numbers_detected = Column(Integer, default=0, nullable=True)
    page_numbers_json = Column(Text, nullable=True)
    duplicates_removed = Column(Integer, default=0, nullable=True)
    paragraphs_json = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)

    file = relationship("UploadedFile", back_populates="ocr_data")


class Image(Base, TimestampMixin):
    __tablename__ = "images"

    file_id = Column(Uuid, ForeignKey("uploaded_files.id"), nullable=False, index=True)
    image_path = Column(String(1000), nullable=False)
    thumbnail_path = Column(String(1000), nullable=True)
    page_number = Column(Integer, nullable=True)
    width = Column(Integer, nullable=True)
    height = Column(Integer, nullable=True)
    dpi = Column(Integer, nullable=True)
    format = Column(String(20), nullable=True)
    size_bytes = Column(Integer, nullable=True)
    hash = Column(String(128), nullable=True)
    ocr_text = Column(Text, nullable=True)
    ocr_confidence = Column(Float, nullable=True)
    is_enhanced = Column(Boolean, default=False, nullable=False)
    enhancement_type = Column(String(100), nullable=True)
    contains_table = Column(Boolean, default=False, nullable=False)
    contains_text = Column(Boolean, default=True, nullable=False)
    language_detected = Column(String(50), nullable=True)
    metadata_json = Column(Text, nullable=True)

    file = relationship("UploadedFile", back_populates="images")
