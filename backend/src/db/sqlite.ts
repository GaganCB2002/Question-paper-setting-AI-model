import Database from 'better-sqlite3';
import { v4 as uuidv4 } from 'uuid';
import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

let db: Database.Database;

export function initSQLite(dbPath?: string): Database.Database {
  const resolvedPath = dbPath || path.join(__dirname, '..', '..', 'data', 'kke.sqlite');

  // Ensure directory exists
  const dir = path.dirname(resolvedPath);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }

  db = new Database(resolvedPath);
  db.pragma('journal_mode = WAL');
  db.pragma('foreign_keys = ON');

  createTables();
  return db;
}

function createTables() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS exams (
      id TEXT PRIMARY KEY,
      name TEXT NOT NULL,
      authority TEXT,
      total_marks INTEGER,
      total_questions INTEGER,
      duration TEXT,
      negative_marking TEXT,
      language TEXT,
      analysis TEXT,
      blueprint TEXT,
      source_texts TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS papers (
      id TEXT PRIMARY KEY,
      exam_id TEXT REFERENCES exams(id) ON DELETE CASCADE,
      set_number INTEGER NOT NULL,
      set_name TEXT,
      difficulty_profile TEXT,
      content TEXT,
      answer_key TEXT,
      trap_analysis TEXT,
      status TEXT DEFAULT 'generating',
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS questions (
      id TEXT PRIMARY KEY,
      paper_id TEXT REFERENCES papers(id) ON DELETE CASCADE,
      exam_id TEXT REFERENCES exams(id) ON DELETE CASCADE,
      question_number INTEGER,
      question_text TEXT NOT NULL,
      option_a TEXT,
      option_b TEXT,
      option_c TEXT,
      option_d TEXT,
      correct_answer TEXT,
      topic TEXT,
      subtopic TEXT,
      difficulty TEXT,
      question_type TEXT,
      explanation TEXT,
      memory_trick TEXT,
      previous_year_relevance TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE TABLE IF NOT EXISTS uploads (
      id TEXT PRIMARY KEY,
      exam_id TEXT REFERENCES exams(id) ON DELETE CASCADE,
      filename TEXT NOT NULL,
      file_type TEXT,
      file_size INTEGER,
      extracted_text TEXT,
      doc_type TEXT,
      created_at TEXT DEFAULT (datetime('now'))
    );

    CREATE INDEX IF NOT EXISTS idx_papers_exam_id ON papers(exam_id);
    CREATE INDEX IF NOT EXISTS idx_questions_paper_id ON questions(paper_id);
    CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON questions(exam_id);
    CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);
    CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
  `);
}

export function getSQLite(): Database.Database {
  if (!db) throw new Error('SQLite not initialized');
  return db;
}

// ============================================
// Exams
// ============================================

export function createExamSQLite(exam: any) {
  const id = uuidv4();
  const stmt = db.prepare(`
    INSERT INTO exams (id, name, authority, total_marks, total_questions, duration, negative_marking, language, analysis, blueprint, source_texts)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);
  stmt.run(
    id, exam.name, exam.authority, exam.totalMarks, exam.totalQuestions,
    exam.duration, exam.negativeMarking, exam.language,
    JSON.stringify(exam.analysis), JSON.stringify(exam.blueprint),
    JSON.stringify(exam.sourceTexts)
  );
  return { id, ...exam, createdAt: new Date().toISOString() };
}

export function getExamSQLite(id: string) {
  const row: any = db.prepare('SELECT * FROM exams WHERE id = ?').get(id);
  return row ? mapSQLiteExam(row) : null;
}

export function listExamsSQLite() {
  const rows: any[] = db.prepare('SELECT * FROM exams ORDER BY created_at DESC').all();
  return rows.map(mapSQLiteExam);
}

export function updateExamSQLite(id: string, updates: any) {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.name !== undefined) { fields.push('name = ?'); values.push(updates.name); }
  if (updates.authority !== undefined) { fields.push('authority = ?'); values.push(updates.authority); }
  if (updates.totalMarks !== undefined) { fields.push('total_marks = ?'); values.push(updates.totalMarks); }
  if (updates.totalQuestions !== undefined) { fields.push('total_questions = ?'); values.push(updates.totalQuestions); }
  if (updates.duration !== undefined) { fields.push('duration = ?'); values.push(updates.duration); }
  if (updates.negativeMarking !== undefined) { fields.push('negative_marking = ?'); values.push(updates.negativeMarking); }
  if (updates.language !== undefined) { fields.push('language = ?'); values.push(updates.language); }
  if (updates.analysis !== undefined) { fields.push('analysis = ?'); values.push(JSON.stringify(updates.analysis)); }
  if (updates.blueprint !== undefined) { fields.push('blueprint = ?'); values.push(JSON.stringify(updates.blueprint)); }
  if (updates.sourceTexts !== undefined) { fields.push('source_texts = ?'); values.push(JSON.stringify(updates.sourceTexts)); }

  if (fields.length === 0) return getExamSQLite(id);

  values.push(id);
  db.prepare(`UPDATE exams SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getExamSQLite(id);
}

export function deleteExamSQLite(id: string) {
  db.prepare('DELETE FROM exams WHERE id = ?').run(id);
}

// ============================================
// Papers
// ============================================

export function createPaperSQLite(paper: any) {
  const id = uuidv4();
  db.prepare(`
    INSERT INTO papers (id, exam_id, set_number, set_name, difficulty_profile, content, answer_key, trap_analysis, status)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    id, paper.examId, paper.setNumber, paper.setName, paper.difficultyProfile,
    paper.content, JSON.stringify(paper.answerKey), JSON.stringify(paper.trapAnalysis),
    paper.status || 'generating'
  );
  return { id, ...paper, createdAt: new Date().toISOString() };
}

export function getPaperSQLite(id: string) {
  const row: any = db.prepare('SELECT * FROM papers WHERE id = ?').get(id);
  return row ? mapSQLitePaper(row) : null;
}

export function listPapersSQLite(examId?: string) {
  if (examId) {
    const rows: any[] = db.prepare('SELECT * FROM papers WHERE exam_id = ? ORDER BY set_number').all(examId);
    return rows.map(mapSQLitePaper);
  }
  const rows: any[] = db.prepare('SELECT * FROM papers ORDER BY created_at DESC').all();
  return rows.map(mapSQLitePaper);
}

export function updatePaperSQLite(id: string, updates: any) {
  const fields: string[] = [];
  const values: any[] = [];

  if (updates.content !== undefined) { fields.push('content = ?'); values.push(updates.content); }
  if (updates.answerKey !== undefined) { fields.push('answer_key = ?'); values.push(JSON.stringify(updates.answerKey)); }
  if (updates.trapAnalysis !== undefined) { fields.push('trap_analysis = ?'); values.push(JSON.stringify(updates.trapAnalysis)); }
  if (updates.status !== undefined) { fields.push('status = ?'); values.push(updates.status); }

  if (fields.length === 0) return getPaperSQLite(id);

  values.push(id);
  db.prepare(`UPDATE papers SET ${fields.join(', ')} WHERE id = ?`).run(...values);
  return getPaperSQLite(id);
}

export function deletePaperSQLite(id: string) {
  db.prepare('DELETE FROM papers WHERE id = ?').run(id);
}

// ============================================
// Questions
// ============================================

export function createQuestionsSQLite(questions: any[]) {
  const stmt = db.prepare(`
    INSERT INTO questions (id, paper_id, exam_id, question_number, question_text, option_a, option_b, option_c, option_d, correct_answer, topic, subtopic, difficulty, question_type, explanation, memory_trick, previous_year_relevance)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `);

  const insertMany = db.transaction((qs: any[]) => {
    for (const q of qs) {
      stmt.run(
        uuidv4(), q.paperId, q.examId, q.questionNumber, q.questionText,
        q.optionA, q.optionB, q.optionC, q.optionD, q.correctAnswer,
        q.topic, q.subtopic, q.difficulty, q.questionType,
        q.explanation, q.memoryTrick, q.previousYearRelevance
      );
    }
  });

  insertMany(questions);
  return questions;
}

export function getQuestionsByPaperSQLite(paperId: string) {
  const rows: any[] = db.prepare(
    'SELECT * FROM questions WHERE paper_id = ? ORDER BY question_number'
  ).all(paperId);
  return rows.map(mapSQLiteQuestion);
}

export function getQuestionsByExamSQLite(examId: string) {
  const rows: any[] = db.prepare(
    'SELECT * FROM questions WHERE exam_id = ? ORDER BY question_number'
  ).all(examId);
  return rows.map(mapSQLiteQuestion);
}

export function searchQuestionsSQLite(filters: any) {
  let where = '1=1';
  const params: any[] = [];

  if (filters.examId) { where += ' AND exam_id = ?'; params.push(filters.examId); }
  if (filters.topic) { where += ' AND topic = ?'; params.push(filters.topic); }
  if (filters.difficulty) { where += ' AND difficulty = ?'; params.push(filters.difficulty); }
  if (filters.questionType) { where += ' AND question_type = ?'; params.push(filters.questionType); }

  const limit = filters.limit || 50;
  const offset = filters.offset || 0;

  const countRow: any = db.prepare(`SELECT COUNT(*) as total FROM questions WHERE ${where}`).get(...params);
  const rows: any[] = db.prepare(
    `SELECT * FROM questions WHERE ${where} ORDER BY created_at DESC LIMIT ? OFFSET ?`
  ).all(...params, limit, offset);

  return { questions: rows.map(mapSQLiteQuestion), total: countRow.total };
}

export function getTopicStatsSQLite(examId?: string) {
  let where = '1=1';
  const params: any[] = [];
  if (examId) { where += ' AND exam_id = ?'; params.push(examId); }

  const rows: any[] = db.prepare(
    `SELECT topic, difficulty, COUNT(*) as cnt FROM questions WHERE ${where} GROUP BY topic, difficulty`
  ).all(...params);

  const topicMap = new Map<string, any>();
  for (const row of rows) {
    const stats = topicMap.get(row.topic) || { topic: row.topic, total: 0, easy: 0, moderate: 0, hard: 0, veryHard: 0 };
    stats.total += row.cnt;
    if (row.difficulty === 'easy') stats.easy += row.cnt;
    else if (row.difficulty === 'moderate') stats.moderate += row.cnt;
    else if (row.difficulty === 'hard') stats.hard += row.cnt;
    else if (row.difficulty === 'very_hard') stats.veryHard += row.cnt;
    topicMap.set(row.topic, stats);
  }

  return Array.from(topicMap.values());
}

export function updateQuestionsSQLite(paperId: string, explanations: any[]) {
  const stmt = db.prepare(`
    UPDATE questions SET explanation = ?, memory_trick = ?, previous_year_relevance = ?
    WHERE paper_id = ? AND question_number = ?
  `);
  for (const exp of explanations) {
    stmt.run(exp.explanation, exp.memoryTrick, exp.previousYearRelevance, paperId, exp.questionNumber);
  }
}

// ============================================
// Uploads
// ============================================

export function createUploadSQLite(upload: any) {
  const id = uuidv4();
  db.prepare(`
    INSERT INTO uploads (id, exam_id, filename, file_type, file_size, extracted_text, doc_type)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `).run(id, upload.examId, upload.filename, upload.fileType, upload.fileSize, upload.extractedText, upload.docType);
  return { id, ...upload, createdAt: new Date().toISOString() };
}

// ============================================
// Mappers
// ============================================

function mapSQLiteExam(row: any) {
  return {
    id: row.id,
    name: row.name,
    authority: row.authority,
    totalMarks: row.total_marks,
    totalQuestions: row.total_questions,
    duration: row.duration,
    negativeMarking: row.negative_marking,
    language: row.language,
    analysis: safeParse(row.analysis),
    blueprint: safeParse(row.blueprint),
    sourceTexts: safeParse(row.source_texts),
    createdAt: row.created_at,
  };
}

function mapSQLitePaper(row: any) {
  return {
    id: row.id,
    examId: row.exam_id,
    setNumber: row.set_number,
    setName: row.set_name,
    difficultyProfile: row.difficulty_profile,
    content: row.content,
    answerKey: safeParse(row.answer_key),
    trapAnalysis: safeParse(row.trap_analysis),
    status: row.status,
    createdAt: row.created_at,
  };
}

function mapSQLiteQuestion(row: any) {
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

function safeParse(str: string | null | undefined) {
  if (!str) return null;
  try { return JSON.parse(str); } catch { return str; }
}
