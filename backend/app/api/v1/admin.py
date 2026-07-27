import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from sqlalchemy.orm import selectinload
from typing import Optional

from app.database import get_db
from app.api.deps import get_current_user, require_permissions
from app.core.permissions import PermissionEnum
from app.models.user import User, Role
from app.models.log import AuditLog, ActivityLog
from app.models.ai_job import AIJob
from app.models.setting import Setting
from app.models.question import GeneratedPaper, GeneratedQuestion, QuestionBank
from app.models.uploaded_file import UploadedFile
from app.schemas.user import UserResponse, UserUpdate
from app.services.auth_service import AuthService

router = APIRouter(prefix="/admin", tags=["Admin"])


@router.get("/dashboard")
async def get_dashboard(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions([PermissionEnum.AUDIT_READ])),
):
    user_count = await db.execute(select(func.count(User.id)).where(User.is_deleted == False))
    file_count = await db.execute(select(func.count(UploadedFile.id)).where(UploadedFile.is_deleted == False))
    paper_count = await db.execute(select(func.count(GeneratedPaper.id)).where(GeneratedPaper.is_deleted == False))
    question_count = await db.execute(select(func.count(GeneratedQuestion.id)).where(GeneratedQuestion.is_deleted == False))
    bank_count = await db.execute(select(func.count(QuestionBank.id)).where(QuestionBank.is_deleted == False))
    job_count = await db.execute(select(func.count(AIJob.id)).where(AIJob.is_deleted == False))

    recent_papers = await db.execute(
        select(GeneratedPaper).where(GeneratedPaper.is_deleted == False).order_by(GeneratedPaper.created_at.desc()).limit(5)
    )

    return {
        "stats": {
            "total_users": user_count.scalar() or 0,
            "total_files": file_count.scalar() or 0,
            "total_papers": paper_count.scalar() or 0,
            "total_questions": question_count.scalar() or 0,
            "question_bank_size": bank_count.scalar() or 0,
            "total_jobs": job_count.scalar() or 0,
        },
        "recent_papers": [
            {
                "id": str(p.id),
                "exam_name": p.exam_name,
                "title": p.title,
                "total_questions": p.total_questions,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in recent_papers.scalars().all()
        ],
    }


@router.get("/users", response_model=dict)
async def list_users(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions([PermissionEnum.USER_MANAGE])),
):
    query = select(User).options(selectinload(User.role)).where(User.is_deleted == False).order_by(User.created_at.desc())
    count_query = select(func.count(User.id)).where(User.is_deleted == False)
    total = (await db.execute(count_query)).scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(query.offset(offset).limit(page_size))
    users = result.scalars().all()

    return {
        "items": [
            UserResponse(
                id=u.id,
                email=u.email,
                username=u.username,
                full_name=u.full_name,
                role=u.role.name if u.role else None,
                is_active=u.is_active,
                is_verified=u.is_verified,
                is_superuser=u.is_superuser,
                phone=u.phone,
                avatar_url=u.avatar_url,
                last_login_at=u.last_login_at,
                created_at=u.created_at,
                updated_at=u.updated_at,
            )
            for u in users
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
    }


@router.put("/users/{user_id}", response_model=UserResponse)
async def update_user(
    user_id: uuid.UUID,
    user_data: UserUpdate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions([PermissionEnum.USER_MANAGE])),
):
    service = AuthService(db)
    try:
        user = await service.update_user(user_id, user_data)
        return UserResponse(
            id=user.id,
            email=user.email,
            username=user.username,
            full_name=user.full_name,
            role=user.role.name if user.role else None,
            is_active=user.is_active,
            is_verified=user.is_verified,
            is_superuser=user.is_superuser,
            phone=user.phone,
            avatar_url=user.avatar_url,
            last_login_at=user.last_login_at,
            created_at=user.created_at,
            updated_at=user.updated_at,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))


@router.get("/audit-logs", response_model=dict)
async def get_audit_logs(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    action: Optional[str] = Query(None),
    resource_type: Optional[str] = Query(None),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions([PermissionEnum.AUDIT_READ])),
):
    conditions = [AuditLog.is_deleted == False]
    if action:
        conditions.append(AuditLog.action == action)
    if resource_type:
        conditions.append(AuditLog.resource_type == resource_type)

    query = select(AuditLog).where(*conditions).order_by(AuditLog.created_at.desc())
    count_query = select(func.count(AuditLog.id)).where(*conditions)
    total = (await db.execute(count_query)).scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(query.offset(offset).limit(page_size))
    logs = result.scalars().all()

    return {
        "items": [
            {
                "id": str(log.id),
                "user_id": str(log.user_id) if log.user_id else None,
                "action": log.action,
                "resource_type": log.resource_type,
                "resource_id": log.resource_id,
                "ip_address": log.ip_address,
                "is_error": log.is_error,
                "execution_time_ms": log.execution_time_ms,
                "created_at": log.created_at.isoformat() if log.created_at else None,
            }
            for log in logs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
    }


@router.get("/settings", response_model=dict)
async def get_settings(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(require_permissions([PermissionEnum.SETTINGS_READ])),
):
    result = await db.execute(
        select(Setting).where(
            and_(Setting.is_deleted == False, Setting.is_public == True)
        ).order_by(Setting.group, Setting.key)
    )
    settings = result.scalars().all()
    return {
        "items": [
            {
                "id": str(s.id),
                "key": s.key,
                "value": s.value,
                "value_type": s.value_type,
                "group": s.group,
                "description": s.description,
            }
            for s in settings
        ]
    }


@router.get("/jobs", response_model=dict)
async def list_jobs(
    status_filter: Optional[str] = Query(None),
    job_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conditions = [AIJob.is_deleted == False]
    if status_filter:
        conditions.append(AIJob.status == status_filter)
    if job_type:
        conditions.append(AIJob.job_type == job_type)
    if not current_user.is_superuser:
        conditions.append(AIJob.user_id == current_user.id)

    query = select(AIJob).where(*conditions).order_by(AIJob.created_at.desc())
    count_query = select(func.count(AIJob.id)).where(*conditions)
    total = (await db.execute(count_query)).scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(query.offset(offset).limit(page_size))
    jobs = result.scalars().all()

    return {
        "items": [
            {
                "id": str(j.id),
                "job_type": j.job_type,
                "status": j.status,
                "progress": j.progress,
                "error_message": j.error_message,
                "started_at": j.started_at,
                "completed_at": j.completed_at,
                "created_at": j.created_at.isoformat() if j.created_at else None,
            }
            for j in jobs
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
    }
