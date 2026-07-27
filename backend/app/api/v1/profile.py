import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.services.token_service import TokenService

router = APIRouter(prefix="/profile", tags=["Profile"])


@router.get("/tokens")
async def get_token_usage(
    days: int = Query(30, ge=1, le=365),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = TokenService(db)
    stats = await service.get_usage_stats(current_user.id, days=days)
    return {"success": True, "data": stats}


@router.get("/quota")
async def get_quota(
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = TokenService(db)
    quota = await service.get_or_create_quota(current_user.id)
    daily_pct = int((quota.daily_used / quota.daily_limit) * 100) if quota.daily_limit > 0 else 0
    total_pct = int((quota.total_used / quota.total_quota) * 100) if quota.total_quota > 0 else 0
    return {
        "success": True,
        "data": {
            "daily_limit": quota.daily_limit,
            "daily_used": quota.daily_used,
            "daily_remaining": max(0, quota.daily_limit - quota.daily_used),
            "daily_percentage": daily_pct,
            "total_quota": quota.total_quota,
            "total_used": quota.total_used,
            "total_remaining": max(0, quota.total_quota - quota.total_used),
            "total_percentage": total_pct,
            "reset_date": quota.reset_date.isoformat() if quota.reset_date else None,
        },
    }


@router.get("/check-quota")
async def check_quota(
    required_tokens: int = Query(0, ge=0),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = TokenService(db)
    result = await service.check_quota(current_user.id, required_tokens)
    return {"success": True, "data": result}
