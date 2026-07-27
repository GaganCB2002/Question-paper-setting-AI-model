import uuid
import json
import os
from fastapi import APIRouter, Depends, HTTPException, Query, status, UploadFile, File, Form
from fastapi.responses import StreamingResponse
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from typing import Optional
from pydantic import BaseModel, Field

from app.database import get_db
from app.api.deps import get_current_user
from app.services.question_service import QuestionService
from app.services.ai_service import AIService
from app.services.file_service import FileService
from app.services.ocr_service import OcrService
from app.schemas.question import (
    QuestionGenerate,
    QuestionResponse,
    PaperResponse,
    PaperDetailResponse,
    SearchRequest,
)
from app.models.user import User
from app.models.question import GeneratedPaper, GeneratedQuestion


class SyllabusGenerateRequest(BaseModel):
    text: str = Field(..., min_length=10)
    exam_name: str = Field(default="General")
    question_count: int = Field(default=10, ge=1, le=50)
    language: str = Field(default="english")
    difficulty: str = Field(default="balanced")

router = APIRouter(prefix="/questions", tags=["Questions"])


@router.post("/generate")
async def generate_questions(
    request: QuestionGenerate,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = QuestionService(db)

    async def event_stream():
        try:
            async for event in service.generate_paper(
                user_id=current_user.id,
                exam_name=request.exam_name,
                syllabus_id=request.syllabus_id,
                exam_pattern_id=request.exam_pattern_id,
                source_file_ids=request.source_file_ids,
                language=request.language,
                question_count=request.question_count,
                difficulty=request.difficulty,
                paper_set=request.paper_set,
                previous_year_ids=request.previous_year_ids,
            ):
                yield f"data: {json.dumps(event, default=str)}\n\n"
        except Exception as e:
            yield f"data: {json.dumps({'type': 'error', 'message': str(e)}, default=str)}\n\n"

    return StreamingResponse(
        event_stream(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.get("/papers", response_model=dict)
async def list_papers(
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    query = select(GeneratedPaper).where(
        GeneratedPaper.user_id == current_user.id,
        GeneratedPaper.is_deleted == False,
    ).order_by(GeneratedPaper.created_at.desc())

    count_query = select(GeneratedPaper.id).where(
        GeneratedPaper.user_id == current_user.id,
        GeneratedPaper.is_deleted == False,
    )
    total_result = await db.execute(count_query)
    total = len(total_result.all())

    offset = (page - 1) * page_size
    result = await db.execute(query.offset(offset).limit(page_size))
    papers = result.scalars().all()

    return {
        "items": [
            PaperResponse(
                id=p.id,
                exam_name=p.exam_name,
                paper_set=p.paper_set,
                title=p.title,
                language=p.language,
                total_marks=p.total_marks,
                total_questions=p.total_questions,
                difficulty_profile=p.difficulty_profile,
                status=p.status,
                is_published=p.is_published,
                created_at=p.created_at,
            )
            for p in papers
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
    }


@router.get("/papers/{paper_id}", response_model=PaperDetailResponse)
async def get_paper(
    paper_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GeneratedPaper).where(
            GeneratedPaper.id == paper_id,
            GeneratedPaper.is_deleted == False,
        )
    )
    paper = result.scalar_one_or_none()
    if paper is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paper not found")
    if paper.user_id != current_user.id and not current_user.is_superuser:
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="Access denied")

    questions_result = await db.execute(
        select(GeneratedQuestion).where(
            GeneratedQuestion.paper_id == paper_id,
            GeneratedQuestion.is_deleted == False,
        ).order_by(GeneratedQuestion.question_number)
    )
    questions = questions_result.scalars().all()

    return PaperDetailResponse(
        id=paper.id,
        exam_name=paper.exam_name,
        paper_set=paper.paper_set,
        title=paper.title,
        language=paper.language,
        total_marks=paper.total_marks,
        total_questions=paper.total_questions,
        difficulty_profile=paper.difficulty_profile,
        status=paper.status,
        is_published=paper.is_published,
        created_at=paper.created_at,
        questions=[
            QuestionResponse(
                id=q.id,
                question_number=q.question_number,
                exam_name=q.exam_name,
                paper_set=q.paper_set,
                topic_name=q.topic_name,
                sub_topic_name=q.sub_topic_name,
                difficulty=q.difficulty,
                language=q.language,
                question_type=q.question_type,
                question_text=q.question_text,
                option_a=q.option_a,
                option_b=q.option_b,
                option_c=q.option_c,
                option_d=q.option_d,
                correct_answer=q.correct_answer,
                correct_answer_text=q.correct_answer_text,
                explanation=q.explanation,
                reference_source=q.reference_source,
                source_page_number=q.source_page_number,
                weightage=q.weightage,
                keywords=q.keywords,
                marks=q.marks,
                validation_status=q.validation_status,
                created_at=q.created_at,
            )
            for q in questions
        ],
    )


@router.delete("/papers/{paper_id}")
async def delete_paper(
    paper_id: uuid.UUID,
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    result = await db.execute(
        select(GeneratedPaper).where(
            GeneratedPaper.id == paper_id,
            GeneratedPaper.is_deleted == False,
            GeneratedPaper.user_id == current_user.id,
        )
    )
    paper = result.scalar_one_or_none()
    if paper is None:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="Paper not found")
    paper.soft_delete(user=str(current_user.id))
    await db.flush()
    return {"message": "Paper deleted successfully"}


@router.post("/syllabus-generate")
async def syllabus_generate(
    request: SyllabusGenerateRequest,
    current_user: User = Depends(get_current_user),
):
    ai_service = AIService()
    try:
        system_instruction = f"""You are a precise MCQ question generator. Generate ONLY from the provided text.
Rules:
1. Create exactly {request.question_count} Multiple Choice Questions (MCQ)
2. Each question must have 4 options (A, B, C, D) with exactly ONE correct answer
3. Every question MUST include a detailed explanation for the correct answer
4. Language: {request.language}
5. Difficulty: {request.difficulty}
6. Return ONLY valid JSON array - no markdown, no code fences
"""

        prompt = f"""Generate {request.question_count} MCQ questions based on this syllabus/text:

{request.text[:15000]}

Return ONLY this JSON array (no markdown):
[
  {{
    "question_number": 1,
    "question_text": "...",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "correct_answer": "A",
    "correct_answer_text": "...",
    "explanation": "Detailed explanation why this answer is correct...",
    "topic": "General",
    "difficulty": "easy|moderate|hard"
  }}
]"""

        result = await ai_service.generate_content(prompt, system_instruction)
        cleaned = result.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        questions = json.loads(cleaned)
        if isinstance(questions, dict) and "questions" in questions:
            questions = questions["questions"]
        if not isinstance(questions, list):
            return {"success": True, "questions": [], "count": 0}
        return {"success": True, "questions": questions, "count": len(questions)}
    except json.JSONDecodeError:
        return {"success": True, "questions": [], "count": 0, "parse_error": True, "raw": result[:500] if result else ""}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.post("/upload-and-generate")
async def upload_and_generate(
    file: UploadFile = File(...),
    exam_name: str = Form("General"),
    question_count: int = Form(10),
    language: str = Form("english"),
    difficulty: str = Form("balanced"),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    content = await file.read()
    ext = file.filename.split(".")[-1].lower() if file.filename else "txt"
    text = ""

    try:
        ocr_service = OcrService()
        if ext == "pdf":
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix=".pdf") as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            try:
                result = await ocr_service.process_pdf(tmp_path)
                text = result.get("cleaned_text", "")
            finally:
                os.unlink(tmp_path)
        elif ext in ["png", "jpg", "jpeg", "webp"]:
            result = await ocr_service.process_image(content)
            text = result.get("cleaned_text", "")
        elif ext == "docx":
            import tempfile
            with tempfile.NamedTemporaryFile(delete=False, suffix=".docx") as tmp:
                tmp.write(content)
                tmp_path = tmp.name
            try:
                text = await ocr_service.extract_text_from_docx(tmp_path)
            finally:
                os.unlink(tmp_path)
        elif ext == "txt":
            text = content.decode("utf-8", errors="replace")
        else:
            text = content.decode("utf-8", errors="replace")
    except Exception as e:
        text = content.decode("utf-8", errors="replace")

    if not text.strip():
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="Could not extract text from file")

    ai_service = AIService()
    try:
        system_instruction = f"""You are a precise MCQ question generator. Generate ONLY from the provided text.
Rules:
1. Create exactly {question_count} Multiple Choice Questions (MCQ)
2. Each question must have 4 options (A, B, C, D) with exactly ONE correct answer
3. Every question MUST include a detailed explanation for the correct answer
4. Language: {language}
5. Difficulty: {difficulty}
6. Return ONLY valid JSON array - no markdown, no code fences
"""

        prompt = f"""Generate {question_count} MCQ questions based on this text from file "{file.filename}":

{text[:15000]}

Return ONLY this JSON array (no markdown):
[
  {{
    "question_number": 1,
    "question_text": "...",
    "option_a": "...",
    "option_b": "...",
    "option_c": "...",
    "option_d": "...",
    "correct_answer": "A",
    "correct_answer_text": "...",
    "explanation": "Detailed explanation why this answer is correct...",
    "topic": "General",
    "difficulty": "easy|moderate|hard"
  }}
]"""

        result = await ai_service.generate_content(prompt, system_instruction)
        cleaned = result.strip()
        if cleaned.startswith("```json"):
            cleaned = cleaned[7:]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3]
        cleaned = cleaned.strip()
        questions = json.loads(cleaned)
        if isinstance(questions, dict) and "questions" in questions:
            questions = questions["questions"]
        if not isinstance(questions, list):
            return {"success": True, "questions": [], "count": 0, "filename": file.filename}
        return {"success": True, "questions": questions, "count": len(questions), "filename": file.filename}
    except json.JSONDecodeError:
        return {"success": True, "questions": [], "count": 0, "filename": file.filename, "parse_error": True}
    except Exception as e:
        raise HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(e))


@router.get("/question-bank", response_model=dict)
async def search_question_bank(
    query: Optional[str] = Query(None),
    topic: Optional[str] = Query(None),
    difficulty: Optional[str] = Query(None),
    language: Optional[str] = Query(None),
    question_type: Optional[str] = Query(None),
    exam_name: Optional[str] = Query(None),
    keyword: Optional[str] = Query(None),
    page: int = Query(1, ge=1),
    page_size: int = Query(20, ge=1, le=100),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db),
):
    service = QuestionService(db)
    questions, total = await service.search_questions(
        query=query,
        topic=topic,
        difficulty=difficulty,
        language=language,
        question_type=question_type,
        exam_name=exam_name,
        keyword=keyword,
        page=page,
        page_size=page_size,
    )
    return {
        "items": [
            QuestionResponse(
                id=q.id,
                question_number=q.question_number,
                exam_name=q.exam_name,
                paper_set=q.paper_set,
                topic_name=q.topic_name,
                sub_topic_name=q.sub_topic_name,
                difficulty=q.difficulty,
                language=q.language,
                question_type=q.question_type,
                question_text=q.question_text,
                option_a=q.option_a,
                option_b=q.option_b,
                option_c=q.option_c,
                option_d=q.option_d,
                correct_answer=q.correct_answer,
                correct_answer_text=q.correct_answer_text,
                explanation=q.explanation,
                reference_source=q.reference_source,
                source_page_number=q.source_page_number,
                weightage=q.weightage,
                keywords=q.keywords,
                marks=q.marks,
                validation_status=q.validation_status,
                created_at=q.created_at,
            )
            for q in questions
        ],
        "total": total,
        "page": page,
        "page_size": page_size,
        "total_pages": (total + page_size - 1) // page_size if total > 0 else 0,
    }
