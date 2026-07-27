import { extractTextFromImage } from './gemini.js';

/**
 * Parse a PDF file and extract text.
 */
export async function parsePDF(buffer: Buffer): Promise<string> {
  // pdf-parse has a quirky default export
  const pdfParse = (await import('pdf-parse')).default;
  const data = await pdfParse(buffer);
  return data.text;
}

/**
 * Parse a DOCX file and extract text.
 */
export async function parseDOCX(buffer: Buffer): Promise<string> {
  const mammoth = await import('mammoth');
  const result = await mammoth.extractRawText({ buffer });
  return result.value;
}

/**
 * Parse a plain text file.
 */
export function parseTXT(buffer: Buffer): string {
  return buffer.toString('utf-8');
}

/**
 * Parse an image file using Gemini Vision for OCR.
 */
export async function parseImage(buffer: Buffer, mimeType: string): Promise<string> {
  return extractTextFromImage(buffer, mimeType);
}

/**
 * Detect file type and parse accordingly.
 */
export async function parseFile(
  buffer: Buffer,
  filename: string,
  mimeType: string
): Promise<string> {
  const ext = filename.toLowerCase().split('.').pop();

  switch (ext) {
    case 'pdf':
      return parsePDF(buffer);
    case 'docx':
    case 'doc':
      return parseDOCX(buffer);
    case 'txt':
    case 'md':
    case 'text':
      return parseTXT(buffer);
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
    case 'gif':
      return parseImage(buffer, mimeType);
    default:
      // Try text parsing as fallback
      try {
        return parseTXT(buffer);
      } catch {
        throw new Error(`Unsupported file type: ${ext}`);
      }
  }
}

/**
 * Get file type category.
 */
export function getFileCategory(filename: string): string {
  const ext = filename.toLowerCase().split('.').pop();
  switch (ext) {
    case 'pdf': return 'pdf';
    case 'docx':
    case 'doc': return 'docx';
    case 'txt':
    case 'md': return 'text';
    case 'png':
    case 'jpg':
    case 'jpeg':
    case 'webp':
    case 'gif': return 'image';
    default: return 'unknown';
  }
}
