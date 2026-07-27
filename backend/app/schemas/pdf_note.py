from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid


class PDFNoteCreate(BaseModel):
    file_id: uuid.UUID
    page_number: int = Field(..., ge=1)
    note_type: str = "highlight"
    content: Optional[str] = None
    color: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    rect_json: Optional[str] = None
    text_content: Optional[str] = None
    tags: Optional[str] = None


class PDFNoteResponse(BaseModel):
    id: uuid.UUID
    file_id: uuid.UUID
    user_id: uuid.UUID
    page_number: int
    note_type: str
    content: Optional[str]
    color: Optional[str]
    position_x: Optional[float]
    position_y: Optional[float]
    width: Optional[float]
    height: Optional[float]
    text_content: Optional[str]
    tags: Optional[str]
    is_archived: bool
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class PDFBookmarkCreate(BaseModel):
    file_id: uuid.UUID
    page_number: int = Field(..., ge=1)
    label: str = Field(..., min_length=1, max_length=300)
    description: Optional[str] = None
    color: Optional[str] = None


class PDFBookmarkResponse(BaseModel):
    id: uuid.UUID
    file_id: uuid.UUID
    page_number: int
    label: str
    description: Optional[str]
    color: Optional[str]
    created_at: datetime

    class Config:
        from_attributes = True


class PDFAnnotationCreate(BaseModel):
    file_id: uuid.UUID
    page_number: int = Field(..., ge=1)
    annotation_type: str = "text"
    content: Optional[str] = None
    position_x: Optional[float] = None
    position_y: Optional[float] = None
    width: Optional[float] = None
    height: Optional[float] = None
    rect_json: Optional[str] = None
    color: Optional[str] = None
    opacity: Optional[float] = None
    font_size: Optional[int] = None
    font_color: Optional[str] = None


class PDFAnnotationResponse(BaseModel):
    id: uuid.UUID
    file_id: uuid.UUID
    page_number: int
    annotation_type: str
    content: Optional[str]
    position_x: Optional[float]
    position_y: Optional[float]
    width: Optional[float]
    height: Optional[float]
    color: Optional[str]
    opacity: Optional[float]
    created_at: datetime

    class Config:
        from_attributes = True
