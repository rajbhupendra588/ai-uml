"""
Usage limits for free tier (5 diagrams/month).
"""
from datetime import datetime
from sqlalchemy.ext.asyncio import AsyncSession

from fastapi import HTTPException
from models import User

LIMITS = {"free": 5, "pro": 999999, "team": 999999}


def _get_limit(plan: str) -> int:
    return LIMITS.get(plan, LIMITS["free"])


async def check_and_increment_usage(db: AsyncSession, user: User) -> None:
    """Check monthly limit, reset if new month, then increment. Raises 429 if over limit."""
    now = datetime.utcnow()
    # Reset if we're in a new month
    if user.last_reset_at.month != now.month or user.last_reset_at.year != now.year:
        user.diagrams_this_month = 0
        user.last_reset_at = now
        db.add(user)
        await db.commit()
        await db.refresh(user)

    limit = _get_limit(user.plan)
    if user.diagrams_this_month >= limit:
        raise HTTPException(
            status_code=429,
            detail="Monthly limit reached. Upgrade to Pro for unlimited diagrams.",
        )

    user.diagrams_this_month += 1
    db.add(user)
    await db.commit()
