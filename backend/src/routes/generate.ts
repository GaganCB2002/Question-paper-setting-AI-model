import { Router, type Request, type Response } from 'express';
import { streamGeneratePaper, generatePaper, generateExplanations, generateTrapAnalysis } from '../services/gemini.js';
import * as db from '../db/index.js';
import { SET_PROFILES } from '../../../shared/types.js';
import type { SetProfile } from '../../../shared/types.js';

const router = Router();

/**
 * POST /api/generate
 * Generate a question paper set. Supports SSE streaming.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { examId, setNumber, stream } = req.body;

    if (!examId) {
      return res.status(400).json({ success: false, error: 'examId is required' });
    }

    if (!setNumber || setNumber < 1 || setNumber > 6) {
      return res.status(400).json({ success: false, error: 'setNumber must be between 1 and 6' });
    }

    // Get exam with analysis and blueprint
    const exam = await db.getExam(examId);
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }

    const analysis = exam.analysis;
    const blueprint = exam.blueprint;
    const totalQuestions = analysis?.totalQuestions || 100;
    const setConfig = SET_PROFILES[setNumber];
    const setProfile = setConfig.profile as SetProfile;

    // Get previously generated questions for this exam (to avoid duplicates)
    const existingQuestions = await db.getQuestionsByExam(examId);
    const previousQuestions = existingQuestions.length > 0
      ? JSON.stringify(existingQuestions.map((q: any) => q.questionText))
      : undefined;

    // Create paper record
    const paper = await db.createPaper({
      examId,
      setNumber,
      setName: setConfig.name,
      difficultyProfile: setProfile,
      status: 'generating',
    });

    // SSE streaming mode
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      // Send paper ID immediately
      res.write(`data: ${JSON.stringify({ type: 'started', data: { paperId: paper.id, setName: setConfig.name } })}\n\n`);

      try {
        let fullText = '';
        for await (const chunk of streamGeneratePaper(analysis, blueprint, setProfile, totalQuestions, previousQuestions)) {
          fullText += chunk;
          res.write(`data: ${JSON.stringify({ type: 'chunk', data: chunk })}\n\n`);
        }

        // Parse questions from generated text
        const questions = parseQuestions(fullText, paper.id, examId);

        if (questions.length > 0) {
          // Save questions to DB
          await db.createQuestions(questions);

          // Build answer key
          const answerKey = questions.map(q => ({
            questionNumber: q.questionNumber,
            answer: q.correctAnswer,
            topic: q.topic,
            difficulty: q.difficulty,
          }));

          // Generate explanations (async, don't block stream)
          generateExplanationsAsync(paper.id, examId, questions);

          // Generate trap analysis (async)
          generateTrapAnalysisAsync(paper.id, JSON.stringify(questions));

          // Update paper
          await db.updatePaper(paper.id, {
            content: fullText,
            answerKey,
            status: 'complete',
          });

          res.write(`data: ${JSON.stringify({
            type: 'complete',
            data: {
              paperId: paper.id,
              questionCount: questions.length,
              answerKey,
            },
          })}\n\n`);
        } else {
          await db.updatePaper(paper.id, {
            content: fullText,
            status: 'complete',
          });

          res.write(`data: ${JSON.stringify({
            type: 'complete',
            data: { paperId: paper.id, rawText: fullText },
          })}\n\n`);
        }
      } catch (err: any) {
        await db.updatePaper(paper.id, { status: 'error' });
        res.write(`data: ${JSON.stringify({ type: 'error', data: err.message })}\n\n`);
      }

      res.end();
      return;
    }

    // Regular JSON response
    try {
      const rawText = await generatePaper(analysis, blueprint, setProfile, totalQuestions, previousQuestions);
      const questions = parseQuestions(rawText, paper.id, examId);

      if (questions.length > 0) {
        await db.createQuestions(questions);

        const answerKey = questions.map(q => ({
          questionNumber: q.questionNumber,
          answer: q.correctAnswer,
          topic: q.topic,
          difficulty: q.difficulty,
        }));

        generateExplanationsAsync(paper.id, examId, questions);
        generateTrapAnalysisAsync(paper.id, JSON.stringify(questions));

        await db.updatePaper(paper.id, {
          content: rawText,
          answerKey,
          status: 'complete',
        });

        return res.json({
          success: true,
          data: {
            paperId: paper.id,
            setName: setConfig.name,
            questionCount: questions.length,
            questions,
            answerKey,
          },
        });
      }

      await db.updatePaper(paper.id, { content: rawText, status: 'complete' });
      return res.json({
        success: true,
        data: { paperId: paper.id, rawText },
      });
    } catch (err: any) {
      await db.updatePaper(paper.id, { status: 'error' });
      throw err;
    }
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * Parse questions JSON from raw AI output.
 */
function parseQuestions(rawText: string, paperId: string, examId: string): any[] {
  try {
    const jsonStr = extractJson(rawText);
    const parsed = JSON.parse(jsonStr);
    const questions = Array.isArray(parsed) ? parsed : (parsed.questions || []);

    return questions.map((q: any) => ({
      paperId,
      examId,
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctAnswer: q.correctAnswer,
      topic: q.topic || 'General',
      subtopic: q.subtopic,
      difficulty: q.difficulty || 'moderate',
      questionType: q.questionType || 'direct_mcq',
    }));
  } catch (err) {
    console.error('Failed to parse questions:', err);
    return [];
  }
}

function extractJson(text: string): string {
  const jsonBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonBlockMatch) return jsonBlockMatch[1].trim();
  const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (jsonMatch) return jsonMatch[1].trim();
  return text.trim();
}

/**
 * Generate explanations asynchronously and save to DB.
 */
async function generateExplanationsAsync(paperId: string, examId: string, questions: any[]) {
  try {
    const questionsForExplanation = questions.map(q => ({
      questionNumber: q.questionNumber,
      questionText: q.questionText,
      optionA: q.optionA,
      optionB: q.optionB,
      optionC: q.optionC,
      optionD: q.optionD,
      correctAnswer: q.correctAnswer,
    }));

    const explanations = await generateExplanations(JSON.stringify(questionsForExplanation));

    if (Array.isArray(explanations)) {
      await db.updateQuestions(paperId, explanations.map(exp => ({
        questionNumber: exp.questionNumber,
        explanation: `${exp.explanation}\n\nWhy others are wrong: ${exp.whyOthersWrong}\n\nKey concept: ${exp.importantConcept}`,
        memoryTrick: exp.memoryTrick,
        previousYearRelevance: exp.previousYearRelevance,
      })));
    }
  } catch (err) {
    console.error('Failed to generate explanations:', err);
  }
}

/**
 * Generate trap analysis asynchronously and save to DB.
 */
async function generateTrapAnalysisAsync(paperId: string, questionsJson: string) {
  try {
    const trapAnalysis = await generateTrapAnalysis(questionsJson);
    await db.updatePaper(paperId, { trapAnalysis });
  } catch (err) {
    console.error('Failed to generate trap analysis:', err);
  }
}

export default router;
