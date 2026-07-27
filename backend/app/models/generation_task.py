from sqlalchemy import Column, String, BigInteger, Integer, Text, ForeignKey, Boolean, DateTime, JSON
from sqlalchemy import Uuid
from sqlalchemy.orm import relationship
import uuid
from app.models.base import Base, TimestampMixin


class GenerationTask(Base, TimestampMixin):
    __tablename__ = "generation_tasks"

    user_id = Column(Uuid, ForeignKey("users.id"), nullable=False, index=True)
    title = Column(String(500), nullable=False)
    syllabus_text = Column(Text, nullable=True)
    exam_name = Column(String(200), default="General")
    language = Column(String(50), default="english")
    difficulty = Column(String(50), default="balanced")
    total_questions_planned = Column(Integer, default=100)
    total_questions_generated = Column(Integer, default=0)
    status = Column(String(50), default="planning", index=True)
    current_phase = Column(Integer, default=0)
    total_phases = Column(Integer, default=0)
    phase_plan_json = Column(Text, nullable=True)
    metadata_json = Column(Text, nullable=True)
    last_question_hash = Column(String(128), nullable=True)
    paused_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    user = relationship("User", back_populates="generation_tasks")
    phases = relationship("TaskPhase", back_populates="task", cascade="all, delete-orphan", order_by="TaskPhase.phase_number")
    approvals = relationship("TaskApproval", back_populates="task", cascade="all, delete-orphan")


class TaskPhase(Base, TimestampMixin):
    __tablename__ = "task_phases"

    task_id = Column(Uuid, ForeignKey("generation_tasks.id"), nullable=False, index=True)
    phase_number = Column(Integer, nullable=False)
    title = Column(String(500), nullable=True)
    description = Column(Text, nullable=True)
    topic = Column(String(300), nullable=True)
    question_count_planned = Column(Integer, default=0)
    question_count_generated = Column(Integer, default=0)
    status = Column(String(50), default="pending", index=True)
    started_at = Column(DateTime, nullable=True)
    completed_at = Column(DateTime, nullable=True)
    paused_at = Column(DateTime, nullable=True)
    error_message = Column(Text, nullable=True)

    task = relationship("GenerationTask", back_populates="phases")


class TaskApproval(Base, TimestampMixin):
    __tablename__ = "task_approvals"

    task_id = Column(Uuid, ForeignKey("generation_tasks.id"), nullable=False, index=True)
    status = Column(String(50), default="pending", index=True)
    phase_plan_summary = Column(Text, nullable=True)
    approved_by = Column(Uuid, ForeignKey("users.id"), nullable=True)
    approved_at = Column(DateTime, nullable=True)
    rejected_reason = Column(Text, nullable=True)

    task = relationship("GenerationTask", back_populates="approvals")
    approver = relationship("User", foreign_keys=[approved_by])
