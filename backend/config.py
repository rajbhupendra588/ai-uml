"""
Production-ready configuration via environment variables.
"""
import os
from typing import List

# Load .env file if present
try:
    from dotenv import load_dotenv
    load_dotenv()
except ImportError:
    pass  # python-dotenv not installed, use system env vars only

def _split_origins(value: str) -> List[str]:
    if not value or not value.strip():
        return []
    return [o.strip() for o in value.split(",") if o.strip()]

# CORS: allow multiple origins in production (e.g. https://app.example.com, https://www.example.com)
_cors_env = os.getenv("CORS_ORIGINS", "").strip()
if _cors_env:
    CORS_ORIGINS: List[str] = _split_origins(_cors_env)
else:
    # In development, allow all origins (set CORS_ORIGINS in production)
    CORS_ORIGINS: List[str] = ["*"]

# API
API_V1_PREFIX = "/api/v1"
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# Validation
MAX_PROMPT_LENGTH = int(os.getenv("MAX_PROMPT_LENGTH", "2000"))

# GitHub OAuth (optional; if not set, Sign in with GitHub is hidden or disabled)
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "").strip()
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "").strip()
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000").rstrip("/")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-in-production")
