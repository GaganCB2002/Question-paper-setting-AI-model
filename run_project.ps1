<#
.SYNOPSIS
    KKE Question Paper Generator — One-Click Project Runner
.DESCRIPTION
    Starts Backend (FastAPI on :8000) + Frontend (Vite on :5173) + Database
.PARAMETER SupabaseDbUrl
    Optional: Supabase PostgreSQL connection string
.PARAMETER GeminiApiKey
    Optional: Google Gemini API key for AI features
.EXAMPLE
    .\run_project.ps1
    .\run_project.ps1 -GeminiApiKey "your-key"
    $env:SUPABASE_DB_URL="postgresql://..." .\run_project.ps1
#>

param(
    [string]$GeminiApiKey = "",
    [string]$SupabaseDbUrl = ""
)

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       KKE Question Paper Generator                  ║" -ForegroundColor Cyan
Write-Host "║   AI-Powered Exam Generator for Karnataka Exams     ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

# ─── Environment ───────────────────────────────────────────────────
if ($GeminiApiKey) { $env:GEMINI_API_KEY = $GeminiApiKey }
if ($SupabaseDbUrl) { $env:SUPABASE_DB_URL = $SupabaseDbUrl }

if (-not $env:GEMINI_API_KEY) {
    Write-Host "[WARN] GEMINI_API_KEY not set. AI features will use mock responses." -ForegroundColor Yellow
}
if ($env:SUPABASE_DB_URL) {
    Write-Host "[INFO] Database: Supabase PostgreSQL" -ForegroundColor Green
} else {
    $env:USE_SQLITE = "1"
    Write-Host "[INFO] Database: SQLite (local)" -ForegroundColor Green
}

$BackendDir = Join-Path $Root "backend"
$FrontendDir = Join-Path $Root "frontend"

# ─── Step 1: Dependencies ──────────────────────────────────────────
Write-Host ""
Write-Host "[1/4] Checking dependencies..." -ForegroundColor Yellow

try {
    $pyVer = python --version 2>&1
    Write-Host "  Python: $pyVer" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Python not found. Install Python 3.11+" -ForegroundColor Red
    exit 1
}

try {
    $nodeVer = node --version 2>&1
    Write-Host "  Node.js: $nodeVer" -ForegroundColor Green
} catch {
    Write-Host "  ERROR: Node.js not found. Install Node.js 18+" -ForegroundColor Red
    exit 1
}

Write-Host "  Installing Python packages..." -ForegroundColor Gray
pip install -r (Join-Path $BackendDir "requirements.txt") -q 2>$null

if (-not (Test-Path (Join-Path $FrontendDir "node_modules"))) {
    Write-Host "  Installing Node packages..." -ForegroundColor Gray
    Push-Location $FrontendDir
    npm install --silent 2>$null
    Pop-Location
} else {
    Write-Host "  Node modules already installed" -ForegroundColor Gray
}

# ─── Step 2: Database ──────────────────────────────────────────────
Write-Host ""
Write-Host "[2/4] Setting up database..." -ForegroundColor Yellow
$env:PYTHONPATH = $BackendDir
$initResult = python -c @"
import asyncio, sys
sys.path.insert(0, r'$BackendDir')
from scripts.init_db import main
asyncio.run(main())
"@ 2>&1

if ($LASTEXITCODE -ne 0 -and $initResult -notmatch "already exists") {
    Write-Host "  WARNING: DB init issue (may already exist)" -ForegroundColor Yellow
}
$initResult | ForEach-Object { Write-Host "  $_" -ForegroundColor Gray }
Write-Host "  Database ready" -ForegroundColor Green

# ─── Step 3: Start Backend ─────────────────────────────────────────
Write-Host ""
Write-Host "[3/4] Starting Backend (port 8000)..." -ForegroundColor Yellow
$backendJob = Start-Job -ScriptBlock {
    param($dir, $useSqlite, $supabaseUrl, $geminiKey)
    $env:PYTHONPATH = $dir
    if ($useSqlite) { $env:USE_SQLITE = "1" }
    if ($supabaseUrl) { $env:SUPABASE_DB_URL = $supabaseUrl }
    if ($geminiKey) { $env:GEMINI_API_KEY = $geminiKey }
    Set-Location -LiteralPath $dir
    uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
} -ArgumentList $BackendDir, $env:USE_SQLITE, $env:SUPABASE_DB_URL, $env:GEMINI_API_KEY

Start-Sleep -Seconds 4

# ─── Step 4: Start Frontend ────────────────────────────────────────
Write-Host "[4/4] Starting Frontend (port 5173)..." -ForegroundColor Yellow
$frontendJob = Start-Job -ScriptBlock {
    param($dir)
    Set-Location -LiteralPath $dir
    npm run dev
} -ArgumentList $FrontendDir

Start-Sleep -Seconds 3

# ─── Ready ─────────────────────────────────────────────────────────
Write-Host ""
Write-Host "╔══════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║                     READY                            ║" -ForegroundColor Cyan
Write-Host "║                                                      ║" -ForegroundColor Cyan
Write-Host "║   Frontend:  http://localhost:5173                    ║" -ForegroundColor Green
Write-Host "║   Backend:   http://localhost:8000                    ║" -ForegroundColor Green
Write-Host "║   API Docs:  http://localhost:8000/docs               ║" -ForegroundColor Green
Write-Host "║                                                      ║" -ForegroundColor Cyan
Write-Host "║   Test Credentials:                                  ║" -ForegroundColor Cyan
Write-Host "║     Username: testuser / Password: Test@123          ║" -ForegroundColor Yellow
Write-Host "║     Email: test@kke.com                              ║" -ForegroundColor Yellow
Write-Host "║                                                      ║" -ForegroundColor Cyan
Write-Host "║   Press Ctrl+C to stop all services                   ║" -ForegroundColor Cyan
Write-Host "╚══════════════════════════════════════════════════════╝" -ForegroundColor Cyan

# ─── Monitor ───────────────────────────────────────────────────────
try {
    while ($true) {
        $bState = (Receive-Job $backendJob -Keep 2>$null) -join "`n"
        if ($bState -match "Uvicorn running on") { break }
        Start-Sleep -Seconds 1
    }
    
    # Show logs in real-time
    while ($true) {
        $bLog = Receive-Job $backendJob -Keep 2>$null
        $fLog = Receive-Job $frontendJob -Keep 2>$null
        if ($bLog) { $bLog | ForEach-Object { Write-Host "[BACKEND] $_" -ForegroundColor Gray } }
        if ($fLog) { $fLog | ForEach-Object { Write-Host "[FRONTEND] $_" -ForegroundColor Gray } }
        
        if ($backendJob.State -ne 'Running') {
            Write-Host "[ERROR] Backend stopped unexpectedly" -ForegroundColor Red
            break
        }
        if ($frontendJob.State -ne 'Running') {
            Write-Host "[ERROR] Frontend stopped unexpectedly" -ForegroundColor Red
            break
        }
        Start-Sleep -Seconds 2
    }
} finally {
    Write-Host "[INFO] Stopping all services..." -ForegroundColor Yellow
    Stop-Job $backendJob -ErrorAction SilentlyContinue
    Stop-Job $frontendJob -ErrorAction SilentlyContinue
    Remove-Job $backendJob -ErrorAction SilentlyContinue
    Remove-Job $frontendJob -ErrorAction SilentlyContinue
    Write-Host "[INFO] All services stopped. Goodbye!" -ForegroundColor Yellow
}
