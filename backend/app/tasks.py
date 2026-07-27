import asyncio
import json
import uuid
from datetime import datetime, timezone
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from app.celery_app import celery_app
from app.database import async_session_factory
from app.services.ocr_service import OcrService
from app.services.ai_service import AIService
from app.models.uploaded_file import UploadedFile
from app.models.ai_job import AIJob
from app.models.question import GeneratedPaper


def run_async(coro):
    loop = asyncio.new_event_loop()
    asyncio.set_event_loop(loop)
    try:
        return loop.run_until_complete(coro)
    finally:
        loop.close()


@celery_app.task(bind=True, max_retries=3)
def process_file_task(self, file_id: str, user_id: str = None):
    async def _process():
        async with async_session_factory() as db:
            file_uuid = uuid.UUID(file_id)
            result = await db.execute(
                select(UploadedFile).where(
                    UploadedFile.id == file_uuid, UploadedFile.is_deleted == False
                )
            )
            file = result.scalar_one_or_none()
            if file is None:
                raise ValueError("File not found")

            ocr_service = OcrService()
            job = AIJob(
                user_id=uuid.UUID(user_id) if user_id else None,
                job_type="file_processing",
                status="processing",
                started_at=datetime.now(timezone.utc).isoformat(),
                file_id=file_uuid,
            )
            db.add(job)
            await db.flush()

            try:
                if file.extension == "pdf":
                    result_data = await ocr_service.process_pdf(file.file_path)
                elif file.extension in ["png", "jpg", "jpeg", "webp"]:
                    import aiofiles
                    async with aiofiles.open(file.file_path, "rb") as f:
                        content = await f.read()
                    result_data = await ocr_service.process_image(content)
                else:
                    result_data = {"cleaned_text": "", "language": "unknown"}

                file.extracted_text = result_data.get("cleaned_text", "")
                file.language = result_data.get("language", "unknown")
                file.detected_language = result_data.get("language", "unknown")
                file.page_count = result_data.get("page_count")
                file.is_processed = True
                file.ocr_processed = True

                job.status = "completed"
                job.completed_at = datetime.now(timezone.utc).isoformat()
                job.progress = 100.0
                await db.flush()

            except Exception as e:
                job.status = "failed"
                job.error_message = str(e)
                job.completed_at = datetime.now(timezone.utc).isoformat()
                await db.flush()
                raise

    return run_async(_process())


@celery_app.task(bind=True, max_retries=2)
def generate_paper_task(self, user_id: str, exam_name: str, syllabus_id: str = None,
                        exam_pattern_id: str = None, source_file_ids: list = None,
                        language: str = "english", question_count: int = 50,
                        difficulty: str = "balanced", paper_set: str = "set_1"):
    async def _generate():
        async with async_session_factory() as db:
            from app.services.question_service import QuestionService
            service = QuestionService(db)

            job = AIJob(
                user_id=uuid.UUID(user_id) if user_id else None,
                job_type="paper_generation",
                status="processing",
                started_at=datetime.now(timezone.utc).isoformat(),
            )
            db.add(job)
            await db.flush()

            try:
                results = []
                async for event in service.generate_paper(
                    user_id=uuid.UUID(user_id),
                    exam_name=exam_name,
                    syllabus_id=uuid.UUID(syllabus_id) if syllabus_id else None,
                    exam_pattern_id=uuid.UUID(exam_pattern_id) if exam_pattern_id else None,
                    source_file_ids=[uuid.UUID(f) for f in (source_file_ids or [])],
                    language=language,
                    question_count=question_count,
                    difficulty=difficulty,
                    paper_set=paper_set,
                ):
                    results.append(event)

                last_event = results[-1] if results else {}
                job.status = "completed"
                job.completed_at = datetime.now(timezone.utc).isoformat()
                job.progress = 100.0
                job.output_data_json = json.dumps(last_event, default=str)
                await db.flush()
                return last_event

            except Exception as e:
                job.status = "failed"
                job.error_message = str(e)
                job.completed_at = datetime.now(timezone.utc).isoformat()
                await db.flush()
                raise

    return run_async(_generate())
