from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import uuid


class FileUploadResponse(BaseModel):
    id: uuid.UUID
    original_filename: str
    stored_filename: str
    file_size: int
    mime_type: str
    extension: str
    language: Optional[str]
    detected_language: Optional[str]
    page_count: Optional[int]
    is_processed: bool
    ocr_processed: bool
    created_at: datetime

    class Config:
        from_attributes = True


class FileProcessResponse(BaseModel):
    file_id: uuid.UUID
    status: str
    message: str
    language: Optional[str]
    page_count: Optional[int]
    text_length: Optional[int]
    tables_count: Optional[int]
    headings_count: Optional[int]
    ocr_confidence: Optional[float]
