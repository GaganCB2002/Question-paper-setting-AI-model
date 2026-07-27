import os
import uuid
import asyncio
import pytest
import pytest_asyncio
from typing import AsyncGenerator, Generator
from httpx import AsyncClient, ASGITransport
from sqlalchemy.ext.asyncio import AsyncSession, create_async_engine, async_sessionmaker
from sqlalchemy.pool import StaticPool

os.environ["USE_SQLITE"] = "1"
os.environ["JWT_SECRET_KEY"] = "test-secret-key"
os.environ["GEMINI_API_KEY"] = "test-key"

from sqlalchemy import select
from app.database import get_db, async_session_factory, engine as main_engine
from app.main import app
from app.models.base import Base
from app.core.security import get_password_hash
from app.models.user import User, Role, RolePermission, Permission
from app.core.permissions import RoleEnum, PermissionEnum, ROLE_PERMISSIONS


@pytest.fixture(scope="session")
def event_loop():
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    yield loop
    loop.close()


@pytest_asyncio.fixture(scope="session")
async def db_engine():
    engine = create_async_engine(
        "sqlite+aiosqlite:///./tests/test.db",
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    yield engine
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.drop_all)
    await engine.dispose()


@pytest_asyncio.fixture
async def db_session(db_engine) -> AsyncGenerator[AsyncSession, None]:
    session_factory = async_sessionmaker(
        db_engine, class_=AsyncSession, expire_on_commit=False
    )
    async with session_factory() as session:
        yield session
        await session.rollback()


@pytest_asyncio.fixture
async def client(db_session: AsyncSession) -> AsyncGenerator[AsyncClient, None]:
    async def override_get_db():
        yield db_session

    app.dependency_overrides[get_db] = override_get_db
    transport = ASGITransport(app=app)
    async with AsyncClient(transport=transport, base_url="http://test") as ac:
        yield ac
    app.dependency_overrides.clear()


@pytest_asyncio.fixture
async def test_role(db_session: AsyncSession) -> Role:
    role = Role(
        name=RoleEnum.ADMIN.value,
        description="Test Admin",
        is_system_role=True,
    )
    db_session.add(role)
    await db_session.flush()

    for perm_enum in PermissionEnum:
        q = select(Permission).where(Permission.code == perm_enum.value)
        result = await db_session.execute(q)
        perm = result.scalar_one_or_none()
        if perm is None:
            perm = Permission(
                name=perm_enum.value.replace(":", " ").title(),
                code=perm_enum.value,
                module=perm_enum.value.split(":")[0],
            )
            db_session.add(perm)
            await db_session.flush()

    result = await db_session.execute(select(Permission))
    all_perms = result.scalars().all()
    for p in all_perms:
        rp = RolePermission(role_id=role.id, permission_id=p.id)
        db_session.add(rp)
    await db_session.flush()
    return role


@pytest_asyncio.fixture
async def test_user(db_session: AsyncSession, test_role: Role) -> User:
    user = User(
        email="test@example.com",
        username="testuser",
        full_name="Test User",
        password_hash=get_password_hash("TestPass123!"),
        role_id=test_role.id,
        is_active=True,
        is_verified=True,
        is_superuser=True,
    )
    db_session.add(user)
    await db_session.flush()
    await db_session.refresh(user)
    return user


@pytest_asyncio.fixture
async def auth_headers(client: AsyncClient, test_user: User) -> dict:
    response = await client.post("/api/v1/auth/login", json={
        "username": "testuser",
        "password": "TestPass123!",
    })
    data = response.json()
    return {"Authorization": f"Bearer {data['access_token']}"}
