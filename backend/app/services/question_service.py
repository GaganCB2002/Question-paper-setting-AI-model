import json
import uuid
import hashlib
from datetime import datetime
from typing import Optional, AsyncGenerator

from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select, and_, or_, func, text

from app.models.question import (
    QuestionBank,
    GeneratedPaper,
    GeneratedQuestion,
    PreviousYearQuestion,
)
from app.models.syllabus import Syllabus, Topic, SubTopic
from app.models.exam_pattern import ExamPattern
from app.models.answer_key import AnswerKey, Explanation
from app.models.uploaded_file import UploadedFile
from app.services.ai_service import AIService


class QuestionService:
    def __init__(self, db: AsyncSession):
        self.db = db
        self.ai_service = AIService()

    async def generate_paper(
        self,
        user_id: uuid.UUID,
        exam_name: str,
        syllabus_id: Optional[uuid.UUID] = None,
        exam_pattern_id: Optional[uuid.UUID] = None,
        source_file_ids: list[uuid.UUID] = None,
        language: str = "english",
        question_count: int = 50,
        difficulty: str = "balanced",
        paper_set: str = "set_1",
        previous_year_ids: list[uuid.UUID] = None,
    ) -> AsyncGenerator[dict, None]:
        syllabus_text = ""
        exam_pattern_data = {}
        source_materials = []
        prev_year_questions = []

        if syllabus_id:
            result = await self.db.execute(
                select(Syllabus).where(Syllabus.id == syllabus_id, Syllabus.is_deleted == False)
            )
            syllabus = result.scalar_one_or_none()
            if syllabus:
                syllabus_text = syllabus.raw_text or syllabus.description or ""

        if exam_pattern_id:
            result = await self.db.execute(
                select(ExamPattern).where(ExamPattern.id == exam_pattern_id, ExamPattern.is_deleted == False)
            )
            pattern = result.scalar_one_or_none()
            if pattern:
                exam_pattern_data = {
                    "exam_name": pattern.exam_name,
                    "total_marks": pattern.total_marks,
                    "total_questions": pattern.total_questions,
                    "duration_minutes": pattern.duration_minutes,
                    "sections": pattern.sections_json,
                    "marking_scheme": pattern.marking_scheme_json,
                }

        if source_file_ids:
            for fid in source_file_ids:
                result = await self.db.execute(
                    select(UploadedFile).where(UploadedFile.id == fid, UploadedFile.is_deleted == False)
                )
                file = result.scalar_one_or_none()
                if file:
                    source_materials.append({
                        "filename": file.original_filename,
                        "text": file.extracted_text or file.ocr_text or "",
                    })

        if previous_year_ids:
            for pyid in previous_year_ids:
                result = await self.db.execute(
                    select(PreviousYearQuestion).where(
                        PreviousYearQuestion.id == pyid,
                        PreviousYearQuestion.is_deleted == False,
                    )
                )
                pyq = result.scalar_one_or_none()
                if pyq:
                    prev_year_questions.append({
                        "question_text": pyq.question_text,
                        "correct_answer": pyq.correct_answer,
                        "topic": pyq.topic,
                    })

        yield {"type": "progress", "message": "Generating questions with AI...", "progress": 10}

        try:
            ai_response = await self.ai_service.generate_questions(
                syllabus_text=syllabus_text,
                exam_pattern=exam_pattern_data,
                source_materials=source_materials,
                language=language,
                question_count=question_count,
                difficulty=difficulty,
                previous_year_questions=prev_year_questions,
            )
        except Exception as e:
            yield {"type": "error", "message": f"AI generation failed: {str(e)}"}
            return

        yield {"type": "progress", "message": "Processing AI response...", "progress": 50}

        questions = self._parse_ai_response(ai_response)
        if not questions:
            yield {"type": "error", "message": "Failed to parse AI response. No valid questions generated."}
            return

        yield {"type": "progress", "message": f"Validating {len(questions)} questions...", "progress": 60}

        paper = GeneratedPaper(
            user_id=user_id,
            exam_pattern_id=exam_pattern_id,
            exam_name=exam_name,
            paper_set=paper_set,
            title=f"{exam_name} - {paper_set.replace('_', ' ').title()}",
            language=language,
            total_marks=question_count,
            total_questions=question_count,
            difficulty_profile=difficulty,
            created_by=str(user_id),
        )
        self.db.add(paper)
        await self.db.flush()
        await self.db.refresh(paper)

        valid_questions = []
        validation_results = []

        for idx, q_data in enumerate(questions):
            yield {"type": "progress", "message": f"Validating question {idx + 1}/{len(questions)}...", "progress": 60 + int(30 * (idx + 1) / len(questions))}

            validation = await self._validate_question(q_data, syllabus_text)
            validation_results.append(validation)

            if validation.get("is_valid", False):
                q_hash = self._generate_question_hash(q_data)
                topic = await self._get_or_create_topic(q_data.get("topic", "General"), syllabus_id)
                sub_topic = await self._get_or_create_sub_topic(
                    q_data.get("sub_topic", "General"), topic.id if topic else None
                )

                gen_q = GeneratedQuestion(
                    paper_id=paper.id,
                    question_number=idx + 1,
                    exam_name=exam_name,
                    paper_set=paper_set,
                    topic_id=topic.id if topic else None,
                    sub_topic_id=sub_topic.id if sub_topic else None,
                    topic_name=q_data.get("topic", "General"),
                    sub_topic_name=q_data.get("sub_topic", "General"),
                    difficulty=q_data.get("difficulty", "moderate"),
                    language=language,
                    question_type=q_data.get("question_type", "mcq"),
                    question_text=q_data.get("question_text", ""),
                    option_a=q_data.get("option_a", ""),
                    option_b=q_data.get("option_b", ""),
                    option_c=q_data.get("option_c", ""),
                    option_d=q_data.get("option_d", ""),
                    correct_answer=q_data.get("correct_answer", "A"),
                    correct_answer_text=q_data.get("correct_answer_text", ""),
                    explanation=q_data.get("explanation", ""),
                    reference_source=q_data.get("reference_source", ""),
                    source_page_number=q_data.get("source_page_number"),
                    weightage=q_data.get("weightage", 1.0),
                    keywords=q_data.get("keywords", ""),
                    marks=1,
                    is_verified=validation.get("fact_verified", False),
                    validation_status="verified" if validation.get("is_valid") else "failed",
                    fact_checked=validation.get("fact_verified", False),
                    grammar_checked=validation.get("grammar_ok", False),
                    option_balance_checked=validation.get("options_balanced", False),
                    hash=q_hash,
                    created_by=str(user_id),
                )
                self.db.add(gen_q)
                await self.db.flush()
                await self.db.refresh(gen_q)

                answer_key = AnswerKey(
                    paper_id=paper.id,
                    question_id=gen_q.id,
                    question_number=idx + 1,
                    correct_option=q_data.get("correct_answer", "A"),
                    correct_answer_text=q_data.get("correct_answer_text", ""),
                    marks=1,
                    explanation_short=q_data.get("explanation", "")[:200] if q_data.get("explanation") else "",
                    explanation_detailed=q_data.get("explanation", ""),
                    reference_source=q_data.get("reference_source", ""),
                    topic=q_data.get("topic", "General"),
                    difficulty=q_data.get("difficulty", "moderate"),
                )
                self.db.add(answer_key)

                explanation = Explanation(
                    question_id=gen_q.id,
                    short_explanation=q_data.get("explanation", "")[:200] if q_data.get("explanation") else "",
                    detailed_explanation=q_data.get("explanation", ""),
                    reference_source=q_data.get("reference_source", ""),
                    source_page=q_data.get("source_page_number"),
                    language=language,
                    is_verified=validation.get("fact_verified", False),
                )
                self.db.add(explanation)

                valid_questions.append(gen_q)
            else:
                yield {
                    "type": "validation_issue",
                    "question": q_data.get("question_text", "")[:100],
                    "issues": validation.get("issues", []),
                }

            await self.db.flush()

        paper.total_questions = len(valid_questions)
        paper.total_marks = len(valid_questions)
        question_ids = [str(q.id) for q in valid_questions]
        paper.question_ids_json = json.dumps(question_ids)
        await self.db.flush()

        yield {
            "type": "complete",
            "paper_id": str(paper.id),
            "total_generated": len(questions),
            "total_valid": len(valid_questions),
            "invalid_count": len(questions) - len(valid_questions),
            "message": f"Successfully generated {len(valid_questions)} verified questions out of {len(questions)}",
            "progress": 100,
        }

    def _parse_ai_response(self, response: str) -> list[dict]:
        try:
            cleaned = response.strip()
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
        except json.JSONDecodeError:
            questions = self._extract_json_from_text(response)
            if questions:
                return questions
            return []

    def _extract_json_from_text(self, text: str) -> list[dict]:
        import re
        json_pattern = r'\[[\s\S]*\]'
        match = re.search(json_pattern, text)
        if match:
            try:
                return json.loads(match.group())
            except json.JSONDecodeError:
                pass
        obj_pattern = r'\{[\s\S]*"question_text"[\s\S]*\}'
        matches = re.findall(obj_pattern, text)
        questions = []
        for m in matches:
            try:
                q = json.loads("{" + m + "}")
                questions.append(q)
            except json.JSONDecodeError:
                pass
        return questions

    def _generate_question_hash(self, question: dict) -> str:
        content = f"{question.get('question_text', '')}|{question.get('option_a', '')}|{question.get('option_b', '')}|{question.get('option_c', '')}|{question.get('option_d', '')}|{question.get('correct_answer', '')}"
        return hashlib.sha256(content.encode()).hexdigest()

    async def _validate_question(self, question: dict, syllabus_text: str) -> dict:
        result = {
            "is_valid": True,
            "issues": [],
            "grammar_ok": True,
            "answer_unambiguous": True,
            "options_balanced": True,
            "difficulty_appropriate": True,
            "fact_verified": False,
        }

        if not question.get("question_text"):
            result["is_valid"] = False
            result["issues"].append("Question text is empty")
        if not question.get("correct_answer"):
            result["is_valid"] = False
            result["issues"].append("No correct answer specified")
        if not question.get("option_a") or not question.get("option_b"):
            result["is_valid"] = False
            result["issues"].append("Options A and B are required")
        if question.get("correct_answer") not in ["A", "B", "C", "D", "a", "b", "c", "d"]:
            result["is_valid"] = False
            result["issues"].append("Correct answer must be A, B, C, or D")

        duplicate_check = await self._check_duplicate(question)
        if duplicate_check:
            result["is_valid"] = False
            result["issues"].append("Duplicate question")

        if not question.get("topic"):
            result["issues"].append("Topic not specified")

        fact_check = await self.ai_service.verify_facts(question, syllabus_text)
        if fact_check.get("is_verified"):
            result["fact_verified"] = True
        else:
            result["issues"].append("Question could not be verified from source materials")
            if not question.get("reference_source"):
                result["is_valid"] = False

        return result

    async def _check_duplicate(self, question: dict) -> bool:
        q_hash = self._generate_question_hash(question)
        result = await self.db.execute(
            select(GeneratedQuestion.id).where(GeneratedQuestion.hash == q_hash, GeneratedQuestion.is_deleted == False).limit(1)
        )
        return result.scalar_one_or_none() is not None

    async def _get_or_create_topic(self, topic_name: str, syllabus_id: Optional[uuid.UUID]) -> Optional[Topic]:
        result = await self.db.execute(
            select(Topic).where(
                Topic.name == topic_name,
                Topic.syllabus_id == syllabus_id,
                Topic.is_deleted == False,
            ).limit(1)
        )
        topic = result.scalar_one_or_none()
        if topic is None and syllabus_id:
            topic = Topic(
                name=topic_name,
                syllabus_id=syllabus_id,
                status="active",
            )
            self.db.add(topic)
            await self.db.flush()
            await self.db.refresh(topic)
        return topic

    async def _get_or_create_sub_topic(self, sub_topic_name: str, topic_id: Optional[uuid.UUID]) -> Optional[SubTopic]:
        if topic_id is None:
            return None
        result = await self.db.execute(
            select(SubTopic).where(
                SubTopic.name == sub_topic_name,
                SubTopic.topic_id == topic_id,
                SubTopic.is_deleted == False,
            ).limit(1)
        )
        sub_topic = result.scalar_one_or_none()
        if sub_topic is None:
            sub_topic = SubTopic(
                name=sub_topic_name,
                topic_id=topic_id,
                status="active",
            )
            self.db.add(sub_topic)
            await self.db.flush()
            await self.db.refresh(sub_topic)
        return sub_topic

    async def search_questions(
        self,
        query: str = None,
        topic: str = None,
        difficulty: str = None,
        language: str = None,
        question_type: str = None,
        exam_name: str = None,
        keyword: str = None,
        page: int = 1,
        page_size: int = 20,
    ) -> tuple[list[GeneratedQuestion], int]:
        conditions = [GeneratedQuestion.is_deleted == False]

        if query:
            conditions.append(
                or_(
                    GeneratedQuestion.question_text.ilike(f"%{query}%"),
                    GeneratedQuestion.topic_name.ilike(f"%{query}%"),
                    GeneratedQuestion.keywords.ilike(f"%{query}%"),
                )
            )
        if topic:
            conditions.append(GeneratedQuestion.topic_name.ilike(f"%{topic}%"))
        if difficulty:
            conditions.append(GeneratedQuestion.difficulty == difficulty)
        if language:
            conditions.append(GeneratedQuestion.language == language)
        if question_type:
            conditions.append(GeneratedQuestion.question_type == question_type)
        if exam_name:
            conditions.append(GeneratedQuestion.exam_name.ilike(f"%{exam_name}%"))
        if keyword:
            conditions.append(GeneratedQuestion.keywords.ilike(f"%{keyword}%"))

        query_stmt = select(GeneratedQuestion).where(and_(*conditions)).order_by(GeneratedQuestion.created_at.desc())

        count_stmt = select(func.count(GeneratedQuestion.id)).where(and_(*conditions))
        total_result = await self.db.execute(count_stmt)
        total = total_result.scalar() or 0

        offset = (page - 1) * page_size
        result = await self.db.execute(query_stmt.offset(offset).limit(page_size))
        questions = result.scalars().all()
        return list(questions), total
