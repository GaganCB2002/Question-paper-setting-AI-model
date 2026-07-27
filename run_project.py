"""
KKE Question Paper Generator — One-Click Project Runner
Starts: Backend (FastAPI) + Frontend (Vite) + Database (SQLite / Supabase)
"""

import os, sys, subprocess, time, signal, json, threading, webbrowser
from pathlib import Path

ROOT = Path(__file__).parent
BACKEND = ROOT / "backend"
FRONTEND = ROOT / "frontend"
os.chdir(ROOT)


def print_banner():
    print("""
==============================================
  KKE Question Paper Generator
  AI-Powered Exam Generator for Karnataka Exams
==============================================
""")


def run_command(cmd, cwd=None, shell=True, capture=False):
    return subprocess.run(cmd, cwd=cwd or ROOT, shell=shell,
                          capture_output=capture, text=True)


def check_dependencies():
    print("[1/4] Checking dependencies...")
    # Python
    py_result = run_command("python --version", capture=True)
    if py_result.returncode != 0:
        print("  ERROR: Python not found. Please install Python 3.11+")
        return False
    print(f"  Python: {py_result.stdout.strip()}")

    # Node
    node_result = run_command("node --version", capture=True)
    if node_result.returncode != 0:
        print("  ERROR: Node.js not found. Please install Node.js 18+")
        return False
    print(f"  Node.js: {node_result.stdout.strip()}")

    # Install Python dependencies
    print("  Installing Python dependencies...")
    req_file = BACKEND / "requirements.txt"
    result = run_command(f"pip install -r {req_file} -q", cwd=BACKEND)
    if result.returncode != 0:
        print("  WARNING: Some Python packages may not have installed correctly")

    # Install Node dependencies
    if not (FRONTEND / "node_modules").exists():
        print("  Installing Node.js dependencies...")
        result = run_command("npm install --silent", cwd=FRONTEND)
        if result.returncode != 0:
            print("  ERROR: npm install failed")
            return False
    else:
        print("  Node modules already installed")

    return True


def setup_database():
    print("\n[2/4] Setting up database...")
    env = os.environ.copy()
    env["USE_SQLITE"] = "1"
    env["PYTHONPATH"] = str(BACKEND)

    # Check for Supabase
    supabase_url = env.get("SUPABASE_DB_URL") or ""
    if supabase_url:
        print("  Using Supabase PostgreSQL database")
        env.pop("USE_SQLITE", None)
    else:
        print("  Using SQLite (local development)")

    # Run database initialization and seeding
    result = subprocess.run(
        [sys.executable, "-c", """
import asyncio, sys
sys.path.insert(0, r'""" + str(BACKEND) + r"""')
from scripts.init_db import main
asyncio.run(main())
"""],
        cwd=BACKEND, env=env, capture_output=True, text=True
    )
    if result.returncode != 0:
        print(f"  WARNING: DB init issue (may already exist): {result.stderr[:200]}")
    for line in result.stdout.split("\n"):
        if line.strip():
            print(f"  {line.strip()}")

    print("  Database ready")
    return True


def start_backend(env):
    print("\n[3/4] Starting Backend (FastAPI) on http://localhost:8000 ...")
    backend_env = os.environ.copy()
    backend_env["USE_SQLITE"] = env.get("USE_SQLITE", "1")
    backend_env["SUPABASE_DB_URL"] = env.get("SUPABASE_DB_URL", "")
    backend_env["GEMINI_API_KEY"] = env.get("GEMINI_API_KEY", "")
    backend_env["JWT_SECRET_KEY"] = env.get("JWT_SECRET_KEY", "kke-question-paper-secret-key-dev")
    backend_env["PYTHONPATH"] = str(BACKEND)

    proc = subprocess.Popen(
        [sys.executable, "-m", "uvicorn", "app.main:app",
         "--host", "0.0.0.0", "--port", "8000", "--reload"],
        cwd=BACKEND, env=backend_env,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, bufsize=1
    )
    return proc


def start_frontend():
    print("\n[4/4] Starting Frontend (Vite) on http://localhost:5173 ...")
    proc = subprocess.Popen(
        ["npm", "run", "dev"],
        cwd=FRONTEND,
        stdout=subprocess.PIPE, stderr=subprocess.STDOUT,
        text=True, bufsize=1,
        shell=os.name == 'nt'
    )
    return proc


def tail_output(proc, prefix=""):
    for line in iter(proc.stdout.readline, ""):
        if line:
            print(f"{prefix}{line}", end="")
        else:
            break


def main():
    print_banner()

    env = os.environ.copy()
    supabase_url = env.get("SUPABASE_DB_URL", "")
    gemini_key = env.get("GEMINI_API_KEY", "")

    if not supabase_url:
        env["USE_SQLITE"] = "1"
        print("  Database: SQLite (local)")
    else:
        print(f"  Database: Supabase PostgreSQL")
        env.pop("USE_SQLITE", None)

    if not gemini_key:
        print("  WARNING: GEMINI_API_KEY not set. AI features will use mock responses.")
        print("  Set it: $env:GEMINI_API_KEY='your-key'")
    else:
        print("  Gemini AI: Configured")

    if not check_dependencies():
        sys.exit(1)

    setup_database()

    procs = []
    threads = []

    backend = start_backend(env)
    procs.append(backend)
    threads.append(threading.Thread(target=tail_output, args=(backend, "[BACKEND] "), daemon=True))
    time.sleep(2)

    frontend = start_frontend()
    procs.append(frontend)
    threads.append(threading.Thread(target=tail_output, args=(frontend, "[FRONTEND] "), daemon=True))

    for t in threads:
        t.start()

    # Small delay to let servers start
    time.sleep(3)

    print("""
==============================================
  READY

  Frontend:  http://localhost:5173
  Backend:   http://localhost:8000
  API Docs:  http://localhost:8000/docs

  Test Credentials:
    Username: testuser / Password: Test@123
    Email: test@kke.com

  Press Ctrl+C to stop all services
==============================================
""")

    try:
        for t in threads:
            t.join()
    except KeyboardInterrupt:
        print("\n[INFO] Shutting down all services...")
    finally:
        for p in procs:
            if p.poll() is None:
                p.terminate()
                try:
                    p.wait(timeout=5)
                except subprocess.TimeoutExpired:
                    p.kill()
        print("[INFO] All services stopped. Goodbye!")


if __name__ == "__main__":
    main()
