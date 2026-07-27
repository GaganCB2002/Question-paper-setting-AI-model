import os
from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession, async_sessionmaker
from sqlalchemy.pool import NullPool, StaticPool
from app.config import settings

# Ensure all models are loaded for table creation
from app.models.base import Base
from app.models.user import User, Role, Permission, RolePermission
from app.models.uploaded_file import UploadedFile
from app.models.syllabus import Syllabus, Topic, SubTopic
from app.models.exam_pattern import ExamPattern
from app.models.question import PreviousYearQuestion, QuestionBank, GeneratedPaper, GeneratedQuestion
from app.models.answer_key import AnswerKey, Explanation
from app.models.current_affair import CurrentAffair, GovernmentScheme
from app.models.ocr_data import OCRData, Image
from app.models.ai_job import AIJob, PromptTemplate
from app.models.log import AuditLog, ActivityLog
from app.models.setting import Setting
from app.models.pdf_note import PDFNote, PDFBookmark, PDFAnnotation
from app.models.folder import Folder
from app.models.token_quota import TokenQuota, TokenUsageLog
from app.models.generation_task import GenerationTask, TaskPhase, TaskApproval


from loguru import logger


def _get_db_url() -> str:
    use_sqlite = os.environ.get("USE_SQLITE", "").lower() in ("1", "true", "yes")
    pg_unavailable = False
    if not use_sqlite:
        try:
            import asyncpg
        except ImportError:
            pg_unavailable = True
    if use_sqlite or pg_unavailable:
        db_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "data")
        os.makedirs(db_dir, exist_ok=True)
        db_path = os.path.join(db_dir, "kke.db")
        logger.info(f"Using SQLite: {db_path}")
        return f"sqlite+aiosqlite:///{db_path}"
    supabase_url = os.environ.get("SUPABASE_DB_URL") or settings.SUPABASE_DB_URL
    if supabase_url:
        logger.info("Using Supabase PostgreSQL")
        if supabase_url.startswith("postgresql+asyncpg://"):
            return supabase_url
        return supabase_url.replace("postgresql://", "postgresql+asyncpg://")
    return settings.DATABASE_URL


db_url = _get_db_url()
is_sqlite = "sqlite" in db_url

if is_sqlite:
    engine = create_async_engine(
        db_url,
        echo=settings.DEBUG,
        poolclass=StaticPool,
        connect_args={"check_same_thread": False},
    )
else:
    engine = create_async_engine(
        db_url,
        echo=settings.DEBUG,
        pool_pre_ping=True,
        pool_size=20,
        max_overflow=10,
    )

async_session_factory = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


async def get_db():
    session = async_session_factory()
    try:
        yield session
        await session.commit()
    except Exception:
        await session.rollback()
        raise
    finally:
        await session.close()


async def seed_test_user():
    from app.services.auth_service import AuthService
    from app.schemas.user import UserCreate
    from sqlalchemy import select, or_
    from app.models.user import User

    async with async_session_factory() as session:
        service = AuthService(session)
        result = await session.execute(
            select(User).where(
                or_(User.email == "test@kke.com", User.username == "testuser"),
                User.is_deleted == False,
            )
        )
        if result.scalar_one_or_none() is None:
            user_data = UserCreate(
                email="test@kke.com",
                username="testuser",
                full_name="Test User",
                password="Test@123",
                role="admin",
            )
            await service.create_user(user_data)
            await session.commit()
            logger.info("Test user created (test@kke.com / Test@123)")
        else:
            logger.info("Test user already exists")


async def init_db():
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    logger.info("All tables created successfully.")
    await seed_test_user()


async def close_db():
    await engine.dispose()
    logger.info("Engine disposed.")
