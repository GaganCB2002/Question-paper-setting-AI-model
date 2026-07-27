export USE_SQLITE=1
export JWT_SECRET_KEY="change-me-in-production"
export GEMINI_API_KEY="your-gemini-api-key"
export PYTHONPATH=.

uvicorn app.main:app --host 0.0.0.0 --port 8000 --reload
