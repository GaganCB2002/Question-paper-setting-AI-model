from sqlalchemy import Column, String, Text, ForeignKey, Integer, Boolean
from sqlalchemy import Uuid
from sqlalchemy.orm import relationship
import uuid
from app.models.base import Base, TimestampMixin


class AnswerKey(Base, TimestampMixin):
    __tablename__ = "answer_keys"

    paper_id = Column(Uuid, ForeignKey("generated_papers.id"), nullable=False, index=True)
    question_id = Column(Uuid, ForeignKey("generated_questions.id"), nullable=False, unique=True)
    question_number = Column(Integer, nullable=False)
    correct_option = Column(String(10), nullable=False)
    correct_answer_text = Column(Text, nullable=True)
    marks = Column(Integer, default=1, nullable=False)
    negative_marks = Column(String(10), nullable=True)
    is_multi_correct = Column(Boolean, default=False, nullable=False)
    multi_correct_options = Column(String(50), nullable=True)
    explanation_short = Column(Text, nullable=True)
    explanation_detailed = Column(Text, nullable=True)
    reference_source = Column(String(500), nullable=True)
    topic = Column(String(300), nullable=True)
    difficulty = Column(String(50), nullable=True)

    paper = relationship("GeneratedPaper", back_populates="answer_keys")
    question = relationship("GeneratedQuestion", back_populates="answer_key")


class Explanation(Base, TimestampMixin):
    __tablename__ = "explanations"

    question_id = Column(Uuid, ForeignKey("generated_questions.id"), nullable=False, index=True)
    short_explanation = Column(Text, nullable=False)
    detailed_explanation = Column(Text, nullable=True)
    reference_source = Column(String(500), nullable=True)
    source_page = Column(Integer, nullable=True)
    verified_facts_json = Column(Text, nullable=True)
    fact_check_notes = Column(Text, nullable=True)
    language = Column(String(50), nullable=True)
    is_verified = Column(Boolean, default=False, nullable=False)

    question = relationship("GeneratedQuestion", back_populates="explanations")
