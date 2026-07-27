/**
 * Unified Database Layer
 * Switches between Supabase and SQLite based on STORAGE_MODE env var.
 */

import * as supabaseDb from '../services/supabase.js';
import * as sqliteDb from './sqlite.js';

const mode = process.env.STORAGE_MODE || 'sqlite';

function isSupabase() {
  return mode === 'supabase';
}

// ============================================
// Exams
// ============================================

export async function createExam(exam: any) {
  if (isSupabase()) return supabaseDb.createExam(exam);
  return sqliteDb.createExamSQLite(exam);
}

export async function getExam(id: string) {
  if (isSupabase()) return supabaseDb.getExam(id);
  return sqliteDb.getExamSQLite(id);
}

export async function listExams() {
  if (isSupabase()) return supabaseDb.listExams();
  return sqliteDb.listExamsSQLite();
}

export async function updateExam(id: string, updates: any) {
  if (isSupabase()) return supabaseDb.updateExam(id, updates);
  return sqliteDb.updateExamSQLite(id, updates);
}

export async function deleteExam(id: string) {
  if (isSupabase()) return supabaseDb.deleteExam(id);
  return sqliteDb.deleteExamSQLite(id);
}

// ============================================
// Papers
// ============================================

export async function createPaper(paper: any) {
  if (isSupabase()) return supabaseDb.createPaper(paper);
  return sqliteDb.createPaperSQLite(paper);
}

export async function getPaper(id: string) {
  if (isSupabase()) return supabaseDb.getPaper(id);
  return sqliteDb.getPaperSQLite(id);
}

export async function listPapers(examId?: string) {
  if (isSupabase()) return supabaseDb.listPapers(examId);
  return sqliteDb.listPapersSQLite(examId);
}

export async function updatePaper(id: string, updates: any) {
  if (isSupabase()) return supabaseDb.updatePaper(id, updates);
  return sqliteDb.updatePaperSQLite(id, updates);
}

export async function deletePaper(id: string) {
  if (isSupabase()) return supabaseDb.deletePaper(id);
  return sqliteDb.deletePaperSQLite(id);
}

// ============================================
// Questions
// ============================================

export async function createQuestions(questions: any[]) {
  if (isSupabase()) return supabaseDb.createQuestions(questions);
  return sqliteDb.createQuestionsSQLite(questions);
}

export async function getQuestionsByPaper(paperId: string) {
  if (isSupabase()) return supabaseDb.getQuestionsByPaper(paperId);
  return sqliteDb.getQuestionsByPaperSQLite(paperId);
}

export async function getQuestionsByExam(examId: string) {
  if (isSupabase()) return supabaseDb.getQuestionsByExam(examId);
  return sqliteDb.getQuestionsByExamSQLite(examId);
}

export async function searchQuestions(filters: any) {
  if (isSupabase()) return supabaseDb.searchQuestions(filters);
  return sqliteDb.searchQuestionsSQLite(filters);
}

export async function getTopicStats(examId?: string) {
  if (isSupabase()) return supabaseDb.getTopicStats(examId);
  return sqliteDb.getTopicStatsSQLite(examId);
}

export async function updateQuestions(paperId: string, explanations: any[]) {
  if (isSupabase()) return supabaseDb.updateQuestions(paperId, explanations);
  return sqliteDb.updateQuestionsSQLite(paperId, explanations);
}

// ============================================
// Uploads
// ============================================

export async function createUpload(upload: any) {
  if (isSupabase()) return supabaseDb.createUpload(upload);
  return sqliteDb.createUploadSQLite(upload);
}
