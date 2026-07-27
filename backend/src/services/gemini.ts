import { GoogleGenerativeAI, type GenerativeModel } from '@google/generative-ai';
import { SYSTEM_PROMPT } from '../prompts/systemPrompt.js';
import { buildAnalysisPrompt } from '../prompts/analysisPrompt.js';
import { buildBlueprintPrompt } from '../prompts/blueprintPrompt.js';
import { buildPaperPrompt } from '../prompts/paperPrompt.js';
import { buildExplanationPrompt, buildTrapAnalysisPrompt } from '../prompts/explanationPrompt.js';
import type { ExamAnalysis, SetProfile } from '../../../shared/types.js';

let genAI: GoogleGenerativeAI;
let model: GenerativeModel;

export function initGemini(apiKey: string) {
  genAI = new GoogleGenerativeAI(apiKey);
  model = genAI.getGenerativeModel({
    model: 'gemini-2.5-flash',
    systemInstruction: SYSTEM_PROMPT,
    generationConfig: {
      temperature: 0.7,
      topP: 0.95,
      maxOutputTokens: 65536,
    },
  });
}

/**
 * Analyse uploaded documents to extract exam structure.
 * Returns structured JSON analysis.
 */
export async function analyzeDocuments(
  extractedTexts: string[],
  docTypes: string[]
): Promise<ExamAnalysis> {
  const prompt = buildAnalysisPrompt(extractedTexts, docTypes);

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  // Parse JSON from response (handle possible markdown wrapping)
  const jsonStr = extractJson(text);
  return JSON.parse(jsonStr) as ExamAnalysis;
}

/**
 * Generate exam blueprint from analysis.
 */
export async function generateBlueprint(analysis: ExamAnalysis): Promise<any> {
  const prompt = buildBlueprintPrompt(JSON.stringify(analysis, null, 2));

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  const jsonStr = extractJson(text);
  return JSON.parse(jsonStr);
}

/**
 * Stream-generate a question paper set.
 * Yields text chunks as they arrive from Gemini.
 */
export async function* streamGeneratePaper(
  analysis: ExamAnalysis,
  blueprint: any,
  setProfile: SetProfile,
  totalQuestions: number,
  previousQuestions?: string
): AsyncGenerator<string> {
  const prompt = buildPaperPrompt(
    JSON.stringify(analysis, null, 2),
    JSON.stringify(blueprint, null, 2),
    setProfile,
    totalQuestions,
    previousQuestions
  );

  const result = await model.generateContentStream(prompt);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      yield text;
    }
  }
}

/**
 * Generate paper without streaming (for batch operations).
 */
export async function generatePaper(
  analysis: ExamAnalysis,
  blueprint: any,
  setProfile: SetProfile,
  totalQuestions: number,
  previousQuestions?: string
): Promise<string> {
  const prompt = buildPaperPrompt(
    JSON.stringify(analysis, null, 2),
    JSON.stringify(blueprint, null, 2),
    setProfile,
    totalQuestions,
    previousQuestions
  );

  const result = await model.generateContent(prompt);
  return result.response.text();
}

/**
 * Generate explanations for a set of questions.
 */
export async function generateExplanations(questionsJson: string): Promise<any[]> {
  const prompt = buildExplanationPrompt(questionsJson);

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  const jsonStr = extractJson(text);
  return JSON.parse(jsonStr);
}

/**
 * Generate trap analysis for a paper.
 */
export async function generateTrapAnalysis(questionsJson: string): Promise<any> {
  const prompt = buildTrapAnalysisPrompt(questionsJson);

  const result = await model.generateContent(prompt);
  const text = result.response.text();

  const jsonStr = extractJson(text);
  return JSON.parse(jsonStr);
}

/**
 * Extract text from an image using Gemini Vision.
 */
export async function extractTextFromImage(
  imageBuffer: Buffer,
  mimeType: string
): Promise<string> {
  const visionModel = genAI.getGenerativeModel({ model: 'gemini-2.5-flash' });

  const imagePart = {
    inlineData: {
      data: imageBuffer.toString('base64'),
      mimeType: mimeType,
    },
  };

  const result = await visionModel.generateContent([
    'Extract ALL text from this image. Preserve the structure, formatting, tables, and layout as closely as possible. Return only the extracted text, nothing else.',
    imagePart,
  ]);

  return result.response.text();
}

/**
 * Stream-analyze documents (for SSE endpoint).
 */
export async function* streamAnalyzeDocuments(
  extractedTexts: string[],
  docTypes: string[]
): AsyncGenerator<string> {
  const prompt = buildAnalysisPrompt(extractedTexts, docTypes);

  const result = await model.generateContentStream(prompt);

  for await (const chunk of result.stream) {
    const text = chunk.text();
    if (text) {
      yield text;
    }
  }
}

/**
 * Extract JSON from a string that might be wrapped in markdown code blocks.
 */
function extractJson(text: string): string {
  // Try to extract from ```json ... ``` blocks
  const jsonBlockMatch = text.match(/```(?:json)?\s*\n?([\s\S]*?)\n?```/);
  if (jsonBlockMatch) {
    return jsonBlockMatch[1].trim();
  }

  // Try to find raw JSON (array or object)
  const jsonMatch = text.match(/(\[[\s\S]*\]|\{[\s\S]*\})/);
  if (jsonMatch) {
    return jsonMatch[1].trim();
  }

  return text.trim();
}
