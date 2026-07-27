import { z } from 'zod';

// ============================================
// Enums
// ============================================

export const DifficultyLevel = z.enum(['easy', 'moderate', 'hard', 'very_hard']);
export type DifficultyLevel = z.infer<typeof DifficultyLevel>;

export const QuestionType = z.enum([
  'direct_mcq',
  'conceptual_mcq',
  'statement_based',
  'multiple_statement',
  'assertion_reason',
  'match_following',
  'correct_incorrect',
  'chronological_order',
  'numerical',
  'logical_reasoning',
  'application',
  'government_rule',
  'scenario_based',
  'case_study',
  'exam_trap',
]);
export type QuestionType = z.infer<typeof QuestionType>;

export const SetProfile = z.enum([
  'balanced',
  'moderate_difficult',
  'conceptual',
  'application_analytical',
  'tricky_statement',
  'final_mock',
]);
export type SetProfile = z.infer<typeof SetProfile>;

export const DocType = z.enum(['notification', 'syllabus', 'previous_paper', 'study_material', 'notes', 'other']);
export type DocType = z.infer<typeof DocType>;

// ============================================
// Schemas
// ============================================

export const TopicWeightageSchema = z.object({
  section: z.string(),
  topic: z.string(),
  questions: z.number(),
  marks: z.number(),
  weightage: z.string(),
});
export type TopicWeightage = z.infer<typeof TopicWeightageSchema>;

export const ExamAnalysisSchema = z.object({
  examName: z.string(),
  conductingAuthority: z.string().optional(),
  totalMarks: z.number(),
  totalQuestions: z.number(),
  duration: z.string(),
  negativeMarking: z.string().optional(),
  language: z.string(),
  questionType: z.string(),
  topicWeightage: z.array(TopicWeightageSchema),
  difficultyDistribution: z.object({
    easy: z.number(),
    moderate: z.number(),
    hard: z.number(),
    veryHard: z.number(),
  }),
  importantInstructions: z.array(z.string()).optional(),
  frequentTopics: z.array(z.string()).optional(),
  previousYearTrends: z.array(z.string()).optional(),
});
export type ExamAnalysis = z.infer<typeof ExamAnalysisSchema>;

export const QuestionSchema = z.object({
  id: z.string().uuid().optional(),
  paperId: z.string().uuid().optional(),
  examId: z.string().uuid().optional(),
  questionNumber: z.number(),
  questionText: z.string(),
  optionA: z.string(),
  optionB: z.string(),
  optionC: z.string(),
  optionD: z.string(),
  correctAnswer: z.enum(['A', 'B', 'C', 'D']),
  topic: z.string(),
  subtopic: z.string().optional(),
  difficulty: DifficultyLevel,
  questionType: QuestionType,
  explanation: z.string().optional(),
  memoryTrick: z.string().optional(),
  previousYearRelevance: z.string().optional(),
  createdAt: z.string().optional(),
});
export type Question = z.infer<typeof QuestionSchema>;

export const PaperSchema = z.object({
  id: z.string().uuid().optional(),
  examId: z.string().uuid(),
  setNumber: z.number().min(1).max(6),
  setName: z.string(),
  difficultyProfile: SetProfile,
  content: z.string().optional(),
  questions: z.array(QuestionSchema).optional(),
  answerKey: z.array(z.object({
    questionNumber: z.number(),
    answer: z.enum(['A', 'B', 'C', 'D']),
    topic: z.string(),
    difficulty: DifficultyLevel,
  })).optional(),
  trapAnalysis: z.object({
    topDifficultQuestions: z.array(z.string()),
    commonMistakes: z.array(z.string()),
    importantConcepts: z.array(z.string()),
    revisionPriority: z.array(z.string()),
    expectedCutOffImpact: z.string(),
  }).optional(),
  status: z.enum(['generating', 'complete', 'error']).default('generating'),
  createdAt: z.string().optional(),
});
export type Paper = z.infer<typeof PaperSchema>;

export const ExamSchema = z.object({
  id: z.string().uuid().optional(),
  name: z.string(),
  authority: z.string().optional(),
  totalMarks: z.number().optional(),
  totalQuestions: z.number().optional(),
  duration: z.string().optional(),
  negativeMarking: z.string().optional(),
  language: z.string().optional(),
  analysis: ExamAnalysisSchema.optional(),
  blueprint: z.any().optional(),
  sourceTexts: z.array(z.string()).optional(),
  papers: z.array(PaperSchema).optional(),
  createdAt: z.string().optional(),
});
export type Exam = z.infer<typeof ExamSchema>;

export const UploadSchema = z.object({
  id: z.string().uuid().optional(),
  examId: z.string().uuid().optional(),
  filename: z.string(),
  fileType: z.string(),
  fileSize: z.number(),
  extractedText: z.string().optional(),
  docType: DocType,
  createdAt: z.string().optional(),
});
export type Upload = z.infer<typeof UploadSchema>;

// ============================================
// API Request/Response Types
// ============================================

export const UploadRequestSchema = z.object({
  docType: DocType.default('other'),
});

export const AnalyzeRequestSchema = z.object({
  extractedTexts: z.array(z.string()),
  docTypes: z.array(DocType),
  examName: z.string().optional(),
});

export const GenerateRequestSchema = z.object({
  examId: z.string().uuid(),
  setNumber: z.number().min(1).max(6),
  analysis: ExamAnalysisSchema,
  blueprint: z.any().optional(),
});

export interface ApiResponse<T> {
  success: boolean;
  data?: T;
  error?: string;
}

export interface SSEEvent {
  type: 'chunk' | 'analysis' | 'complete' | 'error';
  data: string;
}

// Set profile descriptions
export const SET_PROFILES: Record<number, { name: string; profile: SetProfile; description: string }> = {
  1: { name: 'SET 1 — Balanced Coverage', profile: 'balanced', description: 'Covers all topics evenly with standard difficulty distribution' },
  2: { name: 'SET 2 — Moderate to Difficult', profile: 'moderate_difficult', description: 'Heavier on moderate and hard questions' },
  3: { name: 'SET 3 — Conceptual', profile: 'conceptual', description: 'Tests deep understanding of concepts' },
  4: { name: 'SET 4 — Application & Analytical', profile: 'application_analytical', description: 'Scenario-based and application questions' },
  5: { name: 'SET 5 — Tricky Statement-Based', profile: 'tricky_statement', description: 'Statement, assertion-reason, and exam trap questions' },
  6: { name: 'SET 6 — Complete Final Mock', profile: 'final_mock', description: 'Full realistic mock exam simulation' },
};
