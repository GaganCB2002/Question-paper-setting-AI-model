/**
 * Explanation Prompt — Generates detailed explanations for answer keys
 */
export function buildExplanationPrompt(questionsJson: string): string {
  return `Generate detailed explanations for the following exam questions.

QUESTIONS:
${questionsJson}

For EACH question, provide:

[
  {
    "questionNumber": <number>,
    "explanation": "Detailed explanation of why the correct answer is right",
    "whyOthersWrong": "Brief explanation of why each wrong option is incorrect",
    "importantConcept": "The key concept being tested",
    "memoryTrick": "A mnemonic or memory aid to remember this concept",
    "previousYearRelevance": "How often this concept appears in exams",
    "difficultyLevel": "easy|moderate|hard|very_hard"
  }
]

RULES:
- Explanations must be thorough but concise.
- Memory tricks should be genuinely helpful.
- Always mention if the concept is frequently asked.
- Return ONLY the JSON array.`;
}

/**
 * Trap Analysis Prompt — Identifies tricky and high-impact questions
 */
export function buildTrapAnalysisPrompt(questionsJson: string): string {
  return `Analyse the following exam questions and identify traps, common mistakes, and exam strategy insights.

QUESTIONS:
${questionsJson}

Return a JSON object:

{
  "topDifficultQuestions": ["Q1: Brief description of why it's difficult", ...],
  "commonMistakes": ["Common mistake 1", ...],
  "importantConcepts": ["Concept 1", ...],
  "revisionPriority": ["Topic 1 — priority reason", ...],
  "expectedCutOffImpact": "Analysis of how this paper's difficulty would affect cut-off scores"
}

Return ONLY valid JSON.`;
}
