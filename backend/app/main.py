import time
import sys
import os
from contextlib import asynccontextmanager
from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from sqlalchemy import text
from loguru import logger

from app.config import settings

logger.remove()
logger.add(sys.stderr, level=settings.LOG_LEVEL, format="<green>{time:HH:mm:ss}</green> | <level>{level}</level> | <cyan>{name}</cyan>:<cyan>{function}</cyan>:<cyan>{line}</cyan> - <level>{message}</level>")
log_dir = os.path.join(os.path.dirname(os.path.dirname(__file__)), "logs")
os.makedirs(log_dir, exist_ok=True)
logger.add(os.path.join(log_dir, "app.log"), rotation="10 MB", retention="7 days", level=settings.LOG_LEVEL)


@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info(f"Starting {settings.APP_NAME} v{settings.APP_VERSION}")
    logger.info(f"Environment: {settings.ENVIRONMENT}, Debug: {settings.DEBUG}")
    try:
        from app.database import init_db
        await init_db()
        logger.info("Database tables ready")
    except Exception as e:
        logger.warning(f"Database init skipped (non-critical): {e}")
        logger.info("The app will start but database operations may fail until DB is configured.")
    yield
    try:
        from app.database import close_db
        await close_db()
    except Exception:
        pass
    logger.info("Shutdown complete")


app = FastAPI(
    title=settings.APP_NAME,
    version=settings.APP_VERSION,
    description="AI Question Paper Generator for Karnataka Government Exams",
    docs_url="/docs",
    redoc_url="/redoc",
    lifespan=lifespan,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins_list,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.middleware("http")
async def log_requests(request: Request, call_next):
    start_time = time.time()
    response = await call_next(request)
    process_time = (time.time() - start_time) * 1000
    logger.info(f"{request.method} {request.url.path} - {response.status_code} - {process_time:.2f}ms")
    response.headers["X-Process-Time-Ms"] = str(int(process_time))
    return response


@app.middleware("http")
async def add_security_headers(request: Request, call_next):
    response = await call_next(request)
    response.headers["X-Content-Type-Options"] = "nosniff"
    response.headers["X-Frame-Options"] = "DENY"
    response.headers["X-XSS-Protection"] = "1; mode=block"
    response.headers["Strict-Transport-Security"] = "max-age=31536000; includeSubDomains"
    response.headers["Cache-Control"] = "no-store"
    return response


@app.exception_handler(Exception)
async def global_exception_handler(request: Request, exc: Exception):
    import traceback
    logger.error(f"Unhandled error: {str(exc)}\n{traceback.format_exc()}")
    return JSONResponse(
        status_code=500,
        content={
            "detail": "An internal error occurred",
            "error": str(exc) if settings.DEBUG else "Internal server error",
        },
    )


from app.api.v1 import auth, files, questions, syllabus, search, pdf_reader, admin, folders, profile, tasks

app.include_router(auth.router, prefix="/api/v1")
app.include_router(files.router, prefix="/api/v1")
app.include_router(questions.router, prefix="/api/v1")
app.include_router(syllabus.router, prefix="/api/v1")
app.include_router(search.router, prefix="/api/v1")
app.include_router(pdf_reader.router, prefix="/api/v1")
app.include_router(admin.router, prefix="/api/v1")
app.include_router(folders.router, prefix="/api/v1")
app.include_router(profile.router, prefix="/api/v1")
app.include_router(tasks.router, prefix="/api/v1")


@app.get("/api/health")
async def health_check():
    db_status = "unchecked"
    try:
        from app.database import async_session_factory
        from sqlalchemy import text
        async with async_session_factory() as sess:
            await sess.execute(text("SELECT 1"))
            db_status = "healthy"
    except Exception as e:
        db_status = f"unhealthy: {e}"

    return {
        "status": "healthy",
        "app": settings.APP_NAME,
        "version": settings.APP_VERSION,
        "environment": settings.ENVIRONMENT,
        "database": db_status,
        "debug": settings.DEBUG,
    }
