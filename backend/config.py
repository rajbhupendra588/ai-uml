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
# With allow_credentials=True, browser rejects "*"; use explicit origins in dev.
_cors_env = os.getenv("CORS_ORIGINS", "").strip()
if _cors_env:
    CORS_ORIGINS: List[str] = _split_origins(_cors_env)
else:
    # Development: explicit localhost so credentials (cookies, X-Session-Token) work
    CORS_ORIGINS: List[str] = [
        "http://localhost:3000",
        "http://127.0.0.1:3000",
    ]

# API
API_V1_PREFIX = "/api/v1"
ENVIRONMENT = os.getenv("ENVIRONMENT", "development")
LOG_LEVEL = os.getenv("LOG_LEVEL", "INFO").upper()

# Validation
MAX_PROMPT_LENGTH = int(os.getenv("MAX_PROMPT_LENGTH", "2000"))
# Repo analysis needs more context; default 25k chars
REPO_ANALYSIS_MAX_LENGTH = int(os.getenv("REPO_ANALYSIS_MAX_LENGTH", "25000"))

# GitHub OAuth (optional; if not set, Sign in with GitHub is hidden or disabled)
GITHUB_CLIENT_ID = os.getenv("GITHUB_CLIENT_ID", "").strip()
GITHUB_CLIENT_SECRET = os.getenv("GITHUB_CLIENT_SECRET", "").strip()
FRONTEND_URL = os.getenv("FRONTEND_URL", "http://localhost:3000").rstrip("/")
API_BASE_URL = os.getenv("API_BASE_URL", "http://localhost:8000").rstrip("/")
SECRET_KEY = os.getenv("SECRET_KEY", "dev-secret-change-in-production")
