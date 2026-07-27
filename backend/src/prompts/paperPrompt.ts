import type { SetProfile } from '../../../shared/types.js';

/**
 * Paper Generation Prompt — Creates question papers per set profile
 */

const SET_INSTRUCTIONS: Record<string, string> = {
  balanced: `SET 1 — BALANCED COVERAGE
- Cover ALL topics proportionally to their weightage.
- Use standard difficulty distribution: Easy 20%, Moderate 40%, Hard 30%, Very Hard 10%.
- Mix question types naturally across all categories.
- This set should be representative of a typical exam paper.`,

  moderate_difficult: `SET 2 — MODERATE TO DIFFICULT
- Increase difficulty: Easy 10%, Moderate 35%, Hard 40%, Very Hard 15%.
- Focus on questions that test deeper understanding.
- Include more multi-statement and analysis questions.
- Maintain topic coverage but lean toward harder concepts.`,

  conceptual: `SET 3 — CONCEPTUAL
- Focus on testing conceptual understanding, not rote memorization.
- Every question should test WHY, HOW, or the PRINCIPLE behind facts.
- Use "Which of the following statements is/are correct?" format frequently.
- Include comparative questions between similar concepts.
- Difficulty: Easy 15%, Moderate 35%, Hard 35%, Very Hard 15%.`,

  application_analytical: `SET 4 — APPLICATION & ANALYTICAL
- Focus on scenario-based and real-world application questions.
- Use case studies, data interpretation, and practical problem-solving.
- Questions should test ability to APPLY knowledge, not just recall.
- Include government scheme implementation scenarios.
- Difficulty: Easy 10%, Moderate 30%, Hard 40%, Very Hard 20%.`,

  tricky_statement: `SET 5 — TRICKY STATEMENT-BASED
- Heavy use of statement-based questions.
- Include Assertion & Reason, Multiple Correct Statements, and "Consider the following" formats.
- Design deliberately tricky distractors that test careful reading.
- Include exam trap questions where commonly confused facts are tested.
- Difficulty: Easy 10%, Moderate 30%, Hard 35%, Very Hard 25%.`,

  final_mock: `SET 6 — COMPLETE FINAL MOCK EXAM
- Simulate a real exam paper exactly as it would appear in the examination hall.
- Use standard difficulty distribution: Easy 20%, Moderate 40%, Hard 30%, Very Hard 10%.
- Balance all question types naturally.
- This is the definitive practice paper — highest quality and authenticity.
- Include 2-3 current affairs questions if the syllabus includes them.`,
};

export function buildPaperPrompt(
  analysisJson: string,
  blueprintJson: string,
  setProfile: SetProfile,
  totalQuestions: number,
  previousQuestions?: string
): string {
  const setInstruction = SET_INSTRUCTIONS[setProfile] || SET_INSTRUCTIONS.balanced;

  return `GENERATE A COMPLETE QUESTION PAPER.

EXAM ANALYSIS:
${analysisJson}

EXAM BLUEPRINT:
${blueprintJson}

SET PROFILE:
${setInstruction}

TOTAL QUESTIONS TO GENERATE: ${totalQuestions}

${previousQuestions ? `PREVIOUSLY GENERATED QUESTIONS (DO NOT DUPLICATE):
${previousQuestions}` : ''}

OUTPUT FORMAT — Return a JSON array of question objects:

[
  {
    "questionNumber": 1,
    "questionText": "Full question text including any statements, assertions, or data",
    "optionA": "Option A text",
    "optionB": "Option B text",
    "optionC": "Option C text",
    "optionD": "Option D text",
    "correctAnswer": "A",
    "topic": "Topic name",
    "subtopic": "Subtopic name",
    "difficulty": "easy|moderate|hard|very_hard",
    "questionType": "direct_mcq|conceptual_mcq|statement_based|multiple_statement|assertion_reason|match_following|correct_incorrect|chronological_order|numerical|logical_reasoning|application|government_rule|scenario_based|case_study|exam_trap"
  }
]

CRITICAL RULES:
1. Generate EXACTLY ${totalQuestions} questions.
2. Maintain continuous numbering from Q1 to Q${totalQuestions}.
3. RANDOMLY distribute correct answers across A, B, C, D (roughly 25% each).
4. Every question must have exactly ONE correct answer.
5. All distractors must be plausible but clearly wrong.
6. No duplicate questions — each must test a unique concept.
7. Use only verified, factually correct information.
8. For Karnataka-specific questions, use accurate data about districts, rivers, dams, institutions, schemes, personalities, and culture.
9. For statement-based questions, clearly label each statement (Statement I, Statement II, etc.).
10. For Assertion & Reason questions, use the standard format with options about both being correct/incorrect and relationship.
11. For Match the Following, use proper List I / List II format.
12. Return ONLY the JSON array. No markdown, no explanations, no code blocks.`;
}
