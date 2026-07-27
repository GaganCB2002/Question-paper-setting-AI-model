from pydantic import BaseModel, Field
from typing import Optional, Any
from datetime import datetime
import uuid


class QuestionGenerate(BaseModel):
    exam_name: str = Field(..., min_length=1)
    syllabus_id: Optional[uuid.UUID] = None
    exam_pattern_id: Optional[uuid.UUID] = None
    source_file_ids: list[uuid.UUID] = []
    language: str = "english"
    question_count: int = Field(default=50, ge=1, le=200)
    difficulty: str = "balanced"
    paper_set: str = "set_1"
    previous_year_ids: list[uuid.UUID] = []


class QuestionResponse(BaseModel):
    id: uuid.UUID
    question_number: int
    exam_name: str
    paper_set: str
    topic_name: Optional[str]
    sub_topic_name: Optional[str]
    difficulty: str
    language: str
    question_type: str
    question_text: str
    option_a: Optional[str]
    option_b: Optional[str]
    option_c: Optional[str]
    option_d: Optional[str]
    correct_answer: str
    correct_answer_text: Optional[str]
    explanation: Optional[str]
    reference_source: Optional[str]
    source_page_number: Optional[int]
    weightage: Optional[float]
    keywords: Optional[str]
    marks: int
    validation_status: str
    created_at: datetime

    class Config:
        from_attributes = True


class PaperResponse(BaseModel):
    id: uuid.UUID
    exam_name: str
    paper_set: str
    title: str
    language: str
    total_marks: int
    total_questions: int
    difficulty_profile: Optional[str]
    status: str
    is_published: bool
    generated_at: Optional[datetime] = None
    created_at: datetime

    class Config:
        from_attributes = True


class PaperDetailResponse(PaperResponse):
    questions: list[QuestionResponse] = []


class SearchRequest(BaseModel):
    query: Optional[str] = None
    topic: Optional[str] = None
    difficulty: Optional[str] = None
    language: Optional[str] = None
    question_type: Optional[str] = None
    exam_name: Optional[str] = None
    keyword: Optional[str] = None
    page: int = 1
    page_size: int = 20


class ValidationResult(BaseModel):
    is_valid: bool
    issues: list[str] = []
    grammar_ok: bool = False
    answer_unambiguous: bool = False
    options_balanced: bool = False
    difficulty_appropriate: bool = False
    fact_verified: bool = False
