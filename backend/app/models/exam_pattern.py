from sqlalchemy import Column, String, Text, ForeignKey, Integer, Float, Boolean
from sqlalchemy import Uuid
from sqlalchemy.orm import relationship
import uuid
from app.models.base import Base, TimestampMixin


class ExamPattern(Base, TimestampMixin):
    __tablename__ = "exam_patterns"

    syllabus_id = Column(Uuid, ForeignKey("syllabi.id"), nullable=True, index=True)
    file_id = Column(Uuid, ForeignKey("uploaded_files.id"), nullable=True)
    exam_name = Column(String(300), nullable=False, index=True)
    exam_type = Column(String(100), nullable=True)
    pattern_year = Column(Integer, nullable=True)
    total_marks = Column(Integer, nullable=True)
    total_questions = Column(Integer, nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    sections_json = Column(Text, nullable=True)
    marking_scheme_json = Column(Text, nullable=True)
    negative_marking = Column(Float, nullable=True)
    passing_marks = Column(Integer, nullable=True)
    difficulty_distribution_json = Column(Text, nullable=True)
    language = Column(String(50), nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    source = Column(String(500), nullable=True)
    raw_text = Column(Text, nullable=True)

    syllabus = relationship("Syllabus", back_populates="exam_patterns")
    file = relationship("UploadedFile", back_populates="exam_patterns")
    generated_papers = relationship("GeneratedPaper", back_populates="exam_pattern")
