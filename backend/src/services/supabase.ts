import { createClient, type SupabaseClient } from '@supabase/supabase-js';

let supabase: SupabaseClient | null = null;

export function initSupabase(url: string, key: string): SupabaseClient {
  supabase = createClient(url, key);
  return supabase;
}

export function getSupabase(): SupabaseClient {
  if (!supabase) {
    throw new Error('Supabase client not initialized. Call initSupabase() first.');
  }
  return supabase;
}

// ============================================
// Exams
// ============================================

export async function createExam(exam: {
  name: string;
  authority?: string;
  totalMarks?: number;
  totalQuestions?: number;
  duration?: string;
  negativeMarking?: string;
  language?: string;
  analysis?: any;
  blueprint?: any;
  sourceTexts?: string[];
}) {
  const db = getSupabase();
  const { data, error } = await db
    .from('exams')
    .insert({
      name: exam.name,
      authority: exam.authority,
      total_marks: exam.totalMarks,
      total_questions: exam.totalQuestions,
      duration: exam.duration,
      negative_marking: exam.negativeMarking,
      language: exam.language,
      analysis: exam.analysis,
      blueprint: exam.blueprint,
      source_texts: exam.sourceTexts,
    })
    .select()
    .single();

  if (error) throw error;
  return mapExamRow(data);
}

export async function getExam(id: string) {
  const db = getSupabase();
  const { data, error } = await db
    .from('exams')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return mapExamRow(data);
}

export async function listExams() {
  const db = getSupabase();
  const { data, error } = await db
    .from('exams')
    .select('*')
    .order('created_at', { ascending: false });

  if (error) throw error;
  return (data || []).map(mapExamRow);
}

export async function updateExam(id: string, updates: any) {
  const db = getSupabase();
  const mapped: any = {};
  if (updates.name !== undefined) mapped.name = updates.name;
  if (updates.authority !== undefined) mapped.authority = updates.authority;
  if (updates.totalMarks !== undefined) mapped.total_marks = updates.totalMarks;
  if (updates.totalQuestions !== undefined) mapped.total_questions = updates.totalQuestions;
  if (updates.duration !== undefined) mapped.duration = updates.duration;
  if (updates.negativeMarking !== undefined) mapped.negative_marking = updates.negativeMarking;
  if (updates.language !== undefined) mapped.language = updates.language;
  if (updates.analysis !== undefined) mapped.analysis = updates.analysis;
  if (updates.blueprint !== undefined) mapped.blueprint = updates.blueprint;
  if (updates.sourceTexts !== undefined) mapped.source_texts = updates.sourceTexts;

  const { data, error } = await db
    .from('exams')
    .update(mapped)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return mapExamRow(data);
}

export async function deleteExam(id: string) {
  const db = getSupabase();
  const { error } = await db.from('exams').delete().eq('id', id);
  if (error) throw error;
}

// ============================================
// Papers
// ============================================

export async function createPaper(paper: {
  examId: string;
  setNumber: number;
  setName: string;
  difficultyProfile: string;
  content?: string;
  answerKey?: any;
  trapAnalysis?: any;
  status?: string;
}) {
  const db = getSupabase();
  const { data, error } = await db
    .from('papers')
    .insert({
      exam_id: paper.examId,
      set_number: paper.setNumber,
      set_name: paper.setName,
      difficulty_profile: paper.difficultyProfile,
      content: paper.content,
      answer_key: paper.answerKey,
      trap_analysis: paper.trapAnalysis,
      status: paper.status || 'generating',
    })
    .select()
    .single();

  if (error) throw error;
  return mapPaperRow(data);
}

export async function getPaper(id: string) {
  const db = getSupabase();
  const { data, error } = await db
    .from('papers')
    .select('*')
    .eq('id', id)
    .single();

  if (error) throw error;
  return mapPaperRow(data);
}

export async function listPapers(examId?: string) {
  const db = getSupabase();
  let query = db.from('papers').select('*').order('set_number', { ascending: true });

  if (examId) {
    query = query.eq('exam_id', examId);
  }

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(mapPaperRow);
}

export async function updatePaper(id: string, updates: any) {
  const db = getSupabase();
  const mapped: any = {};
  if (updates.content !== undefined) mapped.content = updates.content;
  if (updates.answerKey !== undefined) mapped.answer_key = updates.answerKey;
  if (updates.trapAnalysis !== undefined) mapped.trap_analysis = updates.trapAnalysis;
  if (updates.status !== undefined) mapped.status = updates.status;

  const { data, error } = await db
    .from('papers')
    .update(mapped)
    .eq('id', id)
    .select()
    .single();

  if (error) throw error;
  return mapPaperRow(data);
}

export async function deletePaper(id: string) {
  const db = getSupabase();
  const { error } = await db.from('papers').delete().eq('id', id);
  if (error) throw error;
}

// ============================================
// Questions
// ============================================

export async function createQuestions(questions: Array<{
  paperId: string;
  examId: string;
  questionNumber: number;
  questionText: string;
  optionA: string;
  optionB: string;
  optionC: string;
  optionD: string;
  correctAnswer: string;
  topic: string;
  subtopic?: string;
  difficulty: string;
  questionType: string;
  explanation?: string;
  memoryTrick?: string;
  previousYearRelevance?: string;
}>) {
  const db = getSupabase();
  const rows = questions.map(q => ({
    paper_id: q.paperId,
    exam_id: q.examId,
    question_number: q.questionNumber,
    question_text: q.questionText,
    option_a: q.optionA,
    option_b: q.optionB,
    option_c: q.optionC,
    option_d: q.optionD,
    correct_answer: q.correctAnswer,
    topic: q.topic,
    subtopic: q.subtopic,
    difficulty: q.difficulty,
    question_type: q.questionType,
    explanation: q.explanation,
    memory_trick: q.memoryTrick,
    previous_year_relevance: q.previousYearRelevance,
  }));

  const { data, error } = await db
    .from('questions')
    .insert(rows)
    .select();

  if (error) throw error;
  return (data || []).map(mapQuestionRow);
}

export async function getQuestionsByPaper(paperId: string) {
  const db = getSupabase();
  const { data, error } = await db
    .from('questions')
    .select('*')
    .eq('paper_id', paperId)
    .order('question_number', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapQuestionRow);
}

export async function getQuestionsByExam(examId: string) {
  const db = getSupabase();
  const { data, error } = await db
    .from('questions')
    .select('*')
    .eq('exam_id', examId)
    .order('question_number', { ascending: true });

  if (error) throw error;
  return (data || []).map(mapQuestionRow);
}

export async function searchQuestions(filters: {
  examId?: string;
  topic?: string;
  difficulty?: string;
  questionType?: string;
  limit?: number;
  offset?: number;
}) {
  const db = getSupabase();
  let query = db.from('questions').select('*', { count: 'exact' });

  if (filters.examId) query = query.eq('exam_id', filters.examId);
  if (filters.topic) query = query.eq('topic', filters.topic);
  if (filters.difficulty) query = query.eq('difficulty', filters.difficulty);
  if (filters.questionType) query = query.eq('question_type', filters.questionType);

  query = query
    .order('created_at', { ascending: false })
    .range(filters.offset || 0, (filters.offset || 0) + (filters.limit || 50) - 1);

  const { data, error, count } = await query;
  if (error) throw error;
  return { questions: (data || []).map(mapQuestionRow), total: count || 0 };
}

export async function getTopicStats(examId?: string) {
  const db = getSupabase();
  let query = db.from('questions').select('topic, difficulty');

  if (examId) query = query.eq('exam_id', examId);

  const { data, error } = await query;
  if (error) throw error;

  // Aggregate by topic
  const topicMap = new Map<string, { total: number; easy: number; moderate: number; hard: number; veryHard: number }>();
  for (const row of data || []) {
    const stats = topicMap.get(row.topic) || { total: 0, easy: 0, moderate: 0, hard: 0, veryHard: 0 };
    stats.total++;
    if (row.difficulty === 'easy') stats.easy++;
    else if (row.difficulty === 'moderate') stats.moderate++;
    else if (row.difficulty === 'hard') stats.hard++;
    else if (row.difficulty === 'very_hard') stats.veryHard++;
    topicMap.set(row.topic, stats);
  }

  return Array.from(topicMap.entries()).map(([topic, stats]) => ({
    topic,
    ...stats,
  }));
}

export async function updateQuestions(paperId: string, explanations: Array<{
  questionNumber: number;
  explanation: string;
  memoryTrick?: string;
  previousYearRelevance?: string;
}>) {
  const db = getSupabase();
  for (const exp of explanations) {
    await db
      .from('questions')
      .update({
        explanation: exp.explanation,
        memory_trick: exp.memoryTrick,
        previous_year_relevance: exp.previousYearRelevance,
      })
      .eq('paper_id', paperId)
      .eq('question_number', exp.questionNumber);
  }
}

// ============================================
// Uploads
// ============================================

export async function createUpload(upload: {
  examId?: string;
  filename: string;
  fileType: string;
  fileSize: number;
  extractedText?: string;
  docType: string;
}) {
  const db = getSupabase();
  const { data, error } = await db
    .from('uploads')
    .insert({
      exam_id: upload.examId,
      filename: upload.filename,
      file_type: upload.fileType,
      file_size: upload.fileSize,
      extracted_text: upload.extractedText,
      doc_type: upload.docType,
    })
    .select()
    .single();

  if (error) throw error;
  return data;
}

// ============================================
// Row Mappers (snake_case → camelCase)
// ============================================

function mapExamRow(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name,
    authority: row.authority,
    totalMarks: row.total_marks,
    totalQuestions: row.total_questions,
    duration: row.duration,
    negativeMarking: row.negative_marking,
    language: row.language,
    analysis: row.analysis,
    blueprint: row.blueprint,
    sourceTexts: row.source_texts,
    createdAt: row.created_at,
  };
}

function mapPaperRow(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    examId: row.exam_id,
    setNumber: row.set_number,
    setName: row.set_name,
    difficultyProfile: row.difficulty_profile,
    content: row.content,
    answerKey: row.answer_key,
    trapAnalysis: row.trap_analysis,
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapQuestionRow(row: any) {
  if (!row) return null;
  return {
    id: row.id,
    paperId: row.paper_id,
    examId: row.exam_id,
    questionNumber: row.question_number,
    questionText: row.question_text,
    optionA: row.option_a,
    optionB: row.option_b,
    optionC: row.option_c,
    optionD: row.option_d,
    correctAnswer: row.correct_answer,
    topic: row.topic,
    subtopic: row.subtopic,
    difficulty: row.difficulty,
    questionType: row.question_type,
    explanation: row.explanation,
    memoryTrick: row.memory_trick,
    previousYearRelevance: row.previous_year_relevance,
    createdAt: row.created_at,
  };
}
