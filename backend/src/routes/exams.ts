import { Router, type Request, type Response } from 'express';
import * as db from '../db/index.js';

const router = Router();

/**
 * GET /api/exams
 * List all exams.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const exams = await db.listExams();
    res.json({ success: true, data: exams });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/exams/:id
 * Get exam with analysis, blueprint, and papers.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const exam = await db.getExam(req.params.id);
    if (!exam) {
      return res.status(404).json({ success: false, error: 'Exam not found' });
    }

    const papers = await db.listPapers(req.params.id);
    res.json({ success: true, data: { ...exam, papers } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/exams/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await db.deleteExam(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
