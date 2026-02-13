"""
Dashboard API endpoints for user profile, usage statistics, and settings.
"""
from datetime import datetime, timedelta
from typing import Optional
from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy import func

from database import get_db
from auth import get_current_user_required
from models import User, Diagram


router = APIRouter()


# --- Schemas ---
class ProfileUpdateRequest(BaseModel):
    username: Optional[str] = Field(None, min_length=2, max_length=50)
    avatar_url: Optional[str] = Field(None, max_length=500)


class PasswordUpdateRequest(BaseModel):
    current_password: str = Field(..., min_length=1)
    new_password: str = Field(..., min_length=8, max_length=128)


# --- Endpoints ---
@router.get("/profile")
async def get_profile(
    current_user: User = Depends(get_current_user_required),
):
    """Get current user's profile."""
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "avatar_url": current_user.avatar_url,
        "plan": current_user.plan,
        "diagrams_this_month": current_user.diagrams_this_month,
        "tokens_used_this_month": getattr(current_user, 'tokens_used_this_month', 0) or 0,
        "tokens_used_total": getattr(current_user, 'tokens_used_total', 0) or 0,
        "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
    }


@router.put("/profile")
async def update_profile(
    body: ProfileUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
):
    """Update user profile."""
    if body.username is not None:
        # Check if username is taken
        existing = await db.execute(
            select(User).where(User.username == body.username, User.id != current_user.id)
        )
        if existing.scalars().first():
            raise HTTPException(status_code=400, detail="Username already taken")
        current_user.username = body.username
    
    if body.avatar_url is not None:
        current_user.avatar_url = body.avatar_url
    
    await db.commit()
    await db.refresh(current_user)
    
    return {
        "id": current_user.id,
        "email": current_user.email,
        "username": current_user.username,
        "avatar_url": current_user.avatar_url,
        "plan": current_user.plan,
    }


@router.put("/password")
async def update_password(
    body: PasswordUpdateRequest,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
):
    """Update user password."""
    from auth import verify_password, hash_password
    
    if not current_user.password_hash:
        raise HTTPException(status_code=400, detail="Account uses OAuth login, password cannot be changed")
    
    if not verify_password(body.current_password, current_user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    current_user.password_hash = hash_password(body.new_password)
    await db.commit()
    
    return {"message": "Password updated successfully"}


@router.get("/stats")
async def get_usage_stats(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
):
    """Get usage statistics for the current user."""
    # Total diagrams
    total_result = await db.execute(
        select(func.count(Diagram.id)).where(Diagram.user_id == current_user.id)
    )
    diagrams_total = total_result.scalar() or 0
    
    # Diagrams by type
    type_result = await db.execute(
        select(Diagram.diagram_type, func.count(Diagram.id))
        .where(Diagram.user_id == current_user.id)
        .group_by(Diagram.diagram_type)
    )
    diagrams_by_type = {row[0] or "unknown": row[1] for row in type_result.fetchall()}
    
    # Usage history (last 7 days)
    seven_days_ago = datetime.utcnow() - timedelta(days=7)
    history_result = await db.execute(
        select(func.date(Diagram.created_at), func.count(Diagram.id))
        .where(Diagram.user_id == current_user.id, Diagram.created_at >= seven_days_ago)
        .group_by(func.date(Diagram.created_at))
        .order_by(func.date(Diagram.created_at))
    )
    usage_history = [{"date": str(row[0]), "count": row[1]} for row in history_result.fetchall()]
    
    # Plan limits
    plan_limits = {"free": 10, "pro": 100, "team": 500}
    plan_limit = plan_limits.get(current_user.plan, 10)
    plan_used_percent = min(100, (current_user.diagrams_this_month / plan_limit) * 100) if plan_limit > 0 else 0
    
    # Token limits per plan (monthly)
    token_limits = {"free": 50000, "pro": 500000, "team": 2000000}
    token_limit = token_limits.get(current_user.plan, 50000)
    tokens_used = getattr(current_user, 'tokens_used_this_month', 0) or 0
    tokens_used_total = getattr(current_user, 'tokens_used_total', 0) or 0
    token_used_percent = min(100, (tokens_used / token_limit) * 100) if token_limit > 0 else 0
    
    return {
        "diagrams_this_month": current_user.diagrams_this_month,
        "diagrams_total": diagrams_total,
        "diagrams_by_type": diagrams_by_type,
        "usage_history": usage_history,
        "plan": current_user.plan,
        "plan_limit": plan_limit,
        "plan_used_percent": round(plan_used_percent, 1),
        # Token usage
        "tokens_used_this_month": tokens_used,
        "tokens_used_total": tokens_used_total,
        "token_limit": token_limit,
        "token_used_percent": round(token_used_percent, 1),
    }


@router.get("/overview")
async def get_dashboard_overview(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
):
    """Get complete dashboard overview - profile, stats, and recent diagrams."""
    # Get stats
    stats = await get_usage_stats(db, current_user)
    
    # Get recent diagrams (last 10)
    diagrams_result = await db.execute(
        select(Diagram)
        .where(Diagram.user_id == current_user.id)
        .order_by(Diagram.updated_at.desc())
        .limit(10)
    )
    recent_diagrams = [
        {
            "id": d.id,
            "title": d.title or "Untitled Diagram",
            "diagram_type": d.diagram_type,
            "mermaid_code": d.mermaid_code[:200] if d.mermaid_code else None,  # Preview
            "created_at": d.created_at.isoformat() if d.created_at else None,
            "updated_at": d.updated_at.isoformat() if d.updated_at else None,
        }
        for d in diagrams_result.scalars().all()
    ]
    
    return {
        "user": {
            "id": current_user.id,
            "email": current_user.email,
            "username": current_user.username,
            "avatar_url": current_user.avatar_url,
            "plan": current_user.plan,
            "created_at": current_user.created_at.isoformat() if current_user.created_at else None,
        },
        "stats": stats,
        "recent_diagrams": recent_diagrams,
    }


@router.delete("/account")
async def delete_account(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user_required),
):
    """Delete user account and all associated data."""
    await db.delete(current_user)
    await db.commit()
    return {"message": "Account deleted successfully"}
