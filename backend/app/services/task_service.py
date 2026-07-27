import uuid
import json
import hashlib
from datetime import datetime, timezone
from typing import Optional, AsyncGenerator
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, func, and_

from app.models.generation_task import GenerationTask, TaskPhase, TaskApproval
from app.models.question import GeneratedQuestion, GeneratedPaper
from app.models.answer_key import AnswerKey, Explanation
from app.services.ai_service import AIService
from app.services.token_service import TokenService


QUESTIONS_PER_QUOTA_CHECK = 5
TOKENS_PER_QUESTION_ESTIMATE = 500


class TaskService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.ai_service = AIService()
        self.token_service = TokenService(db)

    async def create_plan(
        self,
        user_id: uuid.UUID,
        syllabus_text: str,
        exam_name: str = "General",
        language: str = "english",
        difficulty: str = "balanced",
        total_questions: int = 100,
        questions_per_phase: int = 25,
    ) -> dict:
        system_instruction = """You are a syllabus analyzer. Break down the given syllabus into logical phases/topics.
For each phase, provide a title, description, and estimated question count."""

        prompt = f"""Analyze this syllabus and create a phased plan for generating MCQ questions.

SYLLABUS:
{syllabus_text[:10000]}

Total questions needed: {total_questions}
Questions per phase: {questions_per_phase}

Create a phased breakdown. Return ONLY this JSON array:
[
  {{
    "phase": 1,
    "title": "Phase title",
    "description": "What this phase covers",
    "topic": "Main topic",
    "question_count": 25
  }}
]

Distribute {total_questions} questions across phases, each phase having up to {questions_per_phase} questions.
Number of phases = ceil({total_questions} / {questions_per_phase})"""

        try:
            ai_plan = await self.ai_service.generate_content(prompt, system_instruction)
            cleaned = ai_plan.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
            phases_data = json.loads(cleaned)
            if isinstance(phases_data, dict) and "phases" in phases_data:
                phases_data = phases_data["phases"]
            if not isinstance(phases_data, list):
                phases_data = self._default_phases(total_questions, questions_per_phase)
        except Exception:
            phases_data = self._default_phases(total_questions, questions_per_phase)

        total_planned = sum(p.get("question_count", questions_per_phase) for p in phases_data)

        task = GenerationTask(
            user_id=user_id,
            title=f"{exam_name} - {total_questions} Questions",
            syllabus_text=syllabus_text,
            exam_name=exam_name,
            language=language,
            difficulty=difficulty,
            total_questions_planned=total_planned,
            total_questions_generated=0,
            status="planning",
            total_phases=len(phases_data),
            phase_plan_json=json.dumps(phases_data),
            created_by=str(user_id),
        )
        self.db.add(task)
        await self.db.flush()
        await self.db.refresh(task)

        for i, phase_data in enumerate(phases_data):
            phase = TaskPhase(
                task_id=task.id,
                phase_number=i + 1,
                title=phase_data.get("title", f"Phase {i + 1}"),
                description=phase_data.get("description", ""),
                topic=phase_data.get("topic", ""),
                question_count_planned=phase_data.get("question_count", questions_per_phase),
                question_count_generated=0,
                status="pending",
                created_by=str(user_id),
            )
            self.db.add(phase)

        await self.db.flush()

        approval = TaskApproval(
            task_id=task.id,
            status="pending",
            phase_plan_summary=json.dumps([{
                "phase": p.get("phase", i + 1),
                "title": p.get("title", f"Phase {i + 1}"),
                "topic": p.get("topic", ""),
                "questions": p.get("question_count", questions_per_phase),
            } for i, p in enumerate(phases_data)], indent=2),
            created_by=str(user_id),
        )
        self.db.add(approval)
        await self.db.flush()
        await self.db.refresh(task)
        await self.db.refresh(approval)

        return {
            "task_id": str(task.id),
            "title": task.title,
            "total_phases": task.total_phases,
            "total_questions_planned": task.total_questions_planned,
            "approval_id": str(approval.id),
            "status": "planning",
            "phases": [
                {
                    "phase_number": p.get("phase", i + 1),
                    "title": p.get("title", f"Phase {i + 1}"),
                    "description": p.get("description", ""),
                    "topic": p.get("topic", ""),
                    "question_count_planned": p.get("question_count", questions_per_phase),
                }
                for i, p in enumerate(phases_data)
            ],
        }

    async def approve_plan(self, task_id: uuid.UUID, user_id: uuid.UUID, approve: bool = True, reason: str = "") -> dict:
        result = await self.db.execute(
            select(GenerationTask).where(
                GenerationTask.id == task_id,
                GenerationTask.user_id == user_id,
                GenerationTask.is_deleted == False,
            )
        )
        task = result.scalar_one_or_none()
        if task is None:
            raise ValueError("Task not found")

        approval_result = await self.db.execute(
            select(TaskApproval).where(
                TaskApproval.task_id == task_id,
                TaskApproval.is_deleted == False,
            ).order_by(TaskApproval.created_at.desc()).limit(1)
        )
        approval = approval_result.scalar_one_or_none()
        if approval is None:
            raise ValueError("No approval request found")

        if approve:
            approval.status = "approved"
            approval.approved_by = user_id
            approval.approved_at = datetime.now(timezone.utc)
            task.status = "approved"
        else:
            approval.status = "rejected"
            approval.rejected_reason = reason
            task.status = "rejected"

        await self.db.flush()
        return {"task_id": str(task_id), "status": task.status, "approved": approve}

    async def start_task(self, task_id: uuid.UUID, user_id: uuid.UUID) -> AsyncGenerator[dict, None]:
        result = await self.db.execute(
            select(GenerationTask).where(
                GenerationTask.id == task_id,
                GenerationTask.user_id == user_id,
                GenerationTask.is_deleted == False,
            )
        )
        task = result.scalar_one_or_none()
        if task is None:
            yield {"type": "error", "message": "Task not found"}
            return

        if task.status not in ("approved", "in_progress", "paused"):
            yield {"type": "error", "message": f"Task status is '{task.status}'. Cannot start."}
            return

        if task.status == "approved":
            task.status = "in_progress"
            await self.db.flush()

        phases_result = await self.db.execute(
            select(TaskPhase).where(
                TaskPhase.task_id == task_id,
                TaskPhase.is_deleted == False,
            ).order_by(TaskPhase.phase_number)
        )
        all_phases = phases_result.scalars().all()

        for phase in all_phases:
            if phase.status == "completed":
                continue

            if phase.status == "in_progress":
                yield {"type": "resume", "phase": phase.phase_number, "message": f"Resuming phase {phase.phase_number}: {phase.title}"}
            else:
                phase.status = "in_progress"
                phase.started_at = datetime.now(timezone.utc)
                await self.db.flush()
                yield {"type": "phase_start", "phase": phase.phase_number, "title": phase.title, "total": phase.question_count_planned}

            task.current_phase = phase.phase_number
            await self.db.flush()

            remaining = phase.question_count_planned - phase.question_count_generated
            generated_in_phase = phase.question_count_generated

            batch_size = min(remaining, QUESTIONS_PER_QUOTA_CHECK)

            while generated_in_phase < phase.question_count_planned:
                quota_check = await self.token_service.check_quota(user_id, TOKENS_PER_QUESTION_ESTIMATE * batch_size)
                if not quota_check["can_generate"]:
                    phase.status = "paused"
                    phase.paused_at = datetime.now(timezone.utc)
                    task.status = "paused"
                    task.paused_at = datetime.now(timezone.utc)
                    await self.db.flush()
                    yield {
                        "type": "quota_exceeded",
                        "phase": phase.phase_number,
                        "daily_remaining": quota_check["daily_remaining"],
                        "message": "Daily quota exceeded. Task paused. Will auto-resume when quota resets.",
                    }
                    return

                yield {"type": "generating", "phase": phase.phase_number, "progress": f"{generated_in_phase}/{phase.question_count_planned}"}

                try:
                    batch_count = min(batch_size, phase.question_count_planned - generated_in_phase)
                    questions = await self._generate_batch(task, phase, batch_count)

                    if questions:
                        for q_data in questions:
                            q_hash = self._generate_hash(q_data)
                            existing = await self.db.execute(
                                select(GeneratedQuestion.id).where(
                                    GeneratedQuestion.hash == q_hash,
                                    GeneratedQuestion.is_deleted == False,
                                ).limit(1)
                            )
                            if existing.scalar_one_or_none() is not None:
                                continue

                            gen_q = GeneratedQuestion(
                                exam_name=task.exam_name,
                                question_number=generated_in_phase + 1,
                                topic_name=q_data.get("topic", phase.topic or "General"),
                                sub_topic_name=q_data.get("sub_topic", ""),
                                difficulty=q_data.get("difficulty", task.difficulty),
                                language=task.language,
                                question_type="mcq",
                                question_text=q_data.get("question_text", ""),
                                option_a=q_data.get("option_a", ""),
                                option_b=q_data.get("option_b", ""),
                                option_c=q_data.get("option_c", ""),
                                option_d=q_data.get("option_d", ""),
                                correct_answer=q_data.get("correct_answer", "A"),
                                correct_answer_text=q_data.get("correct_answer_text", ""),
                                explanation=q_data.get("explanation", ""),
                                reference_source=q_data.get("reference_source", ""),
                                marks=1,
                                hash=q_hash,
                                is_verified=True,
                                validation_status="verified",
                                created_by=str(user_id),
                            )
                            self.db.add(gen_q)
                            await self.db.flush()

                            answer_key = AnswerKey(
                                question_id=gen_q.id,
                                question_number=gen_q.question_number,
                                correct_option=q_data.get("correct_answer", "A"),
                                correct_answer_text=q_data.get("correct_answer_text", ""),
                                marks=1,
                                explanation_detailed=q_data.get("explanation", ""),
                                difficulty=q_data.get("difficulty", task.difficulty),
                            )
                            self.db.add(answer_key)

                            explanation = Explanation(
                                question_id=gen_q.id,
                                detailed_explanation=q_data.get("explanation", ""),
                                reference_source=q_data.get("reference_source", ""),
                                language=task.language,
                            )
                            self.db.add(explanation)

                            generated_in_phase += 1
                            task.total_questions_generated = (task.total_questions_generated or 0) + 1
                            task.last_question_hash = q_hash
                            phase.question_count_generated = generated_in_phase

                    await self.token_service.track_usage(
                        user_id=user_id,
                        tokens_used=TOKENS_PER_QUESTION_ESTIMATE * batch_count,
                        endpoint=f"/tasks/{task_id}/generate",
                        model_used=self.ai_service.model_name,
                        prompt_tokens=TOKENS_PER_QUESTION_ESTIMATE * batch_count,
                        completion_tokens=TOKENS_PER_QUESTION_ESTIMATE * batch_count // 2,
                    )
                    await self.db.flush()

                except Exception as e:
                    yield {"type": "error", "phase": phase.phase_number, "message": str(e)}
                    continue

                remaining_batch = phase.question_count_planned - generated_in_phase
                batch_size = min(remaining_batch, QUESTIONS_PER_QUOTA_CHECK)

            phase.status = "completed"
            phase.completed_at = datetime.now(timezone.utc)
            await self.db.flush()
            yield {"type": "phase_complete", "phase": phase.phase_number, "generated": generated_in_phase}

        task.status = "completed"
        task.completed_at = datetime.now(timezone.utc)
        await self.db.flush()
        yield {
            "type": "complete",
            "task_id": str(task.id),
            "total_generated": task.total_questions_generated,
            "total_planned": task.total_questions_planned,
            "message": f"All phases complete. Generated {task.total_questions_generated}/{task.total_questions_planned} questions.",
        }

    async def _generate_batch(self, task: GenerationTask, phase: TaskPhase, count: int) -> list[dict]:
        topic_context = f"\nTopic: {phase.topic}" if phase.topic else ""
        phase_context = f"\nPhase: {phase.title} - {phase.description}" if phase.description else ""

        prompt = f"""Generate {count} MCQ questions for the topic below.

Syllabus/Text:
{task.syllabus_text[:8000] if task.syllabus_text else "General knowledge"}{topic_context}{phase_context}

Requirements:
- Language: {task.language}
- Difficulty: {task.difficulty}
- Type: Multiple Choice (4 options A, B, C, D)
- Each question MUST include a detailed explanation

Return ONLY this JSON array:
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
    "explanation": "Detailed explanation...",
    "topic": "{phase.topic or 'General'}",
    "difficulty": "{task.difficulty}"
  }}
]"""

        try:
            result = await self.ai_service.generate_content(prompt)
            cleaned = result.strip()
            if cleaned.startswith("```json"):
                cleaned = cleaned[7:]
            if cleaned.endswith("```"):
                cleaned = cleaned[:-3]
            cleaned = cleaned.strip()
            questions = json.loads(cleaned)
            if isinstance(questions, dict) and "questions" in questions:
                questions = questions["questions"]
            if isinstance(questions, list):
                return questions
            return []
        except Exception:
            return []

    async def get_task_status(self, task_id: uuid.UUID, user_id: uuid.UUID) -> dict:
        result = await self.db.execute(
            select(GenerationTask).where(
                GenerationTask.id == task_id,
                GenerationTask.user_id == user_id,
                GenerationTask.is_deleted == False,
            )
        )
        task = result.scalar_one_or_none()
        if task is None:
            raise ValueError("Task not found")

        phases_result = await self.db.execute(
            select(TaskPhase).where(
                TaskPhase.task_id == task_id,
                TaskPhase.is_deleted == False,
            ).order_by(TaskPhase.phase_number)
        )
        phases = phases_result.scalars().all()

        approval_result = await self.db.execute(
            select(TaskApproval).where(
                TaskApproval.task_id == task_id,
                TaskApproval.is_deleted == False,
            ).order_by(TaskApproval.created_at.desc()).limit(1)
        )
        approval = approval_result.scalar_one_or_none()

        return {
            "task": {
                "id": str(task.id),
                "title": task.title,
                "status": task.status,
                "total_phases": task.total_phases,
                "current_phase": task.current_phase,
                "total_questions_planned": task.total_questions_planned,
                "total_questions_generated": task.total_questions_generated or 0,
                "progress_pct": int((task.total_questions_generated or 0) / task.total_questions_planned * 100) if task.total_questions_planned > 0 else 0,
                "created_at": task.created_at.isoformat() if task.created_at else None,
                "completed_at": task.completed_at.isoformat() if task.completed_at else None,
                "paused_at": task.paused_at.isoformat() if task.paused_at else None,
            },
            "phases": [
                {
                    "phase_number": p.phase_number,
                    "title": p.title,
                    "status": p.status,
                    "question_count_planned": p.question_count_planned,
                    "question_count_generated": p.question_count_generated or 0,
                    "started_at": p.started_at.isoformat() if p.started_at else None,
                    "completed_at": p.completed_at.isoformat() if p.completed_at else None,
                }
                for p in phases
            ],
            "approval": {
                "id": str(approval.id) if approval else None,
                "status": approval.status if approval else None,
                "phase_plan_summary": approval.phase_plan_summary if approval else None,
            } if approval else None,
        }

    async def list_user_tasks(self, user_id: uuid.UUID, page: int = 1, page_size: int = 20) -> dict:
        query = select(GenerationTask).where(
            GenerationTask.user_id == user_id,
            GenerationTask.is_deleted == False,
        ).order_by(GenerationTask.created_at.desc())

        count_query = select(func.count(GenerationTask.id)).where(
            GenerationTask.user_id == user_id,
            GenerationTask.is_deleted == False,
        )
        total = (await self.db.execute(count_query)).scalar() or 0

        offset = (page - 1) * page_size
        result = await self.db.execute(query.offset(offset).limit(page_size))
        tasks = result.scalars().all()

        return {
            "items": [
                {
                    "id": str(t.id),
                    "title": t.title,
                    "status": t.status,
                    "total_phases": t.total_phases,
                    "current_phase": t.current_phase,
                    "total_questions_planned": t.total_questions_planned,
                    "total_questions_generated": t.total_questions_generated or 0,
                    "progress_pct": int((t.total_questions_generated or 0) / t.total_questions_planned * 100) if t.total_questions_planned > 0 else 0,
                    "created_at": t.created_at.isoformat() if t.created_at else None,
                }
                for t in tasks
            ],
            "total": total,
            "page": page,
            "page_size": page_size,
        }

    def _generate_hash(self, question: dict) -> str:
        content = f"{question.get('question_text', '')}|{question.get('option_a', '')}|{question.get('option_b', '')}|{question.get('option_c', '')}|{question.get('option_d', '')}|{question.get('correct_answer', '')}"
        return hashlib.sha256(content.encode()).hexdigest()

    async def auto_resume_paused_tasks(self, user_id: uuid.UUID) -> dict:
        result = await self.db.execute(
            select(GenerationTask).where(
                GenerationTask.user_id == user_id,
                GenerationTask.status == "paused",
                GenerationTask.is_deleted == False,
            ).order_by(GenerationTask.created_at.desc())
        )
        paused_tasks = result.scalars().all()

        quota_check = await self.token_service.check_quota(user_id, TOKENS_PER_QUESTION_ESTIMATE)
        if not quota_check.get("can_generate", False):
            return {
                "resumed": 0,
                "message": "Quota still exhausted. Cannot auto-resume.",
                "paused_count": len(paused_tasks),
            }

        resumed = 0
        for task in paused_tasks:
            task.status = "approved"
            task.paused_at = None
            resumed += 1

        await self.db.flush()
        return {
            "resumed": resumed,
            "message": f"Auto-resumed {resumed} of {len(paused_tasks)} paused tasks.",
            "paused_count": len(paused_tasks),
        }

    def _default_phases(self, total_questions: int, questions_per_phase: int) -> list[dict]:
        num_phases = (total_questions + questions_per_phase - 1) // questions_per_phase
        phases = []
        for i in range(num_phases):
            count = min(questions_per_phase, total_questions - i * questions_per_phase)
            phases.append({
                "phase": i + 1,
                "title": f"Phase {i + 1}",
                "description": f"Generate questions {i * questions_per_phase + 1} to {i * questions_per_phase + count}",
                "topic": "General",
                "question_count": count,
            })
        return phases
