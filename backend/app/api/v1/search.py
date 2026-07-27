from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, or_, and_, func
from typing import Optional

from app.database import get_db
from app.api.deps import get_current_user
from app.models.user import User
from app.models.question import GeneratedQuestion
from app.models.syllabus import Syllabus, Topic, SubTopic
from app.models.current_affair import CurrentAffair, GovernmentScheme
from app.models.uploaded_file import UploadedFile

router = APIRouter(prefix="/search", tags=["Search"])


@router.get("/", response_model=dict)
async def global_search(
    q: str = Query("", min_length=1),
    entity_type: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    entity_type = entity_type or "all"
    results = {}
    total = 0

    if entity_type in ["questions", "all"]:
        conditions = [
            GeneratedQuestion.is_deleted == False,
            or_(
                GeneratedQuestion.question_text.ilike(f"%{q}%"),
                GeneratedQuestion.topic_name.ilike(f"%{q}%"),
                GeneratedQuestion.sub_topic_name.ilike(f"%{q}%"),
                GeneratedQuestion.keywords.ilike(f"%{q}%"),
                GeneratedQuestion.exam_name.ilike(f"%{q}%"),
            ),
        ]
        query = select(GeneratedQuestion).where(*conditions).order_by(GeneratedQuestion.created_at.desc()).limit(page_size)
        result = await db.execute(query)
        questions = result.scalars().all()
        results["questions"] = [
            {
                "id": str(q.id),
                "question_text": q.question_text[:200],
                "topic": q.topic_name,
                "difficulty": q.difficulty,
                "exam_name": q.exam_name,
                "type": "question",
            }
            for q in questions
        ]
        total += len(questions)

    if entity_type in ["syllabus", "all"]:
        conditions = [
            Syllabus.is_deleted == False,
            or_(
                Syllabus.exam_name.ilike(f"%{q}%"),
                Syllabus.description.ilike(f"%{q}%"),
                Syllabus.conducting_body.ilike(f"%{q}%"),
            ),
        ]
        query = select(Syllabus).where(*conditions).order_by(Syllabus.created_at.desc()).limit(page_size)
        result = await db.execute(query)
        syllabi = result.scalars().all()
        results["syllabus"] = [
            {
                "id": str(s.id),
                "exam_name": s.exam_name,
                "exam_type": s.exam_type,
                "year": s.year,
                "type": "syllabus",
            }
            for s in syllabi
        ]
        total += len(syllabi)

    if entity_type in ["files", "all"]:
        conditions = [
            UploadedFile.is_deleted == False,
            or_(
                UploadedFile.original_filename.ilike(f"%{q}%"),
                UploadedFile.extracted_text.ilike(f"%{q}%"),
            ),
        ]
        query = select(UploadedFile).where(*conditions).order_by(UploadedFile.created_at.desc()).limit(page_size)
        result = await db.execute(query)
        files = result.scalars().all()
        results["files"] = [
            {
                "id": str(f.id),
                "filename": f.original_filename,
                "extension": f.extension,
                "file_size": f.file_size,
                "type": "file",
            }
            for f in files
        ]
        total += len(files)

    if entity_type in ["current_affairs", "all"]:
        conditions = [
            CurrentAffair.is_deleted == False,
            or_(
                CurrentAffair.title.ilike(f"%{q}%"),
                CurrentAffair.content.ilike(f"%{q}%"),
                CurrentAffair.tags.ilike(f"%{q}%"),
            ),
        ]
        query = select(CurrentAffair).where(*conditions).order_by(CurrentAffair.created_at.desc()).limit(page_size)
        result = await db.execute(query)
        affairs = result.scalars().all()
        results["current_affairs"] = [
            {
                "id": str(c.id),
                "title": c.title,
                "category": c.category,
                "event_date": c.event_date.isoformat() if c.event_date else None,
                "type": "current_affair",
            }
            for c in affairs
        ]
        total += len(affairs)

    if entity_type in ["schemes", "all"]:
        conditions = [
            GovernmentScheme.is_deleted == False,
            or_(
                GovernmentScheme.name.ilike(f"%{q}%"),
                GovernmentScheme.short_name.ilike(f"%{q}%"),
                GovernmentScheme.description.ilike(f"%{q}%"),
                GovernmentScheme.tags.ilike(f"%{q}%"),
            ),
        ]
        query = select(GovernmentScheme).where(*conditions).order_by(GovernmentScheme.created_at.desc()).limit(page_size)
        result = await db.execute(query)
        schemes = result.scalars().all()
        results["schemes"] = [
            {
                "id": str(s.id),
                "name": s.name,
                "short_name": s.short_name,
                "scheme_type": s.scheme_type,
                "type": "scheme",
            }
            for s in schemes
        ]
        total += len(schemes)

    return {
        "query": q,
        "results": results,
        "total": total,
        "page": page,
        "page_size": page_size,
    }
