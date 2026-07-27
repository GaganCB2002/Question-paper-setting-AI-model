import { Router, type Request, type Response } from 'express';
import { analyzeDocuments, generateBlueprint, streamAnalyzeDocuments } from '../services/gemini.js';
import * as db from '../db/index.js';

const router = Router();

/**
 * POST /api/analyze
 * Analyse uploaded documents and extract exam structure.
 * Supports both regular JSON response and SSE streaming.
 */
router.post('/', async (req: Request, res: Response) => {
  try {
    const { extractedTexts, docTypes, examName, stream } = req.body;

    if (!extractedTexts || !Array.isArray(extractedTexts) || extractedTexts.length === 0) {
      return res.status(400).json({ success: false, error: 'No extracted texts provided' });
    }

    // SSE streaming mode
    if (stream) {
      res.setHeader('Content-Type', 'text/event-stream');
      res.setHeader('Cache-Control', 'no-cache');
      res.setHeader('Connection', 'keep-alive');
      res.setHeader('X-Accel-Buffering', 'no');

      try {
        let fullText = '';
        for await (const chunk of streamAnalyzeDocuments(extractedTexts, docTypes || [])) {
          fullText += chunk;
          res.write(`data: ${JSON.stringify({ type: 'chunk', data: chunk })}\n\n`);
        }

        // Try to parse the final result as structured analysis
        try {
          const jsonStr = extractJson(fullText);
          const analysis = JSON.parse(jsonStr);

          // Generate blueprint
          const blueprint = await generateBlueprint(analysis);

          // Create exam in DB
          const exam = await db.createExam({
            name: examName || analysis.examName || 'Unknown Exam',
            authority: analysis.conductingAuthority,
            totalMarks: analysis.totalMarks,
            totalQuestions: analysis.totalQuestions,
            duration: analysis.duration,
            negativeMarking: analysis.negativeMarking,
            language: analysis.language,
            analysis,
            blueprint,
            sourceTexts: extractedTexts,
          });

          res.write(`data: ${JSON.stringify({ type: 'analysis', data: analysis })}\n\n`);
          res.write(`data: ${JSON.stringify({ type: 'complete', data: { examId: exam.id, analysis, blueprint } })}\n\n`);
        } catch (parseErr) {
          res.write(`data: ${JSON.stringify({ type: 'complete', data: { rawText: fullText } })}\n\n`);
        }
      } catch (err: any) {
        res.write(`data: ${JSON.stringify({ type: 'error', data: err.message })}\n\n`);
      }

      res.end();
      return;
    }

    // Regular JSON response mode
    const analysis = await analyzeDocuments(extractedTexts, docTypes || []);
    const blueprint = await generateBlueprint(analysis);

    // Create exam in DB
    const exam = await db.createExam({
      name: examName || analysis.examName || 'Unknown Exam',
      authority: analysis.conductingAuthority,
      totalMarks: analysis.totalMarks,
      totalQuestions: analysis.totalQuestions,
      duration: analysis.duration,
      negativeMarking: analysis.negativeMarking,
      language: analysis.language,
      analysis,
      blueprint,
      sourceTexts: extractedTexts,
    });

    res.json({
      success: true,
      data: {
        examId: exam.id,
        analysis,
        blueprint,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

function extractJson(text: string): string {
  const jsonBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonBlockMatch) return jsonBlockMatch[1].trim();
  const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (jsonMatch) return jsonMatch[1].trim();
  return text.trim();
}

export default router;
