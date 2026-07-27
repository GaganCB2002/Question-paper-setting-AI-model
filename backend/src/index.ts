import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import { errorHandler } from './middleware/errorHandler.js';
import { initGemini } from './services/gemini.js';
import { initSupabase } from './services/supabase.js';

// Routes
import uploadRouter from './routes/upload.js';
import analyzeRouter from './routes/analyze.js';
import generateRouter from './routes/generate.js';
import papersRouter from './routes/papers.js';
import questionsRouter from './routes/questions.js';
import examsRouter from './routes/exams.js';

const app = express();
const PORT = parseInt(process.env.PORT || '3001');

// ============================================
// Middleware
// ============================================
app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
app.use(cors({ origin: ['http://localhost:5173', 'http://localhost:3000'], credentials: true }));
app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// ============================================
// Initialize Services
// ============================================

// Gemini
const geminiKey = process.env.GEMINI_API_KEY;
if (!geminiKey || geminiKey === 'your_gemini_api_key_here') {
  console.warn('⚠️  GEMINI_API_KEY not set. AI features will not work.');
} else {
  initGemini(geminiKey);
  console.log('✅ Gemini AI initialized');
}

// Database
const storageMode = process.env.STORAGE_MODE || 'sqlite';
if (storageMode === 'supabase') {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseKey = process.env.SUPABASE_KEY;
  if (supabaseUrl && supabaseKey && supabaseUrl !== 'your_supabase_project_url_here') {
    initSupabase(supabaseUrl, supabaseKey);
    console.log('✅ Supabase connected');
  } else {
    console.warn('⚠️  Supabase credentials not set. Falling back to SQLite.');
    process.env.STORAGE_MODE = 'sqlite';
    initSQLiteDB();
  }
} else {
  initSQLiteDB();
}

async function initSQLiteDB() {
  try {
    const { initSQLite } = await import('./db/sqlite.js');
    initSQLite();
    console.log('✅ SQLite database initialized');
  } catch (err) {
    console.error('❌ Failed to initialize SQLite:', err);
  }
}

// ============================================
// Routes
// ============================================
app.use('/api/upload', uploadRouter);
app.use('/api/analyze', analyzeRouter);
app.use('/api/generate', generateRouter);
app.use('/api/papers', papersRouter);
app.use('/api/questions', questionsRouter);
app.use('/api/exams', examsRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    success: true,
    data: {
      status: 'healthy',
      storageMode,
      geminiConfigured: !!geminiKey && geminiKey !== 'your_gemini_api_key_here',
      timestamp: new Date().toISOString(),
    },
  });
});

// Error handler (must be last)
app.use(errorHandler);

// ============================================
// Start Server
// ============================================
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════════════════╗
║   KKE Question Paper Generator — API Server      ║
║   Running on http://localhost:${PORT}               ║
║   Storage: ${storageMode.padEnd(38)}║
╚══════════════════════════════════════════════════╝
  `);
});

export default app;
