"""
ArchitectAI API — Production-ready FastAPI application.
"""
import logging
import sys
import uuid
from contextlib import asynccontextmanager
from starlette.middleware.base import BaseHTTPMiddleware
from starlette.requests import Request

from fastapi import FastAPI, HTTPException, Request, Depends
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse, RedirectResponse
from fastapi.exceptions import RequestValidationError
from pydantic import BaseModel, Field
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from asgi_correlation_id import CorrelationIdMiddleware, CorrelationIdFilter

from config import API_BASE_URL, CORS_ORIGINS, API_V1_PREFIX, DATABASE_URL, ENVIRONMENT, FRONTEND_URL, LOG_LEVEL, MAX_PROMPT_LENGTH, REPO_ANALYSIS_MAX_LENGTH, USING_SUPABASE
from database import get_db
from auth import get_current_user_from_request

# --- Structured logging ---
cid_filter = CorrelationIdFilter(uuid_length=8, default_value="-")
console_handler = logging.StreamHandler(sys.stdout)
console_handler.addFilter(cid_filter)

logging.basicConfig(
    level=getattr(logging, LOG_LEVEL, logging.INFO),
    format="%(asctime)s | %(levelname)s | [%(correlation_id)s] | %(name)s | %(message)s",
    datefmt="%Y-%m-%dT%H:%M:%SZ",
    handlers=[console_handler],
)
logger = logging.getLogger("architectai")

# --- Rate limiting ---
limiter = Limiter(key_func=get_remote_address)

from database import init_db
from routers import auth, diagrams, dashboard, subscription

# --- App ---
@asynccontextmanager
async def lifespan(app: FastAPI):
    # Initialize DB (create tables if needed)
    try:
        await init_db()
    except Exception as e:
        logger.error(f"Failed to initialize database: {e}")
        
    db_backend = "Supabase (PostgreSQL)" if USING_SUPABASE else ("SQLite" if "sqlite" in DATABASE_URL else "PostgreSQL")
    logger.info("ArchitectAI API starting", extra={"environment": ENVIRONMENT, "database": db_backend})
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
app.add_middleware(CorrelationIdMiddleware)
app.include_router(auth.router, prefix=f"{API_V1_PREFIX}/auth", tags=["auth"])
app.include_router(diagrams.router, prefix=f"{API_V1_PREFIX}/diagrams", tags=["diagrams"])
app.include_router(dashboard.router, prefix=f"{API_V1_PREFIX}/dashboard", tags=["dashboard"])
app.include_router(subscription.router, prefix=f"{API_V1_PREFIX}", tags=["subscription"])
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)


def _cors_headers(request: Request) -> dict:
    """CORS headers for a response. Use in exception handlers so error responses are not blocked by browser."""
    origin = request.headers.get("origin", "").strip()
    allow_origin = origin if origin and origin in CORS_ORIGINS else (CORS_ORIGINS[0] if CORS_ORIGINS else "*")
    return {
        "Access-Control-Allow-Origin": allow_origin,
        "Access-Control-Allow-Credentials": "true",
        "Access-Control-Allow-Methods": "GET, POST, OPTIONS, PUT, DELETE",
        "Access-Control-Allow-Headers": "Content-Type, Authorization, X-Request-ID",
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
    code_detail_level: str | None = Field(default="small", description="Code display: small or complete")


class GenerateFromRepoRequest(BaseModel):
    repo_url: str = Field(..., min_length=1, max_length=500, description="GitHub repository URL (e.g. https://github.com/owner/repo)")
    diagram_type: DiagramType = Field(default="architecture", description="Diagram type to generate")
    model: str | None = Field(default=None, description="OpenRouter model id")
    code_detail_level: str | None = Field(default="small", description="Code display: small or complete")


class GenerateFromPlanRequest(BaseModel):
    diagram_plan: dict = Field(..., description="Plan from POST /api/v1/plan")
    diagram_type: DiagramType = Field(..., description="Same diagram_type used for /plan")
    code_detail_level: str | None = Field(default="small", description="Code display: small or complete")


class UpdateDiagramRequest(BaseModel):
    prompt: str = Field(..., min_length=1, max_length=MAX_PROMPT_LENGTH)
    current_mermaid: str = Field(..., min_length=1, description="Current Mermaid diagram code to update")
    model: str | None = Field(default=None, description="OpenRouter model id")
    code_detail_level: str | None = Field(default="small", description="Code display: small or complete")


class ShareDiagramRequest(BaseModel):
    mermaid_code: str = Field(..., min_length=1, max_length=MAX_PROMPT_LENGTH)




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
    from llm_models import AVAILABLE_MODELS, DEFAULT_MODEL_ID
    return {"models": AVAILABLE_MODELS, "default": DEFAULT_MODEL_ID}


@app.post(f"{API_V1_PREFIX}/generate")
@limiter.limit("5/minute")
async def generate_diagram(
    request: Request,
    body: PromptRequest,
    db=Depends(get_db),
    current_user=Depends(get_current_user_from_request),
):
    import time
    from agent import run_agent
    from usage import check_and_increment_usage, track_token_usage

    # Usage limit for authenticated users
    if current_user:
        await check_and_increment_usage(db, current_user)

    try:
        logger.info(
            "generate_request",
            extra={"prompt_length": len(body.prompt), "diagram_type": body.diagram_type, "model": body.model or "default"},
        )
        start = time.perf_counter()
        result = run_agent(body.prompt, body.diagram_type, body.model, body.code_detail_level)
        duration_ms = round((time.perf_counter() - start) * 1000)
        
        # Estimate token usage (rough approximation: 1 token ≈ 4 characters)
        # Input tokens: prompt + system prompt overhead
        input_tokens = (len(body.prompt) // 4) + 500  # Add 500 for system prompts
        # Output tokens: based on the mermaid code length
        mermaid_code = result.get("mermaid", "")
        output_tokens = len(str(mermaid_code)) // 4
        total_tokens = input_tokens + output_tokens
        
        # Track token usage for authenticated users
        if current_user and total_tokens > 0:
            try:
                await track_token_usage(db, current_user, total_tokens)
                logger.info("token_tracking_success", extra={"tokens": total_tokens, "user_id": current_user.id})
            except Exception as token_err:
                logger.error(f"Token tracking failed but continuing: {token_err}", extra={"user_id": current_user.id, "tokens": total_tokens})
        
        logger.info(
            "generate_success",
            extra={
                "diagram_type": body.diagram_type,
                "duration_ms": duration_ms,
                "has_mermaid": bool(result.get("mermaid")),
                "versions_count": len(result.get("versions") or []),
                "estimated_tokens": total_tokens,
            },
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("generate_error", extra={"diagram_type": getattr(body, "diagram_type", None)})
        detail = "Diagram generation failed. Please try again."
        if ENVIRONMENT == "development":
            detail = f"{detail} ({type(e).__name__}: {str(e)[:200]})"
        raise HTTPException(status_code=500, detail=detail)


@app.post(f"{API_V1_PREFIX}/update")
@limiter.limit("5/minute")
async def update_diagram_endpoint(
    request: Request,
    body: UpdateDiagramRequest,
    db=Depends(get_db),
    current_user=Depends(get_current_user_from_request),
):
    """Update an existing diagram based on user's refinement prompt."""
    import time
    from agent import update_diagram
    from usage import check_and_increment_usage, track_token_usage

    if current_user:
        await check_and_increment_usage(db, current_user)

    try:
        logger.info(
            "update_request",
            extra={"prompt_length": len(body.prompt), "mermaid_length": len(body.current_mermaid), "model": body.model or "default"},
        )
        start = time.perf_counter()
        result = update_diagram(body.current_mermaid, body.prompt, body.model)
        duration_ms = round((time.perf_counter() - start) * 1000)
        
        # Estimate token usage
        input_tokens = (len(body.prompt) + len(body.current_mermaid)) // 4 + 300
        mermaid_code = result.get("mermaid", "")
        output_tokens = len(str(mermaid_code)) // 4
        total_tokens = input_tokens + output_tokens
        
        # Track token usage
        if current_user and total_tokens > 0:
            try:
                await track_token_usage(db, current_user, total_tokens)
                logger.info("token_tracking_success", extra={"tokens": total_tokens, "user_id": current_user.id})
            except Exception as token_err:
                logger.error(f"Token tracking failed but continuing: {token_err}", extra={"user_id": current_user.id, "tokens": total_tokens})
        
        logger.info(
            "update_success",
            extra={"duration_ms": duration_ms, "has_mermaid": bool(result.get("mermaid")), "estimated_tokens": total_tokens},
        )
        return result
    except HTTPException:
        raise
    except Exception as e:
        logger.exception("update_error")
        detail = "Diagram update failed. Please try again."
        if ENVIRONMENT == "development":
            detail = f"{detail} ({type(e).__name__}: {str(e)[:200]})"
        raise HTTPException(status_code=500, detail=detail)


# --- Share diagram (in-memory store; extend with DB for production) ---
_share_store: dict[str, str] = {}

@app.post(f"{API_V1_PREFIX}/share")
@limiter.limit("20/minute")
def create_share(request: Request, body: ShareDiagramRequest):
    """Create a shareable link for a diagram. Returns share_id and share_url."""
    share_id = str(uuid.uuid4())[:12]
    _share_store[share_id] = body.mermaid_code
    share_url = f"{FRONTEND_URL}/share/{share_id}"
    return {"share_id": share_id, "share_url": share_url}


@app.get(f"{API_V1_PREFIX}/share/{{share_id}}")
def get_share(share_id: str):
    """Get shared diagram by ID."""
    if share_id not in _share_store:
        raise HTTPException(status_code=404, detail="Shared diagram not found or expired")
    return {"mermaid_code": _share_store[share_id]}


# Legacy route for backward compatibility
@app.post("/generate")
@limiter.limit("5/minute")
async def generate_diagram_legacy(
    request: Request,
    body: PromptRequest,
    db=Depends(get_db),
    current_user=Depends(get_current_user_from_request),
):
    return await generate_diagram(request, body, db, current_user)


@app.post(f"{API_V1_PREFIX}/plan")
@limiter.limit("5/minute")
def get_plan(request: Request, body: PromptRequest):
    """Return only the diagram plan (no diagram yet). Use for multi-step: show plan → user confirms → POST to /generate-from-plan."""
    from agent import run_plan_only
    try:
        plan = run_plan_only(body.prompt, body.diagram_type, body.model)
        return {"diagram_plan": plan, "diagram_type": body.diagram_type}
    except Exception as e:
        logger.exception("plan_error", extra={"diagram_type": body.diagram_type})
        raise HTTPException(status_code=500, detail="Plan generation failed. Please try again.")


@app.post(f"{API_V1_PREFIX}/generate-from-plan")
@limiter.limit("5/minute")
def generate_diagram_from_plan(request: Request, body: GenerateFromPlanRequest):
    """Generate diagram from an existing plan (e.g. after user confirmed plan from /plan). No LLM call."""
    from agent import run_generator_from_plan
    from diagram_validator import get_valid_plan
    try:
        plan = get_valid_plan(body.diagram_type, body.diagram_plan)
        result = run_generator_from_plan(plan, body.diagram_type, body.code_detail_level)
        return result
    except Exception as e:
        logger.exception("generate_from_plan_error", extra={"diagram_type": body.diagram_type})
        raise HTTPException(status_code=500, detail="Diagram generation from plan failed. Please try again.")




@app.post(f"{API_V1_PREFIX}/generate-from-repo")
@limiter.limit("5/minute")
def generate_diagram_from_repo(request: Request, body: GenerateFromRepoRequest):
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
            extra={"repo_url": body.repo_url[:80], "diagram_type": body.diagram_type, "model": body.model},
        )
        raw_summary = analyze_repo(body.repo_url.strip())
        if len(raw_summary) > REPO_ANALYSIS_MAX_LENGTH:
            raw_summary = raw_summary[:REPO_ANALYSIS_MAX_LENGTH] + "\n... (truncated for analysis)"
        repo_explanation = generate_repo_explanation(raw_summary, body.model)
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
        result = run_agent(repo_prompt, body.diagram_type, body.model, body.code_detail_level)
        result["repo_url"] = body.repo_url.strip()
        result["repo_explanation"] = repo_explanation
        diagram_plan = result.get("diagram_plan")
        if diagram_plan:
            result["diagram_plan_summary"] = format_plan_for_display(diagram_plan, body.diagram_type)
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


# --- GitHub Public Repos (no auth required) ---
# Note: Private repo access via OAuth has been removed to simplify the codebase


@app.get(f"{API_V1_PREFIX}/github/users/{{username}}/repos")
@limiter.limit("30/minute")
def github_user_public_repos(request: Request, username: str):
    """List public repos for any GitHub user (no auth required)."""
    import httpx
    import re
    import os
    
    # Validate username format
    if not re.match(r"^[a-zA-Z0-9]([a-zA-Z0-9-]*[a-zA-Z0-9])?$", username) or len(username) > 39:
        raise HTTPException(status_code=400, detail="Invalid GitHub username format.")
    
    headers = {"Accept": "application/vnd.github.v3+json", "User-Agent": "ArchitectAI-App"}
    # Use GITHUB_TOKEN if available (highest rate limit), else unauthenticated (lower limit)
    github_token = os.getenv("GITHUB_TOKEN")
    if github_token:
        headers["Authorization"] = f"Bearer {github_token}"
    
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
