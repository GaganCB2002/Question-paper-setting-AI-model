import uuid
from datetime import datetime, timedelta, timezone
from typing import Optional

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_
from sqlalchemy.orm import selectinload

from app.core.security import (
    get_password_hash,
    verify_password,
    create_access_token,
    create_refresh_token,
    decode_token,
)
from app.models.user import User, Role, Permission, RolePermission
from app.core.permissions import RoleEnum, PermissionEnum, ROLE_PERMISSIONS
from app.schemas.user import UserCreate, UserUpdate, LoginRequest


def _resolve_role(role_input: str | RoleEnum) -> RoleEnum:
    if isinstance(role_input, RoleEnum):
        return role_input
    if isinstance(role_input, str):
        try:
            return RoleEnum(role_input.lower())
        except ValueError:
            return RoleEnum.STUDENT
    return RoleEnum.STUDENT


class AuthService:
    def __init__(self, db: AsyncSession):
        self.db = db

    async def create_user(self, user_data: UserCreate, created_by: str = None) -> User:
        existing = await self.db.execute(
            select(User).where(
                or_(User.email == user_data.email, User.username == user_data.username),
                User.is_deleted == False,
            )
        )
        if existing.scalar_one_or_none():
            raise ValueError("User with this email or username already exists")

        role_enum = _resolve_role(user_data.role or RoleEnum.STUDENT)
        role = await self._get_or_create_role(role_enum)

        user = User(
            email=user_data.email,
            username=user_data.username,
            full_name=user_data.full_name,
            password_hash=get_password_hash(user_data.password),
            role_id=role.id,
            is_active=True,
            is_verified=False,
            created_by=created_by or user_data.username,
        )
        self.db.add(user)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def authenticate_user(self, login_data: LoginRequest) -> Optional[User]:
        result = await self.db.execute(
            select(User)
            .options(selectinload(User.role))
            .where(
                or_(User.email == login_data.username, User.username == login_data.username),
                User.is_deleted == False,
            )
        )
        user = result.unique().scalar_one_or_none()
        if user is None:
            return None
        if not user.is_active:
            raise ValueError("Account is deactivated")
        if user.locked_until and user.locked_until > datetime.now(timezone.utc):
            raise ValueError("Account is locked due to too many failed attempts. Try again later.")
        if not verify_password(login_data.password, user.password_hash):
            user.login_attempts = (user.login_attempts or 0) + 1
            if user.login_attempts >= 5:
                user.locked_until = datetime.now(timezone.utc) + timedelta(minutes=15)
            await self.db.flush()
            return None
        user.login_attempts = 0
        user.locked_until = None
        user.last_login_at = datetime.now(timezone.utc)
        await self.db.flush()
        return user

    async def login(self, login_data: LoginRequest) -> dict:
        try:
            user = await self.authenticate_user(login_data)
        except ValueError as e:
            raise e
        if user is None:
            raise ValueError("Invalid credentials")
        permissions = await self._get_user_permissions(user)
        access_token = create_access_token(
            subject=str(user.id),
            role=user.role.name if user.role else "student",
            permissions=permissions,
        )
        refresh_token = create_refresh_token(subject=str(user.id))
        return {
            "access_token": access_token,
            "refresh_token": refresh_token,
            "token_type": "bearer",
            "user": {
                "id": str(user.id),
                "email": user.email,
                "username": user.username,
                "full_name": user.full_name,
                "role": user.role.name if user.role else "student",
                "permissions": permissions,
            },
        }

    async def refresh_token(self, refresh_token: str) -> dict:
        payload = decode_token(refresh_token)
        if payload is None or payload.get("type") != "refresh":
            raise ValueError("Invalid refresh token")
        user_id = uuid.UUID(payload["sub"])
        result = await self.db.execute(
            select(User)
            .options(selectinload(User.role))
            .where(User.id == user_id, User.is_deleted == False)
        )
        user = result.unique().scalar_one_or_none()
        if user is None or not user.is_active:
            raise ValueError("User not found or inactive")
        permissions = await self._get_user_permissions(user)
        access_token = create_access_token(
            subject=str(user.id),
            role=user.role.name if user.role else "student",
            permissions=permissions,
        )
        return {"access_token": access_token, "token_type": "bearer"}

    async def get_user_by_id(self, user_id: uuid.UUID, load_role: bool = False) -> Optional[User]:
        query = select(User).where(User.id == user_id, User.is_deleted == False)
        if load_role:
            query = query.options(selectinload(User.role))
        result = await self.db.execute(query)
        return result.unique().scalar_one_or_none()

    async def update_user(self, user_id: uuid.UUID, user_data: UserUpdate) -> User:
        user = await self.get_user_by_id(user_id, load_role=True)
        if user is None:
            raise ValueError("User not found")
        update_data = user_data.model_dump(exclude_unset=True)
        if "password" in update_data:
            update_data["password_hash"] = get_password_hash(update_data.pop("password"))
        for field, value in update_data.items():
            setattr(user, field, value)
        await self.db.flush()
        await self.db.refresh(user)
        return user

    async def _get_or_create_role(self, role_enum: RoleEnum) -> Role:
        result = await self.db.execute(
            select(Role).where(Role.name == role_enum.value, Role.is_deleted == False)
        )
        role = result.scalar_one_or_none()
        if role is None:
            role = Role(
                name=role_enum.value,
                description=f"{role_enum.value.title()} role",
                is_system_role=True,
            )
            self.db.add(role)
            await self.db.flush()
            await self.db.refresh(role)
            await self._assign_role_permissions(role, ROLE_PERMISSIONS[role_enum])
        return role

    async def _assign_role_permissions(self, role: Role, permissions: list[PermissionEnum]):
        for perm_enum in permissions:
            result = await self.db.execute(
                select(Permission).where(
                    Permission.code == perm_enum.value,
                    Permission.is_deleted == False,
                )
            )
            perm = result.scalar_one_or_none()
            if perm is None:
                parts = perm_enum.value.split(":")
                perm = Permission(
                    name=perm_enum.value.replace(":", " ").title(),
                    code=perm_enum.value,
                    module=parts[0] if len(parts) > 0 else "general",
                )
                self.db.add(perm)
                await self.db.flush()
                await self.db.refresh(perm)
            rp = RolePermission(role_id=role.id, permission_id=perm.id)
            self.db.add(rp)
        await self.db.flush()

    async def _get_user_permissions(self, user: User) -> list[str]:
        if user.is_superuser:
            return [p.value for p in PermissionEnum]
        if user.role is None:
            return []
        result = await self.db.execute(
            select(Permission.code)
            .join(RolePermission, Permission.id == RolePermission.permission_id)
            .where(
                RolePermission.role_id == user.role_id,
                Permission.is_deleted == False,
            )
        )
        return [row[0] for row in result.all()]
