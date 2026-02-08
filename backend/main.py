"""
ArchitectAI API — Production-ready FastAPI application.
"""
import logging
import sys
from contextlib import asynccontextmanager
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from fastapi import FastAPI, HTTPException, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field

from config import API_BASE_URL, CORS_ORIGINS, API_V1_PREFIX, ENVIRONMENT, FRONTEND_URL, LOG_LEVEL, MAX_PROMPT_LENGTH, REPO_ANALYSIS_MAX_LENGTH, GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET

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


def _cors_headers(request: Request) -> dict:
    """CORS headers for a response. Use in exception handlers so error responses are not blocked by browser."""
    origin = request.headers.get("origin", "").strip()
    allow_origin = origin if origin and origin in CORS_ORIGINS else (CORS_ORIGINS[0] if CORS_ORIGINS else "*")
    return {
        "Access-Control-Allow-Origin": allow_origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Session-Token",
    }


class EnsureCORSHeadersMiddleware(BaseHTTPMiddleware):
    """Ensure CORS headers are on every response (including 500). Fixes browser CORS errors on failure."""
    async def dispatch(self, request: Request, call_next):
        response = await call_next(request)
        for k, v in _cors_headers(request).items():
            response.headers[k] = v
        return response


app.add_middleware(
    CORSMiddleware,
    allow_origins=CORS_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
# Outermost: ensure CORS on every response (including 5xx) so browser never blocks
app.add_middleware(EnsureCORSHeadersMiddleware)


@app.exception_handler(RequestValidationError)
def validation_exception_handler(request: Request, exc: RequestValidationError):
    """Return a single, readable message for 422 so clients can show it in the UI. Include CORS so browser does not block."""
    errs = getattr(exc, "errors", ())
    if callable(errs):
        errs = errs()
    if not isinstance(errs, (list, tuple)):
        errs = []
    if errs:
        first = errs[0]
        loc = first.get("loc", ())
        msg = first.get("msg", "Invalid request")
        field = loc[-1] if len(loc) > 1 else (loc[0] if loc else "body")
        if "required" in str(msg).lower() or "missing" in str(first.get("type", "")).lower():
            detail = f"Missing or invalid field: {field}. {msg}"
        elif "enum" in str(first.get("type", "")).lower():
            from diagram_types import DIAGRAM_TYPE_LABELS
            allowed = ", ".join(DIAGRAM_TYPE_LABELS.keys())
            detail = f"Invalid diagram_type. Use one of: {allowed}."
        else:
            detail = f"{field}: {msg}"
    else:
        detail = f"Request validation failed. Check prompt (required, 1–{MAX_PROMPT_LENGTH} chars) and diagram_type."
    logger.warning("validation_error", extra={"detail": detail, "errors": errs if isinstance(errs, (list, tuple)) else []})
    resp = JSONResponse(status_code=422, content={"detail": detail})
    for k, v in _cors_headers(request).items():
        resp.headers[k] = v
    return resp


@app.exception_handler(Exception)
def unhandled_exception_handler(request: Request, exc: Exception):
    """Return JSON for exceptions. Add CORS headers so browser does not block on 5xx (exception handlers bypass middleware)."""
    if isinstance(exc, HTTPException):
        resp = JSONResponse(status_code=exc.status_code, content={"detail": exc.detail})
    else:
        logger.exception("unhandled_exception")
        resp = JSONResponse(
            status_code=500,
            content={"detail": "An unexpected error occurred. Please try again."},
        )
    for k, v in _cors_headers(request).items():
        resp.headers[k] = v
    return resp


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


class GenerateFromPlanRequest(BaseModel):
    diagram_plan: dict = Field(..., description="Plan from POST /api/v1/plan")
    diagram_type: DiagramType = Field(..., description="Same diagram_type used for /plan")


class ExportRequest(BaseModel):
    diagram_plan: dict = Field(..., description="Plan from POST /api/v1/plan or generate result")
    diagram_type: DiagramType = Field(..., description="Diagram type")
    tool: str = Field(default="drawio", description="Export target: drawio")


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
    import time
    from agent import run_agent
    try:
        logger.info(
            "generate_request",
            extra={"prompt_length": len(request.prompt), "diagram_type": request.diagram_type, "model": request.model or "default"},
        )
        start = time.perf_counter()
        result = run_agent(request.prompt, request.diagram_type, request.model)
        duration_ms = round((time.perf_counter() - start) * 1000)
        logger.info(
            "generate_success",
            extra={
                "diagram_type": request.diagram_type,
                "duration_ms": duration_ms,
                "has_mermaid": bool(result.get("mermaid")),
                "versions_count": len(result.get("versions") or []),
            },
        )
        return result
    except Exception as e:
        logger.exception("generate_error", extra={"diagram_type": getattr(request, "diagram_type", None)})
        detail = "Diagram generation failed. Please try again."
        if ENVIRONMENT == "development":
            detail = f"{detail} ({type(e).__name__}: {str(e)[:200]})"
        raise HTTPException(status_code=500, detail=detail)


# Legacy route for backward compatibility
@app.post("/generate")
def generate_diagram_legacy(request: PromptRequest):
    return generate_diagram(request)


@app.post(f"{API_V1_PREFIX}/plan")
def get_plan(request: PromptRequest):
    """Return only the diagram plan (no diagram yet). Use for multi-step: show plan → user confirms → POST to /generate-from-plan."""
    from agent import run_plan_only
    try:
        plan = run_plan_only(request.prompt, request.diagram_type, request.model)
        return {"diagram_plan": plan, "diagram_type": request.diagram_type}
    except Exception as e:
        logger.exception("plan_error", extra={"diagram_type": request.diagram_type})
        raise HTTPException(status_code=500, detail="Plan generation failed. Please try again.")


@app.post(f"{API_V1_PREFIX}/generate-from-plan")
def generate_diagram_from_plan(request: GenerateFromPlanRequest):
    """Generate diagram from an existing plan (e.g. after user confirmed plan from /plan). No LLM call."""
    from agent import run_generator_from_plan
    from diagram_validator import get_valid_plan
    try:
        plan = get_valid_plan(request.diagram_type, request.diagram_plan)
        result = run_generator_from_plan(plan, request.diagram_type)
        return result
    except Exception as e:
        logger.exception("generate_from_plan_error", extra={"diagram_type": request.diagram_type})
        raise HTTPException(status_code=500, detail="Diagram generation from plan failed. Please try again.")


@app.post(f"{API_V1_PREFIX}/export")
def export_diagram(request: ExportRequest):
    """
    Export diagram to tool-native format (Draw.io, etc.).
    Converts plan → IR → validate → tool-specific output. Editable in target tool.
    """
    from diagram_validator import get_valid_plan
    from diagram_ir import plan_to_ir, validate_ir
    from renderers.drawio import ir_to_drawio
    try:
        plan = get_valid_plan(request.diagram_type, request.diagram_plan)
        ir = plan_to_ir(request.diagram_type, plan)
        is_valid, errors = validate_ir(ir)
        if not is_valid:
            logger.warning("export_ir_validation_failed", extra={"errors": errors[:5]})
            # Repair: filter invalid edges and continue (no orphan connectors)
            ir["edges"] = [
                e for e in ir.get("edges", [])
                if e.get("from") in {n.get("id") for n in ir.get("nodes", [])}
                and e.get("to") in {n.get("id") for n in ir.get("nodes", [])}
            ]
        tool = "drawio" if request.tool in ("drawio", "draw.io") else "drawio"
        if tool == "drawio":
            content = ir_to_drawio(ir)
            return {
                "content": content,
                "format": "drawio",
                "filename": f"{request.diagram_type}-diagram.drawio",
                "mime_type": "application/xml",
            }
        raise HTTPException(status_code=400, detail=f"Unsupported export tool: {request.tool}")
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("export_error", extra={"diagram_type": request.diagram_type, "tool": request.tool})
        raise HTTPException(status_code=500, detail="Export failed. Please try again.")


@app.post(f"{API_V1_PREFIX}/generate-from-repo")
def generate_diagram_from_repo(request: GenerateFromRepoRequest):
    """
    Deep-analyze a GitHub repo and generate the chosen diagram type.
    Flow: 1) Deep repo analysis, 2) LLM repo explanation, 3) Diagram plan, 4) Diagram.
    Returns repo_explanation (for chat), diagram_plan (for chat), and mermaid diagram.
    """
    import httpx
    from agent import run_agent, generate_repo_explanation, format_plan_for_display
    from github_repo import analyze_repo
    try:
        logger.info(
            "generate_from_repo",
            extra={"repo_url": request.repo_url[:80], "diagram_type": request.diagram_type, "model": request.model},
        )
        raw_summary = analyze_repo(request.repo_url.strip())
        if len(raw_summary) > REPO_ANALYSIS_MAX_LENGTH:
            raw_summary = raw_summary[:REPO_ANALYSIS_MAX_LENGTH] + "\n... (truncated for analysis)"
        repo_explanation = generate_repo_explanation(raw_summary, request.model)
        # Strict prompt: prevent hallucinating AWS/Stripe/etc. not in the repo
        repo_prompt = (
            "CRITICAL - Repository analysis mode: Extract ONLY components that are explicitly "
            "mentioned or clearly evident in the codebase below. Do NOT invent or assume cloud "
            "components (AWS, GCP, Stripe, SendGrid, SQS, Redis, etc.) unless they appear in the "
            "files. If the repo is a simple app (e.g. Ruby on Rails, Heroku), show only what exists."
        )
        if "MONOREPO" in raw_summary:
            repo_prompt += (
                " MONOREPO: This repo has multiple projects (apps, packages). Include ALL projects "
                "in the diagram—each app and shared package. Do not merge or omit projects."
            )
        repo_prompt += "\n\n" + raw_summary
        result = run_agent(repo_prompt, request.diagram_type, request.model)
        result["repo_url"] = request.repo_url.strip()
        result["repo_explanation"] = repo_explanation
        diagram_plan = result.get("diagram_plan")
        if diagram_plan:
            result["diagram_plan_summary"] = format_plan_for_display(diagram_plan, request.diagram_type)
        return result
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except httpx.HTTPStatusError as e:
        if e.response.status_code == 404:
            raise HTTPException(status_code=404, detail="Repository not found or private.")
        if e.response.status_code in (401, 403):
            raise HTTPException(
                status_code=502,
                detail="GitHub access denied. Check GITHUB_TOKEN or repo visibility.",
            )
        raise HTTPException(
            status_code=502,
            detail=f"GitHub API error: {e.response.status_code}. Try again later.",
        )
    except httpx.RequestError as e:
        logger.warning("generate_from_repo_network_error: %s", e)
        raise HTTPException(
            status_code=502,
            detail="Could not reach GitHub. Check the repo URL and try again.",
        )
    except Exception as e:
        logger.exception("generate_from_repo_error: %s", e)
        raise HTTPException(
            status_code=500,
            detail="Repository analysis or diagram generation failed. Please try again.",
        )


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
