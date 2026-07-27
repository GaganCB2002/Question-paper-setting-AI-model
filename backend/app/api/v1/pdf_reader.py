import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func

from app.database import get_db
from app.api.deps import get_current_user
from app.schemas.pdf_note import (
    PDFNoteCreate,
    PDFNoteResponse,
    PDFBookmarkCreate,
    PDFBookmarkResponse,
    PDFAnnotationCreate,
    PDFAnnotationResponse,
)
from app.models.user import User
from app.models.pdf_note import PDFNote, PDFBookmark, PDFAnnotation
from app.models.uploaded_file import UploadedFile

router = APIRouter(prefix="/pdf-reader", tags=["PDF Reader"])


@router.post("/notes", response_model=PDFNoteResponse, status_code=status.HTTP_201_CREATED)
async def create_note(
    note_data: PDFNoteCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    file_result = await db.execute(
        select(UploadedFile).where(UploadedFile.id == note_data.file_id, UploadedFile.is_deleted == False)
    )
    if file_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    note = PDFNote(
        file_id=note_data.file_id,
        user_id=current_user.id,
        page_number=note_data.page_number,
        note_type=note_data.note_type,
        content=note_data.content,
        color=note_data.color,
        position_x=note_data.position_x,
        position_y=note_data.position_y,
        width=note_data.width,
        height=note_data.height,
        rect_json=note_data.rect_json,
        text_content=note_data.text_content,
        tags=note_data.tags,
        created_by=str(current_user.id),
    )
    db.add(note)
    await db.flush()
    await db.refresh(note)
    return PDFNoteResponse(
        id=note.id,
        file_id=note.file_id,
        user_id=note.user_id,
        page_number=note.page_number,
        note_type=note.note_type,
        content=note.content,
        color=note.color,
        position_x=note.position_x,
        position_y=note.position_y,
        width=note.width,
        height=note.height,
        text_content=note.text_content,
        tags=note.tags,
        is_archived=note.is_archived,
        created_at=note.created_at,
        updated_at=note.updated_at,
    )


@router.get("/notes/{file_id}", response_model=dict)
async def get_notes(
    file_id: uuid.UUID,
    page_number: int = Query(None, ge=1),
    note_type: str = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conditions = [
        PDFNote.file_id == file_id,
        PDFNote.user_id == current_user.id,
        PDFNote.is_deleted == False,
        PDFNote.is_archived == False,
    ]
    if page_number is not None:
        conditions.append(PDFNote.page_number == page_number)
    if note_type:
        conditions.append(PDFNote.note_type == note_type)

    count_query = select(func.count(PDFNote.id)).where(*conditions)
    total = (await db.execute(count_query)).scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(
        select(PDFNote).where(*conditions).order_by(PDFNote.page_number, PDFNote.created_at).offset(offset).limit(page_size)
    )
    notes = result.scalars().all()
    return {
        "items": [
            PDFNoteResponse(
                id=n.id,
                file_id=n.file_id,
                user_id=n.user_id,
                page_number=n.page_number,
                note_type=n.note_type,
                content=n.content,
                color=n.color,
                position_x=n.position_x,
                position_y=n.position_y,
                width=n.width,
                height=n.height,
                text_content=n.text_content,
                tags=n.tags,
                is_archived=n.is_archived,
                created_at=n.created_at,
                updated_at=n.updated_at,
            )
            for n in notes
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
    }


@router.delete("/notes/{note_id}")
async def delete_note(
    note_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PDFNote).where(
            PDFNote.id == note_id,
            PDFNote.user_id == current_user.id,
            PDFNote.is_deleted == False,
        )
    )
    note = result.scalar_one_or_none()
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    note.soft_delete(user=str(current_user.id))
    await db.flush()
    return {"message": "Note deleted successfully"}


@router.put("/notes/{note_id}/archive")
async def archive_note(
    note_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PDFNote).where(
            PDFNote.id == note_id,
            PDFNote.user_id == current_user.id,
            PDFNote.is_deleted == False,
        )
    )
    note = result.scalar_one_or_none()
    if note is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Note not found")
    note.is_archived = True
    await db.flush()
    return {"message": "Note archived successfully"}


@router.post("/bookmarks", response_model=PDFBookmarkResponse, status_code=status.HTTP_201_CREATED)
async def create_bookmark(
    bookmark_data: PDFBookmarkCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    file_result = await db.execute(
        select(UploadedFile).where(UploadedFile.id == bookmark_data.file_id, UploadedFile.is_deleted == False)
    )
    if file_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    bookmark = PDFBookmark(
        file_id=bookmark_data.file_id,
        user_id=current_user.id,
        page_number=bookmark_data.page_number,
        label=bookmark_data.label,
        description=bookmark_data.description,
        color=bookmark_data.color,
        created_by=str(current_user.id),
    )
    db.add(bookmark)
    await db.flush()
    await db.refresh(bookmark)
    return PDFBookmarkResponse(
        id=bookmark.id,
        file_id=bookmark.file_id,
        page_number=bookmark.page_number,
        label=bookmark.label,
        description=bookmark.description,
        color=bookmark.color,
        created_at=bookmark.created_at,
    )


@router.get("/bookmarks/{file_id}", response_model=dict)
async def get_bookmarks(
    file_id: uuid.UUID,
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conditions = [
        PDFBookmark.file_id == file_id,
        PDFBookmark.user_id == current_user.id,
        PDFBookmark.is_deleted == False,
    ]
    count_query = select(func.count(PDFBookmark.id)).where(*conditions)
    total = (await db.execute(count_query)).scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(
        select(PDFBookmark).where(*conditions).order_by(PDFBookmark.page_number).offset(offset).limit(page_size)
    )
    bookmarks = result.scalars().all()
    return {
        "items": [
            PDFBookmarkResponse(
                id=b.id,
                file_id=b.file_id,
                page_number=b.page_number,
                label=b.label,
                description=b.description,
                color=b.color,
                created_at=b.created_at,
            )
            for b in bookmarks
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
    }


@router.delete("/bookmarks/{bookmark_id}")
async def delete_bookmark(
    bookmark_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PDFBookmark).where(
            PDFBookmark.id == bookmark_id,
            PDFBookmark.user_id == current_user.id,
            PDFBookmark.is_deleted == False,
        )
    )
    bookmark = result.scalar_one_or_none()
    if bookmark is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Bookmark not found")
    bookmark.soft_delete(user=str(current_user.id))
    await db.flush()
    return {"message": "Bookmark deleted successfully"}


@router.post("/annotations", response_model=PDFAnnotationResponse, status_code=status.HTTP_201_CREATED)
async def create_annotation(
    annotation_data: PDFAnnotationCreate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    file_result = await db.execute(
        select(UploadedFile).where(UploadedFile.id == annotation_data.file_id, UploadedFile.is_deleted == False)
    )
    if file_result.scalar_one_or_none() is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="File not found")

    annotation = PDFAnnotation(
        file_id=annotation_data.file_id,
        user_id=current_user.id,
        page_number=annotation_data.page_number,
        annotation_type=annotation_data.annotation_type,
        content=annotation_data.content,
        position_x=annotation_data.position_x,
        position_y=annotation_data.position_y,
        width=annotation_data.width,
        height=annotation_data.height,
        rect_json=annotation_data.rect_json,
        color=annotation_data.color,
        opacity=annotation_data.opacity,
        font_size=annotation_data.font_size,
        font_color=annotation_data.font_color,
        created_by=str(current_user.id),
    )
    db.add(annotation)
    await db.flush()
    await db.refresh(annotation)
    return PDFAnnotationResponse(
        id=annotation.id,
        file_id=annotation.file_id,
        page_number=annotation.page_number,
        annotation_type=annotation.annotation_type,
        content=annotation.content,
        position_x=annotation.position_x,
        position_y=annotation.position_y,
        width=annotation.width,
        height=annotation.height,
        color=annotation.color,
        opacity=annotation.opacity,
        created_at=annotation.created_at,
    )


@router.get("/annotations/{file_id}", response_model=dict)
async def get_annotations(
    file_id: uuid.UUID,
    page_number: int = Query(None, ge=1),
    page: int = Query(1, ge=1),
    page_size: int = Query(50, ge=1, le=200),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    conditions = [
        PDFAnnotation.file_id == file_id,
        PDFAnnotation.user_id == current_user.id,
        PDFAnnotation.is_deleted == False,
    ]
    if page_number is not None:
        conditions.append(PDFAnnotation.page_number == page_number)

    count_query = select(func.count(PDFAnnotation.id)).where(*conditions)
    total = (await db.execute(count_query)).scalar() or 0

    offset = (page - 1) * page_size
    result = await db.execute(
        select(PDFAnnotation).where(*conditions).order_by(PDFAnnotation.page_number, PDFAnnotation.created_at).offset(offset).limit(page_size)
    )
    annotations = result.scalars().all()
    return {
        "items": [
            PDFAnnotationResponse(
                id=a.id,
                file_id=a.file_id,
                page_number=a.page_number,
                annotation_type=a.annotation_type,
                content=a.content,
                position_x=a.position_x,
                position_y=a.position_y,
                width=a.width,
                height=a.height,
                color=a.color,
                opacity=a.opacity,
                created_at=a.created_at,
            )
            for a in annotations
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
    }


@router.delete("/annotations/{annotation_id}")
async def delete_annotation(
    annotation_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(PDFAnnotation).where(
            PDFAnnotation.id == annotation_id,
            PDFAnnotation.user_id == current_user.id,
            PDFAnnotation.is_deleted == False,
        )
    )
    annotation = result.scalar_one_or_none()
    if annotation is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Annotation not found")
    annotation.soft_delete(user=str(current_user.id))
    await db.flush()
    return {"message": "Annotation deleted successfully"}
