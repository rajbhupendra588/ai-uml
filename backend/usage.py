"""
Usage limits and billing checks.
Free: 5 diagrams/month, 10K tokens/month
Pro: unlimited diagrams, 500K tokens/month
"""
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import HTTPException
from models import User

# Diagram limits per month (None = unlimited)
LIMITS = {"free": 5, "pro": None}

# Token limits per month
TOKEN_LIMITS = {"free": 10000, "pro": 500000}


def _get_limit(plan: str) -> int:
    return LIMITS.get(plan, LIMITS["free"])


def _get_token_limit(plan: str) -> int:
    return TOKEN_LIMITS.get(plan, TOKEN_LIMITS["free"])


async def _reset_monthly_usage_if_needed(db: AsyncSession, user: User) -> None:
    """Reset monthly counters if we're in a new month."""
    # Refresh user to ensure all attributes are loaded
    await db.refresh(user)
    
    now = datetime.utcnow()
    # Reset if we're in a new month or year
    if user.last_reset_at.month != now.month or user.last_reset_at.year != now.year:
        user.diagrams_this_month = 0
        user.tokens_used_this_month = 0
        user.last_reset_at = now
        db.add(user)
        await db.commit()
        await db.refresh(user)


async def check_and_increment_usage(db: AsyncSession, user: User) -> None:
    """Check monthly limit, reset if new month, then increment. Raises 429 if over limit."""
    # Reset counters if new month
    await _reset_monthly_usage_if_needed(db, user)

    limit = _get_limit(user.plan)
    
    # Pro users have unlimited diagrams (limit = None)
    if limit is not None and user.diagrams_this_month >= limit:
        raise HTTPException(
            status_code=429,
            detail=f"Monthly limit of {limit} diagrams reached. Upgrade to Pro for unlimited diagrams.",
        )

    user.diagrams_this_month += 1
    db.add(user)
    await db.commit()


async def track_token_usage(db: AsyncSession, user: User, tokens_used: int) -> None:
    """Track token usage for the current user."""
    # Refresh user first to ensure we're in proper async context
    await db.refresh(user)
    
    # Check if reset is needed
    now = datetime.utcnow()
    if user.last_reset_at.month != now.month or user.last_reset_at.year != now.year:
        user.diagrams_this_month = 0
        user.tokens_used_this_month = 0
        user.last_reset_at = now
    
    # Update token counters
    user.tokens_used_this_month = (user.tokens_used_this_month or 0) + tokens_used
    user.tokens_used_total = (user.tokens_used_total or 0) + tokens_used
    db.add(user)
    await db.commit()
