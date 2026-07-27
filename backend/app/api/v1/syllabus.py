import uuid
from fastapi import APIRouter, Depends, HTTPException, Query, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional

from app.database import get_db
from app.api.deps import get_current_user
from app.models.syllabus import Syllabus, Topic, SubTopic
from app.models.exam_pattern import ExamPattern
from app.models.user import User

router = APIRouter(prefix="/syllabus", tags=["Syllabus"])


@router.get("/exam-patterns", response_model=dict)
async def list_exam_patterns(
    exam_name: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conditions = [ExamPattern.is_deleted == False]
    if exam_name:
        conditions.append(ExamPattern.exam_name.ilike(f"%{exam_name}%"))

    query = select(ExamPattern).where(*conditions).order_by(ExamPattern.created_at.desc())
    count_query = select(ExamPattern.id).where(*conditions)
    total_result = await db.execute(count_query)
    total = len(total_result.all())

    offset = (page - 1) * page_size
    result = await db.execute(query.offset(offset).limit(page_size))
    patterns = result.scalars().all()

    return {
        "items": [
            {
                "id": str(p.id),
                "exam_name": p.exam_name,
                "exam_type": p.exam_type,
                "pattern_year": p.pattern_year,
                "total_marks": p.total_marks,
                "total_questions": p.total_questions,
                "duration_minutes": p.duration_minutes,
                "passing_marks": p.passing_marks,
                "negative_marking": p.negative_marking,
                "is_active": p.is_active,
                "created_at": p.created_at.isoformat() if p.created_at else None,
            }
            for p in patterns
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
    }


@router.get("/", response_model=dict)
async def list_syllabi(
    exam_name: Optional[str] = Query(None),
    year: Optional[int] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    conditions = [Syllabus.is_deleted == False]
    if exam_name:
        conditions.append(Syllabus.exam_name.ilike(f"%{exam_name}%"))
    if year:
        conditions.append(Syllabus.year == year)

    query = select(Syllabus).where(*conditions).order_by(Syllabus.created_at.desc())
    count_query = select(Syllabus.id).where(*conditions)
    total_result = await db.execute(count_query)
    total = len(total_result.all())

    offset = (page - 1) * page_size
    result = await db.execute(query.offset(offset).limit(page_size))
    syllabi = result.scalars().all()

    return {
        "items": [
            {
                "id": str(s.id),
                "exam_name": s.exam_name,
                "exam_type": s.exam_type,
                "conducting_body": s.conducting_body,
                "year": s.year,
                "total_marks": s.total_marks,
                "total_questions": s.total_questions,
                "duration_minutes": s.duration_minutes,
                "language": s.language,
                "is_official": s.is_official,
                "created_at": s.created_at.isoformat() if s.created_at else None,
            }
            for s in syllabi
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
    }


@router.get("/{syllabus_id}", response_model=dict)
async def get_syllabus(
    syllabus_id: uuid.UUID,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user),
):
    result = await db.execute(
        select(Syllabus).where(Syllabus.id == syllabus_id, Syllabus.is_deleted == False)
    )
    syllabus = result.scalar_one_or_none()
    if syllabus is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Syllabus not found")

    topics_result = await db.execute(
        select(Topic).where(Topic.syllabus_id == syllabus_id, Topic.is_deleted == False).order_by(Topic.order_index)
    )
    topics = topics_result.scalars().all()

    topic_ids = [t.id for t in topics]
    sub_topics_result = await db.execute(
        select(SubTopic).where(SubTopic.topic_id.in_(topic_ids), SubTopic.is_deleted == False).order_by(SubTopic.order_index)
    ) if topic_ids else None
    all_sub_topics = sub_topics_result.scalars().all() if sub_topics_result else []
    sub_topics_by_topic = {}
    for st in all_sub_topics:
        sub_topics_by_topic.setdefault(str(st.topic_id), []).append(st)

    topics_data = []
    for topic in topics:
        sub_topics = sub_topics_by_topic.get(str(topic.id), [])
        topics_data.append({
            "id": str(topic.id),
            "name": topic.name,
            "code": topic.code,
            "description": topic.description,
            "weightage": topic.weightage,
            "marks": topic.marks,
            "question_count": topic.question_count,
            "order_index": topic.order_index,
            "section": topic.section,
            "sub_topics": [
                {
                    "id": str(st.id),
                    "name": st.name,
                    "code": st.code,
                    "description": st.description,
                    "weightage": st.weightage,
                    "marks": st.marks,
                    "order_index": st.order_index,
                }
                for st in sub_topics
            ],
        })

    return {
        "id": str(syllabus.id),
        "exam_name": syllabus.exam_name,
        "exam_type": syllabus.exam_type,
        "conducting_body": syllabus.conducting_body,
        "year": syllabus.year,
        "description": syllabus.description,
        "raw_text": syllabus.raw_text,
        "total_marks": syllabus.total_marks,
        "total_questions": syllabus.total_questions,
        "duration_minutes": syllabus.duration_minutes,
        "language": syllabus.language,
        "sections": syllabus.sections_json,
        "is_official": syllabus.is_official,
        "source_url": syllabus.source_url,
        "topics": topics_data,
        "created_at": syllabus.created_at.isoformat() if syllabus.created_at else None,
    }
