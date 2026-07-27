import { Router, type Request, type Response } from 'express';
import * as db from '../db/index.js';

const router = Router();

/**
 * GET /api/questions
 * Browse question bank with filters.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const filters = {
      examId: req.query.examId as string | undefined,
      topic: req.query.topic as string | undefined,
      difficulty: req.query.difficulty as string | undefined,
      questionType: req.query.questionType as string | undefined,
      limit: req.query.limit ? parseInt(req.query.limit as string) : 50,
      offset: req.query.offset ? parseInt(req.query.offset as string) : 0,
    };

    const result = await db.searchQuestions(filters);
    res.json({
      success: true,
      data: result.questions,
      pagination: {
        total: result.total,
        limit: filters.limit,
        offset: filters.offset,
        hasMore: filters.offset + filters.limit < result.total,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/questions/topics
 * Get topic-wise statistics.
 */
router.get('/topics', async (req: Request, res: Response) => {
  try {
    const examId = req.query.examId as string | undefined;
    const stats = await db.getTopicStats(examId);
    res.json({ success: true, data: stats });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/questions/paper/:paperId
 * Get all questions for a specific paper.
 */
router.get('/paper/:paperId', async (req: Request, res: Response) => {
  try {
    const questions = await db.getQuestionsByPaper(req.params.paperId);
    res.json({ success: true, data: questions });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
