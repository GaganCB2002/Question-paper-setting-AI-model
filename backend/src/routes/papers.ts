import { Router, type Request, type Response } from 'express';
import * as db from '../db/index.js';
import { exportToPDF, exportToDOCX } from '../services/export.js';

const router = Router();

/**
 * GET /api/papers
 * List all papers, optionally filtered by examId.
 */
router.get('/', async (req: Request, res: Response) => {
  try {
    const examId = req.query.examId as string | undefined;
    const papers = await db.listPapers(examId);
    res.json({ success: true, data: papers });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/papers/:id
 * Get a specific paper with its questions.
 */
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const paper = await db.getPaper(req.params.id);
    if (!paper) {
      return res.status(404).json({ success: false, error: 'Paper not found' });
    }

    const questions = await db.getQuestionsByPaper(req.params.id);
    res.json({ success: true, data: { ...paper, questions } });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * DELETE /api/papers/:id
 */
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    await db.deletePaper(req.params.id);
    res.json({ success: true });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/papers/:id/export/pdf
 * Export paper as PDF.
 */
router.get('/:id/export/pdf', async (req: Request, res: Response) => {
  try {
    const paper: any = await db.getPaper(req.params.id);
    if (!paper) {
      return res.status(404).json({ success: false, error: 'Paper not found' });
    }

    const questions = await db.getQuestionsByPaper(req.params.id);
    const exam: any = await db.getExam(paper.examId);
    const includeAnswers = req.query.answers === 'true';

    const pdfBuffer = await exportToPDF(
      exam?.name || 'Exam Paper',
      paper.setName || `SET ${paper.setNumber}`,
      questions,
      includeAnswers
    );

    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="${exam?.name || 'paper'}_set${paper.setNumber}.pdf"`);
    res.send(pdfBuffer);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

/**
 * GET /api/papers/:id/export/docx
 * Export paper as DOCX.
 */
router.get('/:id/export/docx', async (req: Request, res: Response) => {
  try {
    const paper: any = await db.getPaper(req.params.id);
    if (!paper) {
      return res.status(404).json({ success: false, error: 'Paper not found' });
    }

    const questions = await db.getQuestionsByPaper(req.params.id);
    const exam: any = await db.getExam(paper.examId);
    const includeAnswers = req.query.answers === 'true';

    const docxBuffer = await exportToDOCX(
      exam?.name || 'Exam Paper',
      paper.setName || `SET ${paper.setNumber}`,
      questions,
      includeAnswers
    );

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${exam?.name || 'paper'}_set${paper.setNumber}.docx"`);
    res.send(docxBuffer);
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
