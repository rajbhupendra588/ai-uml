# Backend-only Dockerfile for Render (repo root).
# Render uses this when building from root with Docker.
# Uses PORT from Render at runtime.
FROM python:3.11-slim

WORKDIR /app

COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY backend/ .
EXPOSE 8000

# Render sets PORT at runtime; shell form so $PORT is expanded when container runs
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
