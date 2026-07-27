import uuid
from datetime import datetime, timezone, date
from typing import Optional
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_
from app.models.token_quota import TokenQuota, TokenUsageLog
from app.models.user import User


DEFAULT_DAILY_LIMIT = 100000
DEFAULT_TOTAL_QUOTA = 1000000
NOTIFICATION_THRESHOLDS = [50, 75, 90, 100]


class TokenService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def get_or_create_quota(self, user_id: uuid.UUID) -> TokenQuota:
        result = await self.db.execute(
            select(TokenQuota).where(TokenQuota.user_id == user_id)
        )
        quota = result.scalar_one_or_none()
        if quota is None:
            today = date.today()
            quota = TokenQuota(
                user_id=user_id,
                daily_limit=DEFAULT_DAILY_LIMIT,
                daily_used=0,
                total_quota=DEFAULT_TOTAL_QUOTA,
                total_used=0,
                reset_date=datetime(today.year, today.month, today.day, 0, 0, 0, tzinfo=timezone.utc),
                created_by=str(user_id),
            )
            self.db.add(quota)
            await self.db.flush()
            await self.db.refresh(quota)
        else:
            today_str = date.today().isoformat()
            if quota.reset_date is None or quota.reset_date.date().isoformat() != today_str:
                quota.daily_used = 0
                quota.reset_date = datetime.now(timezone.utc)
                quota.last_notification_pct = 0
                await self.db.flush()
                await self.db.refresh(quota)
        return quota

    async def track_usage(
        self,
        user_id: uuid.UUID,
        tokens_used: int,
        endpoint: Optional[str] = None,
        model_used: Optional[str] = None,
        prompt_tokens: int = 0,
        completion_tokens: int = 0,
    ) -> dict:
        quota = await self.get_or_create_quota(user_id)
        today_str = date.today().isoformat()

        quota.daily_used = (quota.daily_used or 0) + tokens_used
        quota.total_used = (quota.total_used or 0) + tokens_used

        log = TokenUsageLog(
            user_id=user_id,
            date=today_str,
            tokens_used=tokens_used,
            endpoint=endpoint,
            model_used=model_used,
            prompt_tokens=prompt_tokens,
            completion_tokens=completion_tokens,
            created_by=str(user_id),
        )
        self.db.add(log)
        await self.db.flush()

        daily_pct = int((quota.daily_used / quota.daily_limit) * 100) if quota.daily_limit > 0 else 0
        total_pct = int((quota.total_used / quota.total_quota) * 100) if quota.total_quota > 0 else 0

        notifications = []
        for threshold in NOTIFICATION_THRESHOLDS:
            if daily_pct >= threshold and quota.last_notification_pct < threshold:
                quota.last_notification_pct = threshold
                notifications.append({
                    "type": "quota_warning",
                    "level": threshold,
                    "message": f"You have used {threshold}% of your daily token quota ({quota.daily_used}/{quota.daily_limit})",
                })

        await self.db.flush()
        await self.db.refresh(quota)

        return {
            "quota": {
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
            "notifications": notifications,
            "is_daily_limit_reached": daily_pct >= 100,
            "is_total_limit_reached": total_pct >= 100,
        }

    async def get_usage_stats(self, user_id: uuid.UUID, days: int = 30) -> dict:
        quota = await self.get_or_create_quota(user_id)

        from datetime import timedelta
        start_date = (date.today() - timedelta(days=days)).isoformat()
        result = await self.db.execute(
            select(
                TokenUsageLog.date,
                func.sum(TokenUsageLog.tokens_used),
                func.count(TokenUsageLog.id),
            )
            .where(
                TokenUsageLog.user_id == user_id,
                TokenUsageLog.date >= start_date,
                TokenUsageLog.is_deleted == False,
            )
            .group_by(TokenUsageLog.date)
            .order_by(TokenUsageLog.date)
        )
        daily_history = []
        for row in result:
            daily_history.append({
                "date": row[0],
                "tokens": row[1] or 0,
                "requests": row[2] or 0,
            })

        endpoint_result = await self.db.execute(
            select(
                TokenUsageLog.endpoint,
                func.sum(TokenUsageLog.tokens_used),
                func.count(TokenUsageLog.id),
            )
            .where(
                TokenUsageLog.user_id == user_id,
                TokenUsageLog.endpoint.isnot(None),
                TokenUsageLog.is_deleted == False,
            )
            .group_by(TokenUsageLog.endpoint)
            .order_by(func.sum(TokenUsageLog.tokens_used).desc())
            .limit(10)
        )
        top_endpoints = []
        for row in endpoint_result:
            top_endpoints.append({
                "endpoint": row[0],
                "tokens": row[1] or 0,
                "requests": row[2] or 0,
            })

        daily_pct = int((quota.daily_used / quota.daily_limit) * 100) if quota.daily_limit > 0 else 0
        total_pct = int((quota.total_used / quota.total_quota) * 100) if quota.total_quota > 0 else 0

        needs_notification = False
        for threshold in NOTIFICATION_THRESHOLDS:
            if daily_pct >= threshold > quota.last_notification_pct:
                needs_notification = True
                quota.last_notification_pct = threshold
                break

        await self.db.flush()

        return {
            "quota": {
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
            "daily_history": daily_history,
            "top_endpoints": top_endpoints,
            "needs_notification": needs_notification,
            "notify_thresholds": NOTIFICATION_THRESHOLDS,
        }

    async def check_quota(self, user_id: uuid.UUID, required_tokens: int = 0) -> dict:
        quota = await self.get_or_create_quota(user_id)
        daily_pct = int((quota.daily_used / quota.daily_limit) * 100) if quota.daily_limit > 0 else 0
        total_pct = int((quota.total_used / quota.total_quota) * 100) if quota.total_quota > 0 else 0

        daily_exceeded = (quota.daily_used + required_tokens) > quota.daily_limit
        total_exceeded = (quota.total_used + required_tokens) > quota.total_quota

        return {
            "can_generate": not (daily_exceeded or total_exceeded),
            "daily_exceeded": daily_exceeded,
            "total_exceeded": total_exceeded,
            "daily_remaining": max(0, quota.daily_limit - quota.daily_used),
            "total_remaining": max(0, quota.total_quota - quota.total_used),
            "daily_percentage": daily_pct,
            "total_percentage": total_pct,
        }
