import uuid
from fastapi import APIRouter, Depends, HTTPException, UploadFile, File, Form, status, Query
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession
from typing import Optional

from app.database import get_db
from app.api.deps import get_current_user
from app.services.file_service import FileService
from app.services.ocr_service import OcrService
from app.schemas.file import FileUploadResponse, FileProcessResponse
from app.models.user import User
from app.models.folder import Folder
from app.config import settings

router = APIRouter(prefix="/files", tags=["Files"])


@router.post("/upload", response_model=FileUploadResponse, status_code=status.HTTP_201_CREATED)
async def upload_file(
    file: UploadFile = File(...),
    folder_id: Optional[uuid.UUID] = Form(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    file_size = len(content)

    if file_size > settings.max_file_size_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File size exceeds maximum of {settings.MAX_FILE_SIZE_MB}MB",
        )

    ext = file.filename.split(".")[-1].lower() if file.filename else ""
    if ext not in settings.allowed_extensions_list:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"File type '.{ext}' is not supported. Allowed: {settings.ALLOWED_EXTENSIONS}",
        )

    if folder_id:
        folder_result = await db.execute(
            select(Folder).where(
                Folder.id == folder_id,
                Folder.user_id == current_user.id,
                Folder.is_deleted == False,
            )
        )
        if folder_result.scalar_one_or_none() is None:
            raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Folder not found")

    service = FileService(db)
    try:
        uploaded = await service.upload_file(
            file_content=content,
            original_filename=file.filename or "unnamed",
            user_id=current_user.id,
            folder_id=folder_id,
        )
    except ValueError as e:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(e))

    from scripts.migrate_db import run_all_migrations
    await run_all_migrations(db)

    return FileUploadResponse(
            id=uploaded.id,
            original_filename=uploaded.original_filename,
            stored_filename=uploaded.stored_filename,
            file_size=uploaded.file_size,
            mime_type=uploaded.mime_type,
            extension=uploaded.extension,
            language=uploaded.language,
            detected_language=uploaded.detected_language,
            page_count=uploaded.page_count,
            is_processed=uploaded.is_processed,
            ocr_processed=uploaded.ocr_processed,
            created_at=uploaded.created_at,
        )


@router.post("/process/{file_id}", response_model=FileProcessResponse)
async def process_file(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    file_service = FileService(db)
    file = await file_service.get_file(file_id)
    if file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    ocr_service = OcrService()

    try:
        if file.extension == "pdf":
            result = await ocr_service.process_pdf(file.file_path)
        elif file.extension in ["png", "jpg", "jpeg", "webp"]:
            content = await file_service.get_file_content(file)
            result = await ocr_service.process_image(content)
        elif file.extension == "docx":
            text = await ocr_service.extract_text_from_docx(file.file_path)
            result = {"cleaned_text": text, "language": await ocr_service.detect_language(text), "confidence": 0, "page_count": 1, "tables": [], "headings": []}
        elif file.extension == "pptx":
            text = await ocr_service.extract_text_from_pptx(file.file_path)
            result = {"cleaned_text": text, "language": await ocr_service.detect_language(text), "confidence": 0, "page_count": 1, "tables": [], "headings": []}
        elif file.extension == "xlsx":
            text = await ocr_service.extract_text_from_xlsx(file.file_path)
            result = {"cleaned_text": text, "language": await ocr_service.detect_language(text), "confidence": 0, "page_count": 1, "tables": [], "headings": []}
        elif file.extension == "txt":
            text = await ocr_service.extract_text_from_txt(file.file_path)
            result = {"cleaned_text": text, "language": await ocr_service.detect_language(text), "confidence": 0, "page_count": 1, "tables": [], "headings": []}
        else:
            raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Unsupported file type for processing")

        file.extracted_text = result.get("cleaned_text", "")
        file.language = result.get("language", "unknown")
        file.detected_language = result.get("language", "unknown")
        file.page_count = result.get("page_count", 1)
        file.is_processed = True
        file.ocr_processed = True
        await db.flush()

        return FileProcessResponse(
            file_id=file.id,
            status="completed",
            message="File processed successfully",
            language=result.get("language"),
            page_count=result.get("page_count"),
            text_length=len(result.get("cleaned_text", "")),
            tables_count=len(result.get("tables", [])),
            headings_count=len(result.get("headings", [])),
            ocr_confidence=result.get("confidence"),
        )
    except Exception as e:
        file.processing_error = str(e)
        await db.flush()
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=f"Processing failed: {str(e)}")


@router.get("/", response_model=dict)
async def list_files(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    folder_id: Optional[uuid.UUID] = Query(None),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = FileService(db)
    files, total = await service.get_user_files(current_user.id, page, page_size, folder_id)
    return {
        "items": [
            FileUploadResponse(
                id=f.id,
                original_filename=f.original_filename,
                stored_filename=f.stored_filename,
                file_size=f.file_size,
                mime_type=f.mime_type,
                extension=f.extension,
                language=f.language,
                detected_language=f.detected_language,
                page_count=f.page_count,
                is_processed=f.is_processed,
                ocr_processed=f.ocr_processed,
                created_at=f.created_at,
            )
            for f in files
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
    }


@router.get("/{file_id}")
async def get_file(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = FileService(db)
    file = await service.get_file(file_id)
    if file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return FileUploadResponse(
        id=file.id,
        original_filename=file.original_filename,
        stored_filename=file.stored_filename,
        file_size=file.file_size,
        mime_type=file.mime_type,
        extension=file.extension,
        language=file.language,
        detected_language=file.detected_language,
        page_count=file.page_count,
        is_processed=file.is_processed,
        ocr_processed=file.ocr_processed,
        created_at=file.created_at,
    )


@router.get("/{file_id}/download")
async def download_file(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = FileService(db)
    file = await service.get_file(file_id)
    if file is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    content = await service.get_file_content(file)
    from fastapi.responses import Response
    return Response(
        content=content,
        media_type=file.mime_type or "application/octet-stream",
        headers={"Content-Disposition": f'inline; filename="{file.original_filename}"'},
    )


@router.delete("/{file_id}")
async def delete_file(
    file_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = FileService(db)
    success = await service.delete_file(file_id, str(current_user.id))
    if not success:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")
    return {"message": "File deleted successfully"}
