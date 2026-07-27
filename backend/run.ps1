$env:USE_SQLITE = "1"
$env:GEMINI_API_KEY = if ($env:GEMINI_API_KEY) { $env:GEMINI_API_KEY } else { "" }
$env:PYTHONPATH = Split-Path -Parent $MyInvocation.MyCommand.Path

Write-Host "[1/2] Initializing database..." -ForegroundColor Green
python -c "import asyncio; from scripts.init_db import main; asyncio.run(main())" 2>$null

Write-Host "[2/2] Starting server..." -ForegroundColor Green
uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
