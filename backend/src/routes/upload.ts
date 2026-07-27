import { Router, type Request, type Response } from 'express';
import { upload } from '../middleware/upload.js';
import { parseFile, getFileCategory } from '../services/fileParser.js';
import * as db from '../db/index.js';

const router = Router();

/**
 * POST /api/upload
 * Upload one or more documents for text extraction.
 */
const MAX_FILES = parseInt(process.env.MAX_FILES || '5');

router.post('/', upload.array('files', MAX_FILES), async (req: Request, res: Response) => {
  try {
    const files = req.files as Express.Multer.File[];

    if (!files || files.length === 0) {
      return res.status(400).json({ success: false, error: 'No files uploaded' });
    }

    const docType = req.body.docType || 'other';
    const examId = req.body.examId || undefined;

    const results = [];

    for (const file of files) {
      try {
        const extractedText = await parseFile(file.buffer, file.originalname, file.mimetype);

        // Save upload record
        const uploadRecord = await db.createUpload({
          examId,
          filename: file.originalname,
          fileType: file.mimetype,
          fileSize: file.size,
          extractedText,
          docType,
        });

        results.push({
          filename: file.originalname,
          fileType: getFileCategory(file.originalname),
          fileSize: file.size,
          extractedText,
          uploadId: uploadRecord.id,
          status: 'success',
        });
      } catch (err: any) {
        results.push({
          filename: file.originalname,
          fileType: getFileCategory(file.originalname),
          fileSize: file.size,
          extractedText: null,
          error: err.message,
          status: 'error',
        });
      }
    }

    res.json({
      success: true,
      data: {
        files: results,
        totalFiles: files.length,
        successCount: results.filter(r => r.status === 'success').length,
        errorCount: results.filter(r => r.status === 'error').length,
      },
    });
  } catch (err: any) {
    res.status(500).json({ success: false, error: err.message });
  }
});

export default router;
