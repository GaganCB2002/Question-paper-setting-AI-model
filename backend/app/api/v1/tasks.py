import uuid
import json
from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional
from pydantic import BaseModel, Field

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.services.task_service import TaskService

router = APIRouter(prefix="/tasks", tags=["Tasks"])


class CreatePlanRequest(BaseModel):
    syllabus_text: str = Field(..., min_length=10)
    exam_name: str = Field(default="General")
    language: str = Field(default="english")
    difficulty: str = Field(default="balanced")
    total_questions: int = Field(default=100, ge=10, le=500)
    questions_per_phase: int = Field(default=25, ge=5, le=100)


class ApprovePlanRequest(BaseModel):
    approve: bool = True
    reason: str = ""


@router.post("/create-plan")
async def create_plan(
    request: CreatePlanRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = TaskService(db)
    try:
        plan = await service.create_plan(
            user_id=current_user.id,
            syllabus_text=request.syllabus_text,
            exam_name=request.exam_name,
            language=request.language,
            difficulty=request.difficulty,
            total_questions=request.total_questions,
            questions_per_phase=request.questions_per_phase,
        )
        return {"success": True, "data": plan}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{task_id}/approve")
async def approve_plan(
    task_id: uuid.UUID,
    request: ApprovePlanRequest,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = TaskService(db)
    try:
        result = await service.approve_plan(task_id, current_user.id, request.approve, request.reason)
        return {"success": True, "data": result}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/{task_id}/start")
async def start_task(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = TaskService(db)

    async def event_stream():
        try:
            async for event in service.start_task(task_id, current_user.id):
                yield f"data: {json.dumps(event, default=str)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, default=str)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/{task_id}/status")
async def get_task_status(
    task_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = TaskService(db)
    try:
        status_data = await service.get_task_status(task_id, current_user.id)
        return {"success": True, "data": status_data}
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail=str(e))


@router.post("/auto-resume")
async def auto_resume_tasks(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = TaskService(db)
    try:
        result = await service.auto_resume_paused_tasks(current_user.id)
        return {"success": True, "data": result}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/")
async def list_tasks(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = TaskService(db)
    tasks = await service.list_user_tasks(current_user.id, page, page_size)
    return {"success": True, "data": tasks}
