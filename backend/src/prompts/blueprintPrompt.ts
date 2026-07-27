/**
 * Blueprint Prompt — Generates internal exam blueprint from analysis
 */
export function buildBlueprintPrompt(analysisJson: string): string {
  return `Based on the following exam analysis, create a detailed internal exam blueprint.

EXAM ANALYSIS:
${analysisJson}

Generate a blueprint in the following JSON format:

{
  "topics": [
    {
      "topic": "Topic Name",
      "subtopics": ["Subtopic 1", "Subtopic 2"],
      "weightage": <percentage>,
      "totalQuestions": <number>,
      "difficultyBreakdown": {
        "easy": <count>,
        "moderate": <count>,
        "hard": <count>,
        "veryHard": <count>
      },
      "questionTypes": ["direct_mcq", "statement_based", ...],
      "importanceScore": <1-10>,
      "previousYearFrequency": "<high/medium/low>",
      "revisionPriority": "<critical/high/medium/low>"
    }
  ],
  "totalQuestions": <number>,
  "questionTypeDistribution": {
    "direct_mcq": <percentage>,
    "conceptual_mcq": <percentage>,
    "statement_based": <percentage>,
    "assertion_reason": <percentage>,
    "match_following": <percentage>,
    "numerical": <percentage>,
    "application": <percentage>,
    "other": <percentage>
  }
}

RULES:
- Ensure all questions sum to the total.
- Difficulty distribution: Easy 20%, Moderate 40%, Hard 30%, Very Hard 10%.
- Question types should be naturally distributed.
- Return ONLY valid JSON.`;
}
