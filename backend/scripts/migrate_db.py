"""Database schema migration utilities for PostgreSQL/Supabase.

All functions listed in run_all_migrations are executed:
  - On app startup (via init_db in database.py)
  - On file upload (via files.py upload endpoint)
"""

import sqlalchemy as sa
from sqlalchemy.ext.asyncio import AsyncSession
from loguru import logger


async def ensure_uploaded_file_columns(db: AsyncSession) -> None:
    result = await db.execute(
        sa.text("SELECT column_name FROM information_schema.columns WHERE table_name = :table"),
        {"table": "uploaded_files"},
    )
    existing = {row[0] for row in result}

    migrations = {
        "folder_id": "UUID REFERENCES folders(id)",
        "is_deleted": "BOOLEAN DEFAULT FALSE",
        "deleted_at": "TIMESTAMPTZ",
        "deleted_by": "VARCHAR(255)",
    }

    for col, col_type in migrations.items():
        if col not in existing:
            logger.info(f"Adding column {col} to uploaded_files...")
            await db.execute(sa.text(f"ALTER TABLE uploaded_files ADD COLUMN {col} {col_type}"))
            logger.info(f"Column {col} added.")

    await db.commit()


async def run_all_migrations(db: AsyncSession) -> None:
    """Execute all registered migration functions in order."""
    logger.info("Running database migrations...")
    await ensure_uploaded_file_columns(db)
    logger.info("All migrations complete.")
