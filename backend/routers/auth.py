from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from auth import (
    create_access_token,
    hash_password,
    verify_password,
    get_current_user,
    get_current_user_required,
)
from database import get_db
from models import User

router = APIRouter()


class RegisterRequest(BaseModel):
    email: str
    password: str


class LoginRequest(BaseModel):
    email: str
    password: str


class Token(BaseModel):
    access_token: str
    token_type: str


@router.post("/register", response_model=Token)
async def register(payload: RegisterRequest, db: AsyncSession = Depends(get_db)):
    """Register with email and password."""
    if len(payload.password) < 8:
        raise HTTPException(
            status_code=400,
            detail="Password must be at least 8 characters",
        )
    email = payload.email.strip().lower()
    result = await db.execute(select(User).where(User.email == email))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Email already registered")

    user = User(
        email=email,
        password_hash=hash_password(payload.password),
        username=email.split("@")[0],
    )
    db.add(user)
    await db.commit()
    await db.refresh(user)

    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@router.post("/login", response_model=Token)
async def login(payload: LoginRequest, db: AsyncSession = Depends(get_db)):
    """Login with email and password."""
    email = payload.email.strip().lower()
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    if not user or not verify_password(payload.password, user.password_hash):
        raise HTTPException(
            status_code=401,
            detail="Invalid email or password",
        )
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}


@router.get("/me")
async def read_users_me(current_user: User = Depends(get_current_user_required)):
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "plan": current_user.plan,
        "diagrams_this_month": current_user.diagrams_this_month,
        "tokens_used_this_month": current_user.tokens_used_this_month,
    }


@router.post("/logout")
async def logout():
    """Logout - client should clear stored token. JWT is stateless."""
    return {"detail": "Logged out"}


# --- GitHub OAuth ---

from urllib.parse import urlencode

from fastapi import Request
from fastapi.responses import RedirectResponse

from config import GITHUB_CLIENT_ID, GITHUB_CLIENT_SECRET, GITHUB_CALLBACK_URL
import httpx


def _github_authorize_url() -> str:
    """Build GitHub OAuth authorize URL. Call only when GITHUB_CLIENT_ID is set."""
    scope = "read:user user:email"
    params = {
        "client_id": GITHUB_CLIENT_ID,
        "scope": scope,
        "redirect_uri": GITHUB_CALLBACK_URL,
    }
    return f"https://github.com/login/oauth/authorize?{urlencode(params)}"


@router.get("/github/authorize")
async def github_authorize(request: Request):
    """Return the GitHub authorization URL (JSON). If ?redirect=1, redirect browser to GitHub."""
    if not GITHUB_CLIENT_ID:
        raise HTTPException(
            status_code=503,
            detail="GitHub login is not configured. Set GITHUB_CLIENT_ID and GITHUB_CLIENT_SECRET.",
        )
    url = _github_authorize_url()
    if request.query_params.get("redirect") == "1":
        return RedirectResponse(url=url, status_code=302)
    return {"url": url}


@router.get("/github/callback")
async def github_callback(code: str, db: AsyncSession = Depends(get_db)):
    """Handle the GitHub OAuth callback."""
    if not GITHUB_CLIENT_ID or not GITHUB_CLIENT_SECRET:
        raise HTTPException(status_code=503, detail="GitHub credentials not configured")

    # 1. Exchange code for access token (redirect_uri must match authorize request and GitHub OAuth App)
    async with httpx.AsyncClient() as client:
        token_resp = await client.post(
            "https://github.com/login/oauth/access_token",
            params={
                "client_id": GITHUB_CLIENT_ID,
                "client_secret": GITHUB_CLIENT_SECRET,
                "code": code,
                "redirect_uri": GITHUB_CALLBACK_URL,
            },
            headers={"Accept": "application/json"},
        )
        token_data = token_resp.json()
        gh_token = token_data.get("access_token")
        if not gh_token:
            raise HTTPException(status_code=400, detail=f"Failed to get GitHub token: {token_data.get('error_description', 'Unknown error')}")

        # 2. Get user info
        user_resp = await client.get(
            "https://api.github.com/user",
            headers={"Authorization": f"Bearer {gh_token}"},
        )
        gh_user = user_resp.json()
        gh_id = gh_user.get("id")
        gh_email = gh_user.get("email")
        gh_username = gh_user.get("login")
        gh_avatar = gh_user.get("avatar_url")

        if not gh_email:
            # Email might be private, fetch primary email
            emails_resp = await client.get(
                "https://api.github.com/user/emails",
                headers={"Authorization": f"Bearer {gh_token}"},
            )
            emails = emails_resp.json()
            primary_email = next((e["email"] for e in emails if e["primary"]), None)
            gh_email = primary_email or gh_email

        if not gh_email:
            raise HTTPException(status_code=400, detail="Could not retrieve email from GitHub")

    # 3. Find or create user
    # Check by github_id first
    result = await db.execute(select(User).where(User.github_id == gh_id))
    user = result.scalars().first()

    if not user:
        # Check by email
        result = await db.execute(select(User).where(User.email == gh_email.lower()))
        user = result.scalars().first()
        
        if user:
            # Link existing email account to GitHub
            user.github_id = gh_id
            user.avatar_url = gh_avatar
        else:
            # Create new user
            user = User(
                email=gh_email.lower(),
                username=gh_username,
                github_id=gh_id,
                avatar_url=gh_avatar,
                plan="free",
            )
            db.add(user)
        
        await db.commit()
        await db.refresh(user)
    else:
        # Update profile info if needed
        user.avatar_url = gh_avatar
        user.username = gh_username
        await db.commit()

    # 4. Create access token
    access_token = create_access_token(data={"sub": str(user.id)})
    return {"access_token": access_token, "token_type": "bearer"}
