/**
 * Analysis Prompt — Extracts exam structure from uploaded documents
 */
export function buildAnalysisPrompt(extractedTexts: string[], docTypes: string[]): string {
  const documents = extractedTexts.map((text, i) => {
    return `--- DOCUMENT ${i + 1} (Type: ${docTypes[i] || 'unknown'}) ---\n${text}\n--- END DOCUMENT ${i + 1} ---`;
  }).join('\n\n');

  return `TASK: Analyse the following uploaded documents and extract a complete examination structure.

${documents}

PRIORITY ORDER (if documents conflict):
1. Official Notification (highest priority)
2. Official Syllabus
3. Previous Year Papers
4. Study Materials (lowest priority)

EXTRACT AND RETURN THE FOLLOWING IN VALID JSON FORMAT:

{
  "examName": "Full official exam name",
  "conductingAuthority": "Organisation conducting the exam",
  "totalMarks": <number>,
  "totalQuestions": <number>,
  "duration": "Time duration (e.g., '90 minutes')",
  "negativeMarking": "Description (e.g., '0.25 marks per wrong answer' or 'No negative marking')",
  "language": "Exam language (e.g., 'Kannada and English')",
  "questionType": "e.g., 'Multiple Choice Questions (MCQ)'",
  "topicWeightage": [
    {
      "section": "Section name",
      "topic": "Topic name",
      "questions": <number of questions>,
      "marks": <marks for this topic>,
      "weightage": "percentage%"
    }
  ],
  "difficultyDistribution": {
    "easy": 20,
    "moderate": 40,
    "hard": 30,
    "veryHard": 10
  },
  "importantInstructions": ["instruction 1", "instruction 2"],
  "frequentTopics": ["topic 1", "topic 2"],
  "previousYearTrends": ["trend 1", "trend 2"]
}

RULES:
- If a field cannot be determined, use reasonable defaults based on typical Karnataka Government exam patterns.
- For topic weightage, infer from syllabus sections and previous paper patterns.
- Total questions in topicWeightage must sum to totalQuestions.
- Return ONLY valid JSON. No markdown, no explanation, no code blocks.`;
}
