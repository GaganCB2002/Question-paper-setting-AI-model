#!/usr/bin/env bash
set -e

echo "=============================================="
echo "  KKE Question Paper Generator"
echo "  AI-Powered Exam Generator for Karnataka Exams"
echo "=============================================="
echo ""

ROOT="$(cd "$(dirname "$0")" && pwd)"
BACKEND="$ROOT/backend"
FRONTEND="$ROOT/frontend"

# ─── Environment ───────────────────────────────────────────────────
if [ -z "$SUPABASE_DB_URL" ]; then
    export USE_SQLITE=1
    echo "[INFO] Database: SQLite (local)"
else
    echo "[INFO] Database: Supabase PostgreSQL"
fi

if [ -z "$GEMINI_API_KEY" ]; then
    echo "[WARN] GEMINI_API_KEY not set. AI features will use mock responses."
    echo "       Set it: export GEMINI_API_KEY='your-key'"
fi

# ─── Step 1: Dependencies ──────────────────────────────────────────
echo ""
echo "[1/4] Checking dependencies..."

if ! command -v python3 &>/dev/null && ! command -v python &>/dev/null; then
    echo "ERROR: Python not found. Install Python 3.11+"
    exit 1
fi
PYTHON=$(command -v python3 || command -v python)
echo "  Python: $($PYTHON --version)"

if ! command -v node &>/dev/null; then
    echo "ERROR: Node.js not found. Install Node.js 18+"
    exit 1
fi
echo "  Node.js: $(node --version)"

echo "  Installing Python packages..."
$PYTHON -m pip install -r "$BACKEND/requirements.txt" -q 2>/dev/null

if [ ! -d "$FRONTEND/node_modules" ]; then
    echo "  Installing Node packages..."
    cd "$FRONTEND"
    npm install --silent 2>/dev/null
    cd "$ROOT"
else
    echo "  Node modules already installed"
fi

# ─── Step 2: Database ──────────────────────────────────────────────
echo ""
echo "[2/4] Setting up database..."
export PYTHONPATH="$BACKEND"
$PYTHON -c "
import asyncio, sys
sys.path.insert(0, '$BACKEND')
from scripts.init_db import main
asyncio.run(main())
" 2>/dev/null || echo "  (DB may already exist - continuing)"
echo "  Database ready"

# ─── Step 3: Start Backend ─────────────────────────────────────────
echo ""
echo "[3/4] Starting Backend (port 8000)..."
cd "$BACKEND"
export PYTHONPATH="$BACKEND"
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload &
BACKEND_PID=$!
cd "$ROOT"
sleep 4

# ─── Step 4: Start Frontend ────────────────────────────────────────
echo "[4/4] Starting Frontend (port 5173)..."
cd "$FRONTEND"
npm run dev &
FRONTEND_PID=$!
cd "$ROOT"
sleep 3

# ─── Ready ─────────────────────────────────────────────────────────
echo ""
echo "=============================================="
echo "  READY"
echo ""
echo "  Frontend:  http://localhost:5173"
echo "  Backend:   http://localhost:8000"
echo "  API Docs:  http://localhost:8000/docs"
echo ""
echo "  Test Credentials:"
echo "    Username: testuser / Password: Test@123"
echo "    Email: test@kke.com"
echo ""
echo "  Press Ctrl+C to stop all services"
echo "=============================================="
echo ""

cleanup() {
    echo ""
    echo "[INFO] Stopping all services..."
    kill $BACKEND_PID $FRONTEND_PID 2>/dev/null
    wait $BACKEND_PID $FRONTEND_PID 2>/dev/null
    echo "[INFO] All services stopped. Goodbye!"
    exit 0
}

trap cleanup SIGINT SIGTERM

wait
