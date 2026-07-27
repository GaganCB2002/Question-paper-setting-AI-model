from pydantic_settings import BaseSettings
from typing import List, Optional
import json


class Settings(BaseSettings):
    APP_NAME: str = "KKE Question Paper Generator"
    APP_VERSION: str = "1.0.0"
    DEBUG: bool = False
    ENVIRONMENT: str = "development"

    HOST: str = "0.0.0.0"
    PORT: int = 8000
    WORKERS: int = 4
    CORS_ORIGINS: str = '["http://localhost:3000","http://localhost:5173"]'

    # Database: PostgreSQL (Supabase) or SQLite (dev via USE_SQLITE=1)
    DATABASE_URL: str = "postgresql+asyncpg://postgres:postgres@localhost:5432/kke_qp_generator"
    DATABASE_URL_SYNC: str = "postgresql+psycopg2://postgres:postgres@localhost:5432/kke_qp_generator"
    SUPABASE_URL: Optional[str] = None
    SUPABASE_KEY: Optional[str] = None
    SUPABASE_DB_URL: Optional[str] = None

    REDIS_URL: str = "redis://localhost:6379/0"

    JWT_SECRET_KEY: str = "kke-change-this-secret-key-in-production"
    JWT_ALGORITHM: str = "HS256"
    JWT_ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    JWT_REFRESH_TOKEN_EXPIRE_DAYS: int = 7

    GEMINI_API_KEY: str = ""
    GEMINI_MODEL: str = "gemini-2.0-flash"
    GEMINI_MAX_RETRIES: int = 3
    GEMINI_TIMEOUT: int = 120

    TESSERACT_CMD: str = "tesseract"
    TESSERACT_LANGS: str = "kan+eng"
    OCR_DPI: int = 300

    UPLOAD_DIR: str = "./uploads"
    MAX_FILE_SIZE_MB: int = 50
    ALLOWED_EXTENSIONS: str = "pdf,docx,doc,pptx,xlsx,png,jpg,jpeg,webp,txt"

    STORAGE_MODE: str = "local"

    CELERY_BROKER_URL: str = "redis://localhost:6379/1"
    CELERY_RESULT_BACKEND: str = "redis://localhost:6379/1"

    RATE_LIMIT_PER_MINUTE: int = 60
    RATE_LIMIT_PER_HOUR: int = 1000

    LOG_LEVEL: str = "INFO"
    LOG_FILE: str = "logs/app.log"

    @property
    def cors_origins_list(self) -> List[str]:
        try:
            return json.loads(self.CORS_ORIGINS)
        except (json.JSONDecodeError, TypeError):
            return ["http://localhost:3000", "http://localhost:5173"]

    @property
    def allowed_extensions_list(self) -> List[str]:
        return [ext.strip() for ext in self.ALLOWED_EXTENSIONS.split(",")]

    @property
    def max_file_size_bytes(self) -> int:
        return self.MAX_FILE_SIZE_MB * 1024 * 1024

    @property
    def effective_database_url(self) -> str:
        if self.SUPABASE_DB_URL:
            return self.SUPABASE_DB_URL.replace("postgresql://", "postgresql+asyncpg://")
        return self.DATABASE_URL

    class Config:
        env_file = ".env"
        env_file_encoding = "utf-8"
        case_sensitive = True


settings = Settings()
