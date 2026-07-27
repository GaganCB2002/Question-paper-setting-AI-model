from sqlalchemy import Column, String, Text, ForeignKey, Integer, Float, Boolean
from sqlalchemy import Uuid
from sqlalchemy.orm import relationship
import uuid
from app.models.base import Base, TimestampMixin


class AIJob(Base, TimestampMixin):
    __tablename__ = "ai_jobs"

    user_id = Column(Uuid, ForeignKey("users.id"), nullable=True, index=True)
    job_type = Column(String(100), nullable=False, index=True)
    status = Column(String(50), default="queued", nullable=False, index=True)
    priority = Column(Integer, default=0, nullable=False)
    progress = Column(Float, default=0.0, nullable=True)
    input_data_json = Column(Text, nullable=True)
    output_data_json = Column(Text, nullable=True)
    error_message = Column(Text, nullable=True)
    error_traceback = Column(Text, nullable=True)
    started_at = Column(String(50), nullable=True)
    completed_at = Column(String(50), nullable=True)
    processing_time_ms = Column(Integer, nullable=True)
    retry_count = Column(Integer, default=0, nullable=True)
    max_retries = Column(Integer, default=3, nullable=True)
    webhook_url = Column(String(1000), nullable=True)
    celery_task_id = Column(String(255), nullable=True, index=True)
    ai_model = Column(String(100), nullable=True)
    prompt_tokens = Column(Integer, nullable=True)
    completion_tokens = Column(Integer, nullable=True)
    total_tokens = Column(Integer, nullable=True)
    cost_estimate = Column(Float, nullable=True)
    file_id = Column(Uuid, ForeignKey("uploaded_files.id"), nullable=True)
    result_file_path = Column(String(1000), nullable=True)


class PromptTemplate(Base, TimestampMixin):
    __tablename__ = "prompt_templates"

    name = Column(String(200), unique=True, nullable=False, index=True)
    code = Column(String(200), unique=True, nullable=False, index=True)
    description = Column(Text, nullable=True)
    category = Column(String(100), nullable=False, index=True)
    system_prompt = Column(Text, nullable=False)
    user_prompt_template = Column(Text, nullable=False)
    variables_json = Column(Text, nullable=True)
    parameters_json = Column(Text, nullable=True)
    model = Column(String(100), nullable=True)
    temperature = Column(Float, nullable=True)
    max_output_tokens = Column(Integer, nullable=True)
    top_p = Column(Float, nullable=True)
    top_k = Column(Integer, nullable=True)
    is_active = Column(Boolean, default=True, nullable=False)
    version = Column(Integer, default=1, nullable=False)
    language = Column(String(50), nullable=True)
    usage_count = Column(Integer, default=0, nullable=True)
    success_rate = Column(Float, nullable=True)
    average_rating = Column(Float, nullable=True)
