"""
ArchitectAI API — Production-ready FastAPI application.
"""
import logging
import sys
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, Field

from config import API_BASE_URL, CORS_ORIGINS, API_V1_PREFIX, ENVIRONMENT, FRONTEND_URL, LOG_LEVEL, MAX_PROMPT_LENGTH, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET

# --- Structured logging ---
logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s | %(levelname)s | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
    handlers=[logging.StreamHandler(sys.stdout)],
)
logger = logging.getLogger("architectai")

# --- App ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    logger.info("ArchitectAI API starting", extra={"environment": ENVIRONMENT})
    yield
    logger.info("ArchitectAI API shutting down")


app = FastAPI(
    title="ArchitectAI API",
    description="AI-powered architecture diagram generation",
    version="1.0.0",
    lifespan=lifespan,
    docs_url="/docs" if ENVIRONMENT != "production" else None,
    redoc_url="/redoc" if ENVIRONMENT != "production" else None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


# --- Schemas ---
from diagram_types import DiagramType

class PromptRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=MAX_PROMPT_LENGTH)
    diagram_type: DiagramType = Field(default="architecture", description="UML diagram type")
    model: str | None = Field(default=None, description="OpenRouter model id (e.g. arcee-ai/trinity-large-preview:free)")


class GenerateFromRepoRequest(BaseModel):
    repo_url: str = Field(..., min_length=1, max_length=500, description="GitHub repository URL (e.g. https://github.com/owner/repo)")
    diagram_type: DiagramType = Field(default="architecture", description="Diagram type to generate")
    model: str | None = Field(default=None, description="OpenRouter model id")


# --- Health ---
@app.get("/health")
def health():
    from agent import get_llm_mode
    return {
        "status": "ok",
        "service": "architectai-api",
        "llm_mode": get_llm_mode(),  # "openrouter" | "openai" | "mock"
    }


@app.get("/health/ready")
def ready():
    return {"status": "ready"}


# --- Root (legacy) ---
@app.get("/")
def read_root():
    return {"status": "ArchitectAI Brain Online", "docs": "/docs"}


# --- API v1 ---
@app.get(f"{API_V1_PREFIX}/diagram-types")
def list_diagram_types():
    from diagram_types import DIAGRAM_TYPE_LABELS
    return {"diagram_types": list(DIAGRAM_TYPE_LABELS.keys()), "labels": DIAGRAM_TYPE_LABELS}


@app.get(f"{API_V1_PREFIX}/models")
def list_models():
    from models import AVAILABLE_MODELS, DEFAULT_MODEL_ID
    return {"models": AVAILABLE_MODELS, "default": DEFAULT_MODEL_ID}


@app.post(f"{API_V1_PREFIX}/generate")
def generate_diagram(request: PromptRequest):
    from agent import run_agent
    try:
        logger.info("generate_request", extra={"prompt_length": len(request.prompt), "diagram_type": request.diagram_type, "model": request.model})
        result = run_agent(request.prompt, request.diagram_type, request.model)
        return result
    except Exception as e:
        logger.exception("generate_error")
        raise HTTPException(status_code=500, detail="Diagram generation failed. Please try again.")


# Legacy route for backward compatibility
@app.post("/generate")
def generate_diagram_legacy(request: PromptRequest):
    return generate_diagram(request)


@app.post(f"{API_V1_PREFIX}/generate-from-repo")
def generate_diagram_from_repo(request: GenerateFromRepoRequest):
    """Analyze a GitHub repo and generate the chosen diagram type from its structure and key files."""
    from agent import run_agent
    from github_repo import analyze_repo
    try:
        logger.info(
            "generate_from_repo",
            extra={"repo_url": request.repo_url[:80], "diagram_type": request.diagram_type, "model": request.model},
        )
        summary = analyze_repo(request.repo_url.strip())
        if len(summary) > MAX_PROMPT_LENGTH:
            summary = summary[:MAX_PROMPT_LENGTH] + "\n... (truncated)"
        result = run_agent(summary, request.diagram_type, request.model)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception:
        logger.exception("generate_from_repo_error")
        raise HTTPException(status_code=500, detail="Repository analysis or diagram generation failed. Please try again.")


# --- GitHub Auth (optional) ---
from auth import (
    COOKIE_MAX_AGE,
    COOKIE_NAME,
    create_session,
    destroy_session,
    exchange_code_for_token,
    get_github_authorize_url,
    get_login_from_request,
    get_access_token_from_request,
    is_github_oauth_configured,
    sign_session_id,
)


@app.get(f"{API_V1_PREFIX}/auth/github")
def auth_github_redirect():
    """Redirect to GitHub OAuth. Only works if GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET are set."""
    if not is_github_oauth_configured():
        raise HTTPException(status_code=501, detail="GitHub OAuth is not configured.")
    redirect_uri = f"{API_BASE_URL}/api/v1/auth/github/callback"
    url = get_github_authorize_url(redirect_uri)
    return RedirectResponse(url=url)


@app.get(f"{API_V1_PREFIX}/auth/github/callback")
async def auth_github_callback(code: str | None = None, state: str | None = None, error: str | None = None):
    if error or not code:
        return RedirectResponse(url=f"{FRONTEND_URL}?auth_error=1")
    if not is_github_oauth_configured():
        return RedirectResponse(url=FRONTEND_URL)
    redirect_uri = f"{API_BASE_URL}/api/v1/auth/github/callback"
    try:
        token_res = await exchange_code_for_token(code, redirect_uri)
    except Exception:
        logger.exception("github_oauth_token_exchange")
        return RedirectResponse(url=f"{FRONTEND_URL}?auth_error=1")
    access_token = token_res.get("access_token")
    if not access_token:
        return RedirectResponse(url=f"{FRONTEND_URL}?auth_error=1")
    session_id = create_session(access_token)
    signed = sign_session_id(session_id)
    # Redirect with fragment so frontend (cross-origin) can store session token
    return RedirectResponse(url=f"{FRONTEND_URL}#session={signed}")


@app.get(f"{API_V1_PREFIX}/auth/config")
def auth_config():
    """Return whether GitHub OAuth is available (so frontend can show/hide Sign in)."""
    return {"github_oauth_enabled": is_github_oauth_configured()}


@app.get(f"{API_V1_PREFIX}/auth/me")
def auth_me(request: Request):
    """Return current user if logged in via GitHub (cookie or X-Session-Token)."""
    cookie = request.cookies.get(COOKIE_NAME)
    header_token = request.headers.get("X-Session-Token")
    login = get_login_from_request(cookie, header_token)
    if not login:
        return {"logged_in": False}
    return {"logged_in": True, "login": login}


@app.post(f"{API_V1_PREFIX}/auth/logout")
def auth_logout(request: Request):
    """Clear session. Accepts cookie or X-Session-Token."""
    cookie = request.cookies.get(COOKIE_NAME)
    header_token = request.headers.get("X-Session-Token")
    from auth import SERIALIZER
    for raw in (cookie, header_token):
        if not raw:
            continue
        try:
            session_id = SERIALIZER.loads(raw, max_age=COOKIE_MAX_AGE)
            destroy_session(session_id)
        except Exception:
            pass
    from fastapi.responses import JSONResponse
    return JSONResponse(content={"ok": True})


@app.get(f"{API_V1_PREFIX}/github/repos")
def github_repos(request: Request):
    """List repos for the authenticated user. Requires GitHub OAuth login."""
    cookie = request.cookies.get(COOKIE_NAME)
    header_token = request.headers.get("X-Session-Token")
    token = get_access_token_from_request(cookie, header_token)
    if not token:
        raise HTTPException(status_code=401, detail="Not logged in. Sign in with GitHub first.")
    import httpx
    with httpx.Client() as client:
        r = client.get(
            "https://api.github.com/user/repos",
            params={"per_page": 100, "sort": "updated", "type": "all"},
            headers={"Authorization": f"Bearer {token}", "Accept": "application/vnd.github.v3+json"},
            timeout=15.0,
        )
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail="Failed to fetch repos from GitHub.")
        data = r.json()
    repos = [
        {"id": repo.get("id"), "name": repo.get("name"), "full_name": repo.get("full_name"), "html_url": repo.get("html_url"), "private": repo.get("private", False)}
        for repo in data
    ]
    return {"repos": repos}


@app.get(f"{API_V1_PREFIX}/github/users/{{username}}/repos")
def github_user_public_repos(username: str):
    """List public repos for any GitHub user (no auth required)."""
    import httpx
    import re
    import os
    
    # Validate username format
    if not re.match(r"^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$", username) or len(username) > 39:
        raise HTTPException(status_code=400, detail="Invalid GitHub username format.")
    
    headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "ArchitectAI-App"}
    # Use GITHUB_TOKEN if available (highest rate limit), else fall back to OAuth credentials
    github_token = os.getenv("GITHUB_TOKEN")
    if github_token:
        headers["Authorization"] = f"Bearer {github_token}"
    elif GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET:
        import base64
        auth = base64.b64encode(f"{GITHUB_CLIENT_ID}:{GITHUB_CLIENT_SECRET}".encode()).decode()
        headers["Authorization"] = f"Basic {auth}"
    
    with httpx.Client() as client:
        r = client.get(
            f"https://api.github.com/users/{username}/repos",
            params={"per_page": 100, "sort": "updated", "type": "public"},
            headers=headers,
            timeout=15.0,
        )
        if r.status_code == 404:
            raise HTTPException(status_code=404, detail=f"GitHub user '{username}' not found.")
        if r.status_code == 403:
            raise HTTPException(status_code=429, detail="GitHub API rate limit exceeded. Please try again later.")
        if r.status_code != 200:
            raise HTTPException(status_code=502, detail="Failed to fetch repos from GitHub.")
        data = r.json()
    
    repos = [
        {
            "id": repo.get("id"),
            "name": repo.get("name"),
            "full_name": repo.get("full_name"),
            "html_url": repo.get("html_url"),
            "description": repo.get("description"),
            "stargazers_count": repo.get("stargazers_count", 0),
            "language": repo.get("language"),
        }
        for repo in data
    ]
    return {"repos": repos, "username": username}


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(__import__("os").getenv("PORT", "8000")),
        reload=ENVIRONMENT == "development",
    )
