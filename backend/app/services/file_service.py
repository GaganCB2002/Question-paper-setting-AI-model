import os
import uuid
import hashlib
import shutil
from datetime import datetime, timezone
from typing import Optional, BinaryIO
from pathlib import Path

import aiofiles
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.config import settings
from app.models.uploaded_file import UploadedFile

try:
    import magic
    HAS_MAGIC = True
except ImportError:
    HAS_MAGIC = False


ALLOWED_EXTENSIONS_SET = {"pdf", "docx", "doc", "pptx", "xlsx", "png", "jpg", "jpeg", "webp", "txt"}

EXTENSION_MIME_MAP = {
    "pdf": "application/pdf",
    "docx": "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
    "doc": "application/msword",
    "pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
    "xlsx": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    "png": "image/png",
    "jpg": "image/jpeg",
    "jpeg": "image/jpeg",
    "webp": "image/webp",
    "txt": "text/plain",
}


class FileService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.upload_dir = Path(settings.UPLOAD_DIR)
        self.upload_dir.mkdir(parents=True, exist_ok=True)

    async def upload_file(
        self,
        file_content: bytes,
        original_filename: str,
        user_id: uuid.UUID,
        mime_type: Optional[str] = None,
        folder_id: Optional[uuid.UUID] = None,
    ) -> UploadedFile:
        ext = original_filename.split(".")[-1].lower() if "." in original_filename else ""
        if ext not in ALLOWED_EXTENSIONS_SET:
            allowed_list = ", ".join(sorted(ALLOWED_EXTENSIONS_SET))
            raise ValueError(f"File extension '.{ext}' is not supported. Allowed: {allowed_list}")

        if mime_type is None and HAS_MAGIC:
            try:
                mime_type = magic.from_buffer(file_content, mime=True)
            except Exception:
                mime_type = None
        if mime_type is None:
            mime_type = EXTENSION_MIME_MAP.get(ext, "application/octet-stream")

        file_hash = hashlib.sha256(file_content).hexdigest()
        stored_filename = f"{uuid.uuid4().hex}.{ext}"

        date_path = datetime.now(timezone.utc).strftime("%Y/%m/%d")
        relative_path = os.path.join(date_path, stored_filename)
        full_path = self.upload_dir / relative_path
        full_path.parent.mkdir(parents=True, exist_ok=True)

        async with aiofiles.open(str(full_path), "wb") as f:
            await f.write(file_content)

        file_size = len(file_content)

        uploaded = UploadedFile(
            user_id=user_id,
            folder_id=folder_id,
            original_filename=original_filename,
            stored_filename=stored_filename,
            file_path=str(full_path),
            file_size=file_size,
            mime_type=mime_type,
            file_hash=file_hash,
            extension=ext,
            storage_mode=settings.STORAGE_MODE,
            storage_path=str(full_path),
            created_by=str(user_id),
        )
        self.db.add(uploaded)
        await self.db.flush()
        await self.db.refresh(uploaded)
        return uploaded

    async def get_file(self, file_id: uuid.UUID) -> Optional[UploadedFile]:
        result = await self.db.execute(
            select(UploadedFile).where(
                UploadedFile.id == file_id,
                UploadedFile.is_deleted == False,
            )
        )
        return result.scalar_one_or_none()

    async def get_file_content(self, file: UploadedFile) -> bytes:
        file_path = Path(file.file_path)
        if not file_path.exists():
            raise FileNotFoundError("File not found on disk")
        async with aiofiles.open(str(file_path), "rb") as f:
            return await f.read()

    async def delete_file(self, file_id: uuid.UUID, user_id: str) -> bool:
        file = await self.get_file(file_id)
        if file is None:
            return False
        file.soft_delete(user=user_id)
        await self.db.flush()
        file_path = Path(file.file_path)
        if file_path.exists():
            try:
                file_path.unlink()
            except OSError:
                pass
        return True

    async def get_user_files(
        self, user_id: uuid.UUID, page: int = 1, page_size: int = 20, folder_id: Optional[uuid.UUID] = None
    ) -> tuple[list[UploadedFile], int]:
        conditions = [
            UploadedFile.user_id == user_id,
            UploadedFile.is_deleted == False,
        ]
        if folder_id is not None:
            conditions.append(UploadedFile.folder_id == folder_id)

        query = select(UploadedFile).where(*conditions).order_by(UploadedFile.created_at.desc())
        count_query = select(func.count(UploadedFile.id)).where(*conditions)
        total = (await self.db.execute(count_query)).scalar() or 0

        offset = (page - 1) * page_size
        result = await self.db.execute(query.offset(offset).limit(page_size))
        files = result.scalars().all()
        return list(files), total
