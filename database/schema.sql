-- ============================================
-- KKE Question Paper Generator — Supabase Schema
-- Run this in your Supabase SQL Editor
-- ============================================

-- Enable UUID generation
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Exams table
CREATE TABLE IF NOT EXISTS exams (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  name TEXT NOT NULL,
  authority TEXT,
  total_marks INTEGER,
  total_questions INTEGER,
  duration TEXT,
  negative_marking TEXT,
  language TEXT,
  analysis JSONB,
  blueprint JSONB,
  source_texts TEXT[],
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Papers table
CREATE TABLE IF NOT EXISTS papers (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  set_number INTEGER NOT NULL,
  set_name TEXT,
  difficulty_profile TEXT,
  content TEXT,
  answer_key JSONB,
  trap_analysis JSONB,
  status TEXT DEFAULT 'generating',
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Questions table (question bank)
CREATE TABLE IF NOT EXISTS questions (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  paper_id UUID REFERENCES papers(id) ON DELETE CASCADE,
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  question_number INTEGER,
  question_text TEXT NOT NULL,
  option_a TEXT,
  option_b TEXT,
  option_c TEXT,
  option_d TEXT,
  correct_answer CHAR(1),
  topic TEXT,
  subtopic TEXT,
  difficulty TEXT,
  question_type TEXT,
  explanation TEXT,
  memory_trick TEXT,
  previous_year_relevance TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Uploads table
CREATE TABLE IF NOT EXISTS uploads (
  id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
  exam_id UUID REFERENCES exams(id) ON DELETE CASCADE,
  filename TEXT NOT NULL,
  file_type TEXT,
  file_size INTEGER,
  extracted_text TEXT,
  doc_type TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_papers_exam_id ON papers(exam_id);
CREATE INDEX IF NOT EXISTS idx_questions_paper_id ON questions(paper_id);
CREATE INDEX IF NOT EXISTS idx_questions_exam_id ON questions(exam_id);
CREATE INDEX IF NOT EXISTS idx_questions_topic ON questions(topic);
CREATE INDEX IF NOT EXISTS idx_questions_difficulty ON questions(difficulty);
CREATE INDEX IF NOT EXISTS idx_questions_type ON questions(question_type);
CREATE INDEX IF NOT EXISTS idx_uploads_exam_id ON uploads(exam_id);

-- Row Level Security (disable for now — enable when adding auth)
ALTER TABLE exams ENABLE ROW LEVEL SECURITY;
ALTER TABLE papers ENABLE ROW LEVEL SECURITY;
ALTER TABLE questions ENABLE ROW LEVEL SECURITY;
ALTER TABLE uploads ENABLE ROW LEVEL SECURITY;

-- Allow all access policies (for development — restrict in production)
CREATE POLICY "Allow all access to exams" ON exams FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to papers" ON papers FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to questions" ON questions FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to uploads" ON uploads FOR ALL USING (true) WITH CHECK (true);
