@echo off
title KKE Question Paper Generator

set ROOT_DIR=%CD%

echo.
echo ==============================================
echo   KKE Question Paper Generator
echo   AI-Powered Exam Generator for Karnataka Exams
echo ==============================================
echo.

:: Check environment
if "%SUPABASE_DB_URL%"=="" (
    set USE_SQLITE=1
    echo [INFO] Database: SQLite - local
) else (
    echo [INFO] Database: Supabase PostgreSQL
)

if "%GEMINI_API_KEY%"=="" (
    echo [WARN] GEMINI_API_KEY not set. AI features will use mock responses.
)

:: Step 1: Dependencies
echo.
echo [1/4] Checking dependencies...

python --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Python not found. Install Python 3.11+
    pause
    exit /b 1
)
echo   Python OK

node --version >nul 2>&1
if errorlevel 1 (
    echo ERROR: Node.js not found. Install Node.js 18+
    pause
    exit /b 1
)
echo   Node.js OK

echo   Installing Python packages...
pip install -r "%ROOT_DIR%\backend\requirements.txt" -q

if not exist "%ROOT_DIR%\frontend\node_modules" (
    echo   Installing Node packages...
    pushd "%ROOT_DIR%\frontend"
    call npm install --silent
    popd
) else (
    echo   Node modules already installed
)

:: Step 2: Database
echo.
echo [2/4] Setting up database...
set PYTHONPATH=%ROOT_DIR%\backend
python -c "import asyncio, sys; sys.path.insert(0, r'%ROOT_DIR%\backend'); from scripts.init_db import main; asyncio.run(main())"
echo   Database ready

:: Step 3: Start Backend
echo.
echo [3/4] Starting Backend (port 8000)...

start "KKE-Backend" cmd /c "title KKE-Backend && cd /d %ROOT_DIR%\backend && set PYTHONPATH=%ROOT_DIR%\backend && set USE_SQLITE=1 && uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload"
echo   Waiting for backend to start...
timeout /t 5 /nobreak >nul

:: Step 4: Start Frontend
echo [4/4] Starting Frontend (port 5173)...

start "KKE-Frontend" cmd /c "title KKE-Frontend && cd /d %ROOT_DIR%\frontend && npm run dev"
timeout /t 3 /nobreak >nul

:: Ready
echo.
echo ==============================================
echo   READY
echo.
echo   Frontend:  http://localhost:5173
echo   Backend:   http://localhost:8000
echo   API Docs:  http://localhost:8000/docs
echo.
echo   Test Credentials:
echo     Username: testuser / Password: Test@123
echo     Email: test@kke.com
echo.
echo   Close the windows to stop all services
echo ==============================================
echo.
echo Backend:  http://localhost:8000
echo Frontend: http://localhost:5173
echo API Docs: http://localhost:8000/docs
echo.

:: Open browser
echo Opening browser...
start http://localhost:5173

:: Wait for key to stop
echo.
echo Press any key to stop all services...
pause >nul

echo.
echo Stopping all services...
taskkill /f /fi "windowtitle eq KKE-Backend" >nul 2>&1
taskkill /f /fi "windowtitle eq KKE-Frontend" >nul 2>&1
echo All services stopped. Goodbye!
timeout /t 2 /nobreak >nul