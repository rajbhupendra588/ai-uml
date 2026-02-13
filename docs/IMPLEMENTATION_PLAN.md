# Implementation Plan: Immediate Actions (Next 2 Weeks)

**Start Date:** February 8, 2026  
**Target Completion:** February 22, 2026

**Status:** All Phase 1–3 tasks implemented (Feb 8, 2026). GitHub OAuth replaced with email/password auth. Save/load, usage limits, and frontend auth UI complete.

---

## Phase 1: Remove Unnecessary Features (Days 1-4)

### ✅ Task 1.1: Remove GitHub OAuth (Day 1)
**Files to Delete:**
- `backend/auth.py`
- `frontend/components/GithubReposPanel.tsx` (if exists)

**Files to Modify:**
- `backend/main.py` - Remove auth endpoints (lines 351-456)
- `backend/requirements.txt` - Remove `itsdangerous`
- `backend/config.py` - Remove auth-related config
- `frontend/components/*` - Remove auth UI components

**Testing:**
- Verify API still works without auth
- Test diagram generation flow
- Check CORS still works

---

### ✅ Task 1.2: Simplify RAG (Remove Pinecone) (Day 1)
**Files to Modify:**
- `backend/rag.py` - Keep only mock context, remove Pinecone
- `backend/requirements.txt` - Remove `pinecone-client`, `openai` (for embeddings)
- `backend/config.py` - Remove Pinecone env vars
- `.env.example` - Remove Pinecone references

**Testing:**
- Verify architecture diagrams still generate
- Check context injection works with mock

---

### ✅ Task 1.3: Remove LLD Diagram Type (Day 2)
**Files to Modify:**
- `backend/diagram_types.py` - Remove "lld" from DiagramType
- `backend/agent.py` - Remove `_plan_lld` function and routing
- `frontend/components/DiagramTypeSelector.tsx` - Remove LLD option

**Testing:**
- Verify diagram type selector works
- Test all remaining diagram types

---

### ✅ Task 1.4: Remove Mind Map/Tree (Day 2)
**Files to Modify:**
- `backend/diagram_types.py` - Remove "mindtree" from DiagramType
- `backend/agent.py` - Remove `_plan_mindtree` function and routing
- `frontend/components/DiagramTypeSelector.tsx` - Remove Mind Tree option

**Testing:**
- Verify diagram type selector works
- Test all remaining diagram types

---

### ✅ Task 1.5: Remove Draw.io Export (Day 3)
**Files to Delete:**
- `backend/renderers/drawio.py`
- `backend/diagram_ir.py` (if only used for Draw.io)

**Files to Modify:**
- `backend/main.py` - Remove `/api/v1/export` endpoint
- `frontend/components/DiagramDownloadMenu.tsx` - Remove Draw.io option

**Testing:**
- Verify PNG/SVG/PDF exports still work

---

### ✅ Task 1.6: Remove Version Switcher (Day 3)
**Files to Delete:**
- `frontend/components/VersionSwitcher.tsx`

**Files to Modify:**
- `frontend/components/Canvas.tsx` - Remove version switcher UI
- Keep undo/redo functionality

**Testing:**
- Verify undo/redo still works
- Check canvas UI is clean

---

## Phase 2: Fix Security Issues (Days 4-6)

### ✅ Task 2.1: Clean .env.example (Day 4)
**Action:**
- Replace all real values with placeholders
- Add comments explaining each variable
- Rotate any exposed keys in production

**File:** `.env.example`

---

### ✅ Task 2.2: Add Rate Limiting (Day 4-5)
**Implementation:**
```python
# backend/main.py
from slowapi import Limiter, _rate_limit_exceeded_handler
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded

limiter = Limiter(key_func=get_remote_address)
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)

@app.post(f"{API_V1_PREFIX}/generate")
@limiter.limit("10/minute")  # Adjust as needed
def generate_diagram(request: Request, body: PromptRequest):
    ...

@app.post(f"{API_V1_PREFIX}/generate-from-repo")
@limiter.limit("5/minute")  # Lower for expensive operations
def generate_diagram_from_repo(request: Request, body: GenerateFromRepoRequest):
    ...
```

**Files to Modify:**
- `backend/requirements.txt` - Add `slowapi`
- `backend/main.py` - Add rate limiting
- `backend/config.py` - Add rate limit config

**Testing:**
- Test rate limit enforcement
- Verify error messages are user-friendly

---

### ✅ Task 2.3: Add Request Validation (Day 5)
**Action:**
- Enforce MAX_PROMPT_LENGTH
- Add max payload size for repo analysis
- Better error messages

**Files to Modify:**
- `backend/main.py` - Enhanced validation

---

### ✅ Task 2.4: Add Structured Logging (Day 6)
**Implementation:**
```python
# backend/main.py
import uuid
from contextvars import ContextVar

request_id_var: ContextVar[str] = ContextVar("request_id", default="")

@app.middleware("http")
async def add_request_id(request: Request, call_next):
    request_id = str(uuid.uuid4())
    request_id_var.set(request_id)
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response

# Update logging to include request_id
logger.info("generate_request", extra={
    "request_id": request_id_var.get(),
    "prompt_length": len(request.prompt),
    ...
})
```

**Testing:**
- Verify request IDs in logs
- Check log format is parseable

---

## Phase 3: User Accounts Foundation (Days 7-14)

### ✅ Task 3.1: Database Setup (Day 7)
**Technology:** PostgreSQL (or SQLite for development)

**Schema:**
```sql
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email VARCHAR(255) UNIQUE NOT NULL,
    password_hash VARCHAR(255) NOT NULL,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW(),
    plan VARCHAR(50) DEFAULT 'free',  -- free, pro, team
    diagrams_this_month INTEGER DEFAULT 0,
    last_reset_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE diagrams (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id UUID REFERENCES users(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    diagram_type VARCHAR(50) NOT NULL,
    diagram_data JSONB NOT NULL,  -- Full diagram JSON
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_diagrams_user_id ON diagrams(user_id);
CREATE INDEX idx_diagrams_created_at ON diagrams(created_at DESC);
```

**Files to Create:**
- `backend/database.py` - Database connection
- `backend/models/user.py` - User model
- `backend/models/diagram.py` - Diagram model
- `backend/migrations/001_initial.sql` - Initial schema

---

### ✅ Task 3.2: Authentication (Simple Email/Password) (Days 8-9)
**Implementation:**
```python
# backend/auth_simple.py
from passlib.context import CryptContext
from jose import JWTError, jwt
from datetime import datetime, timedelta

pwd_context = CryptContext(schemes=["bcrypt"], deprecated="auto")

def hash_password(password: str) -> str:
    return pwd_context.hash(password)

def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)

def create_access_token(data: dict, expires_delta: timedelta = None):
    to_encode = data.copy()
    expire = datetime.utcnow() + (expires_delta or timedelta(hours=24))
    to_encode.update({"exp": expire})
    return jwt.encode(to_encode, SECRET_KEY, algorithm="HS256")
```

**Endpoints:**
- `POST /api/v1/auth/register` - Email + password signup
- `POST /api/v1/auth/login` - Email + password login
- `GET /api/v1/auth/me` - Get current user
- `POST /api/v1/auth/logout` - Logout (invalidate token)

**Files to Create:**
- `backend/auth_simple.py` - Auth utilities
- `backend/routers/auth.py` - Auth endpoints

**Files to Modify:**
- `backend/requirements.txt` - Add `passlib`, `python-jose`, `bcrypt`

---

### ✅ Task 3.3: Usage Limits (Days 9-10)
**Implementation:**
```python
# backend/middleware/usage.py
from fastapi import HTTPException

async def check_usage_limit(user_id: str, plan: str):
    # Get user's usage this month
    user = await get_user(user_id)
    
    limits = {
        "free": 5,
        "pro": 999999,  # Unlimited
        "team": 999999
    }
    
    if user.diagrams_this_month >= limits[plan]:
        raise HTTPException(
            status_code=429,
            detail=f"Monthly limit reached. Upgrade to Pro for unlimited diagrams."
        )
    
    # Increment counter
    await increment_usage(user_id)
```

**Testing:**
- Test free tier limit (5 diagrams)
- Test limit reset (monthly)
- Test upgrade flow

---

### ✅ Task 3.4: Save/Load Diagrams (Days 10-11)
**Endpoints:**
- `POST /api/v1/diagrams` - Save diagram
- `GET /api/v1/diagrams` - List user's diagrams
- `GET /api/v1/diagrams/{id}` - Get specific diagram
- `PUT /api/v1/diagrams/{id}` - Update diagram
- `DELETE /api/v1/diagrams/{id}` - Delete diagram

**Files to Create:**
- `backend/routers/diagrams.py` - Diagram CRUD

---

### ✅ Task 3.5: Frontend Auth UI (Days 12-13)
**Components to Create:**
- `frontend/components/auth/LoginModal.tsx`
- `frontend/components/auth/SignupModal.tsx`
- `frontend/components/auth/UserMenu.tsx`
- `frontend/lib/auth.ts` - Auth utilities

**Features:**
- Login/Signup modals
- User menu (top-right)
- Protected routes
- Token storage (localStorage)

---

### ✅ Task 3.6: Frontend Save/Load UI (Day 14)
**Components to Create:**
- `frontend/components/SaveDiagramModal.tsx`
- `frontend/components/DiagramsListPanel.tsx`

**Features:**
- Save button (prompts for title)
- "My Diagrams" panel
- Load diagram from list
- Delete confirmation

---

## Testing Checklist

### Removal Testing
- [ ] All diagram types work (Architecture, HLD, Sequence, Class, Use Case, Component, Activity, State, Deployment)
- [ ] GitHub public repo analysis works
- [ ] PNG/SVG/PDF export works
- [ ] No broken imports or references
- [ ] No console errors

### Security Testing
- [ ] Rate limiting enforces limits
- [ ] Rate limit errors are user-friendly
- [ ] .env.example has no real secrets
- [ ] Request validation works
- [ ] Logs include request IDs

### Auth Testing
- [ ] User can register
- [ ] User can login
- [ ] User can logout
- [ ] Invalid credentials rejected
- [ ] JWT tokens work
- [ ] Protected endpoints require auth

### Usage Limits Testing
- [ ] Free tier limited to 5 diagrams/month
- [ ] Counter increments correctly
- [ ] Limit reset works (monthly)
- [ ] Error message clear when limit reached

### Save/Load Testing
- [ ] User can save diagram
- [ ] User can list diagrams
- [ ] User can load diagram
- [ ] User can delete diagram
- [ ] Diagrams isolated by user

---

## Deployment Checklist

- [ ] Update `requirements.txt`
- [ ] Run database migrations
- [ ] Update environment variables
- [ ] Test on staging
- [ ] Deploy backend
- [ ] Deploy frontend
- [ ] Smoke test production

---

## Success Metrics (End of 2 Weeks)

- [ ] Codebase reduced by ~800 lines
- [ ] All security issues fixed
- [ ] User registration working
- [ ] Save/load working
- [ ] Free tier limit enforced
- [ ] No broken features
- [ ] All tests passing

---

## Next Steps (Week 3+)

1. **Payment Integration** (Stripe)
2. **Pro Plan Features** (unlimited diagrams, priority models)
3. **Template Gallery**
4. **Email verification**
5. **Password reset**
6. **User dashboard**

---

*This plan prioritizes quick wins and foundational work. Each task is designed to be completed in 1 day or less.*
