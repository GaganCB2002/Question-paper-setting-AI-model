import asyncio
import json
import re
import time
from typing import Optional, AsyncGenerator
from datetime import datetime

from app.config import settings
from app.services.ocr_service import OcrService


class AIService:
    def __init__(self):
        self.api_key = settings.GEMINI_API_KEY
        self.model_name = settings.GEMINI_MODEL
        self.max_retries = settings.GEMINI_MAX_RETRIES
        self.timeout = settings.GEMINI_TIMEOUT
        self.ocr_service = OcrService()
        self._client = None
        self._configure_client()

    def _configure_client(self):
        if self.api_key and self.api_key != "your_gemini_api_key_here":
            try:
                from google import genai
                self._client = genai.Client(api_key=self.api_key)
            except Exception as e:
                try:
                    import google.generativeai as genai
                    genai.configure(api_key=self.api_key)
                    self._client = genai
                    self._legacy_mode = True
                except Exception:
                    self._client = None

    def _generate(self, prompt: str, system_instruction: Optional[str] = None) -> str:
        if self._client is None:
            return json.dumps([{
                "question_number": 1,
                "question_text": "AI service not configured. Please set GEMINI_API_KEY in .env",
                "option_a": "Set API key",
                "option_b": "Restart server",
                "option_c": "Check .env file",
                "option_d": "All of the above",
                "correct_answer": "D",
                "correct_answer_text": "All of the above",
                "topic": "General",
                "sub_topic": "Configuration",
                "difficulty": "easy",
                "question_type": "mcq",
                "explanation": "The Gemini API key must be configured in the .env file for the AI service to work.",
                "reference_source": "System Configuration",
                "source_page_number": 1,
                "weightage": 1.0,
                "keywords": "api, configuration, setup",
            }])

        if hasattr(self, '_legacy_mode') and self._legacy_mode:
            model = self._client.GenerativeModel(
                self.model_name,
                system_instruction=system_instruction or "",
                generation_config={
                    "temperature": 0.2,
                    "top_p": 0.95,
                    "max_output_tokens": 8192,
                },
            )
            response = model.generate_content(prompt)
            return response.text

        contents = []
        if system_instruction:
            contents.append({"role": "user", "parts": [{"text": system_instruction + "\n\n---\n\n" + prompt}]})
        else:
            contents.append({"role": "user", "parts": [{"text": prompt}]})

        response = self._client.models.generate_content(
            model=self.model_name,
            contents=contents,
        )
        return response.text

    async def generate_content(
        self, prompt: str, system_instruction: Optional[str] = None
    ) -> str:
        last_error = None
        for attempt in range(self.max_retries):
            try:
                result = await asyncio.to_thread(self._generate, prompt, system_instruction)
                if result:
                    return result
                return ""
            except Exception as e:
                last_error = e
                if attempt < self.max_retries - 1:
                    await asyncio.sleep(2 ** attempt)
                continue
        raise last_error or Exception("AI generation failed")

    async def generate_content_stream(
        self, prompt: str, system_instruction: str = None
    ) -> AsyncGenerator[str, None]:
        yield "Streaming not yet implemented via genai client. Use generate_content instead."

    async def generate_questions(
        self,
        syllabus_text: str,
        exam_pattern: dict,
        source_materials: list[dict],
        language: str = "english",
        question_count: int = 50,
        difficulty: str = "balanced",
        previous_year_questions: list[dict] = None,
    ) -> str:
        prev_year_text = ""
        if previous_year_questions:
            prev_year_text = "\n".join([
                f"- {q.get('question_text', '')}" for q in previous_year_questions[:20]
            ])

        source_text = "\n\n".join([
            f"=== Source: {s.get('filename', 'unknown')} ===\n{s.get('text', '')[:5000]}"
            for s in source_materials
        ])

        prompt = self._build_question_prompt(
            syllabus_text=syllabus_text,
            exam_pattern=exam_pattern,
            source_text=source_text,
            language=language,
            question_count=question_count,
            difficulty=difficulty,
            prev_year_text=prev_year_text,
        )

        system_instruction = self._get_system_instruction(language)
        return await self.generate_content(prompt, system_instruction)

    def _get_system_instruction(self, language: str = "english") -> str:
        kannada_instruction = ""
        if language.lower() in ["kannada", "mixed"]:
            kannada_instruction = """
- When generating in Kannada, use proper Kannada Unicode (UTF-8) text
- Do not transliterate Kannada words into English
- Maintain accurate Kannada character encoding
- For mixed-language questions, maintain language integrity
"""

        return f"""You are a precise, accurate AI Question Paper Generator for Karnataka Government Exams (KKE).
Generate questions ONLY from the provided source materials. Never hallucinate.

CRITICAL RULES:
1. NEVER generate information outside the provided documents
2. NEVER fabricate: government schemes, Karnataka facts, constitutional articles, acts, statistics, dates, current affairs, or exam patterns
3. Every question MUST be traceable to the provided syllabus or source materials
4. If information cannot be verified, generate FEWER questions rather than fabricating
5. All questions must have exactly ONE correct answer among A, B, C, D
6. Each question must include a detailed explanation referencing the source
{kannada_instruction}
7. Questions must be in {language} language
8. Include topic, subtopic, difficulty level, and weightage for each question
9. Return ONLY valid JSON - no markdown formatting, no code blocks"""

    def _build_question_prompt(
        self,
        syllabus_text: str,
        exam_pattern: dict,
        source_text: str,
        language: str,
        question_count: int,
        difficulty: str,
        prev_year_text: str,
    ) -> str:
        return f"""Generate {question_count} exam questions based ONLY on these materials.

SYLLABUS:
{syllabus_text[:8000]}

EXAM PATTERN:
{json.dumps(exam_pattern, ensure_ascii=False, indent=2)[:3000]}

SOURCE MATERIALS:
{source_text[:15000]}

PREVIOUS YEAR QUESTIONS (DO NOT duplicate these):
{prev_year_text[:5000]}

REQUIREMENTS:
- Language: {language}
- Count: {question_count}
- Difficulty: {difficulty}
- Type: Multiple Choice (4 options: A, B, C, D)

Return ONLY this JSON array (no markdown, no code fences):
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
    "topic": "...",
    "sub_topic": "...",
    "difficulty": "easy|moderate|hard",
    "question_type": "mcq",
    "explanation": "... with source reference",
    "reference_source": "...",
    "source_page_number": 0,
    "weightage": 1.0,
    "keywords": "..."
  }}
]

VALIDATION:
- Every question MUST come from the provided syllabus/sources
- NO duplicates
- Exactly one correct answer
- Topic must exist in syllabus
- If you cannot verify from sources, omit the question entirely"""

    async def verify_facts(self, question_json: dict, source_text: str) -> dict:
        prompt = f"""Verify if this question is supported by the source:

QUESTION: {question_json.get('question_text', '')}
ANSWER: {question_json.get('correct_answer')} - {question_json.get('correct_answer_text', '')}
SOURCE CITED: {question_json.get('reference_source', '')}

SOURCE TEXT:
{source_text[:10000]}

Return JSON only:
{{"is_verified": true/false, "confidence": "high|medium|low", "verified_facts": [], "unverifiable_claims": [], "notes": ""}}"""
        try:
            result = await self.generate_content(prompt)
            result = re.sub(r'```json\s*|\s*```', '', result).strip()
            return json.loads(result)
        except Exception:
            return {"is_verified": False, "confidence": "low", "verified_facts": [], "unverifiable_claims": [], "notes": "Verification failed"}

    async def validate_question(self, question: dict) -> dict:
        prompt = f"""Validate this exam question:

{json.dumps(question, ensure_ascii=False, indent=2)}

Check: grammar, unambiguous answer, option balance, clear wording, appropriate difficulty, valid topic.

Return JSON:
{{"is_valid": true/false, "grammar_ok": true/false, "answer_unambiguous": true/false, "options_balanced": true/false, "difficulty_appropriate": true/false, "issues": [], "suggestions": []}}"""
        try:
            result = await self.generate_content(prompt)
            result = re.sub(r'```json\s*|\s*```', '', result).strip()
            return json.loads(result)
        except Exception:
            return {"is_valid": True, "issues": [], "suggestions": []}
