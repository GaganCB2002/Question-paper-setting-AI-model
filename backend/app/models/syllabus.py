from sqlalchemy import Column, String, Text, ForeignKey, Integer, Float, Boolean
from sqlalchemy import Uuid
from sqlalchemy.orm import relationship
import uuid
from app.models.base import Base, TimestampMixin


class Syllabus(Base, TimestampMixin):
    __tablename__ = "syllabi"

    file_id = Column(Uuid, ForeignKey("uploaded_files.id"), nullable=True, index=True)
    exam_name = Column(String(300), nullable=False, index=True)
    exam_type = Column(String(100), nullable=True, index=True)
    conducting_body = Column(String(300), nullable=True)
    year = Column(Integer, nullable=True, index=True)
    description = Column(Text, nullable=True)
    raw_text = Column(Text, nullable=True)
    total_marks = Column(Integer, nullable=True)
    total_questions = Column(Integer, nullable=True)
    duration_minutes = Column(Integer, nullable=True)
    language = Column(String(50), nullable=True)
    sections_json = Column(Text, nullable=True)
    is_official = Column(Boolean, default=False, nullable=False)
    source_url = Column(String(1000), nullable=True)
    source_notification = Column(String(500), nullable=True)

    file = relationship("UploadedFile", back_populates="syllabus")
    topics = relationship("Topic", back_populates="syllabus", cascade="all, delete-orphan")
    exam_patterns = relationship("ExamPattern", back_populates="syllabus")


class Topic(Base, TimestampMixin):
    __tablename__ = "topics"

    syllabus_id = Column(Uuid, ForeignKey("syllabi.id"), nullable=False, index=True)
    name = Column(String(300), nullable=False)
    code = Column(String(100), nullable=True, index=True)
    description = Column(Text, nullable=True)
    weightage = Column(Float, nullable=True)
    marks = Column(Integer, nullable=True)
    question_count = Column(Integer, nullable=True)
    order_index = Column(Integer, nullable=True)
    section = Column(String(200), nullable=True)
    language = Column(String(50), nullable=True)
    is_required = Column(Boolean, default=True, nullable=False)

    syllabus = relationship("Syllabus", back_populates="topics")
    sub_topics = relationship("SubTopic", back_populates="topic", cascade="all, delete-orphan")
    question_bank_entries = relationship("QuestionBank", back_populates="topic")
    generated_questions = relationship("GeneratedQuestion", back_populates="topic")


class SubTopic(Base, TimestampMixin):
    __tablename__ = "sub_topics"

    topic_id = Column(Uuid, ForeignKey("topics.id"), nullable=False, index=True)
    name = Column(String(300), nullable=False)
    code = Column(String(100), nullable=True)
    description = Column(Text, nullable=True)
    weightage = Column(Float, nullable=True)
    marks = Column(Integer, nullable=True)
    order_index = Column(Integer, nullable=True)
    language = Column(String(50), nullable=True)

    topic = relationship("Topic", back_populates="sub_topics")
    question_bank_entries = relationship("QuestionBank", back_populates="sub_topic")
    generated_questions = relationship("GeneratedQuestion", back_populates="sub_topic")
