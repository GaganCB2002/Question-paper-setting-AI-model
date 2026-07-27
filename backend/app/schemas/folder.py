from pydantic import BaseModel, Field
from typing import Optional
from datetime import datetime
import uuid


class FolderCreate(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    description: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None
    color: Optional[str] = None
    icon: Optional[str] = None


class FolderUpdate(BaseModel):
    name: Optional[str] = Field(None, min_length=1, max_length=255)
    description: Optional[str] = None
    parent_id: Optional[uuid.UUID] = None
    color: Optional[str] = None
    icon: Optional[str] = None


class FolderResponse(BaseModel):
    id: uuid.UUID
    name: str
    description: Optional[str]
    parent_id: Optional[uuid.UUID]
    color: Optional[str]
    icon: Optional[str]
    sort_order: Optional[int]
    file_count: int = 0
    created_at: datetime
    updated_at: datetime

    class Config:
        from_attributes = True


class FolderTreeResponse(FolderResponse):
    children: list["FolderTreeResponse"] = []


class FolderDetailResponse(FolderResponse):
    children: list["FolderTreeResponse"] = []
    files: list = []
