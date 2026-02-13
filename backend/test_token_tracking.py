"""
Test script to manually track tokens and verify it works.
"""
import asyncio
import sys
sys.path.insert(0, '/Users/bhupendra/Documents/prpo1/backend')

from database import AsyncSessionLocal
from models import User
from sqlalchemy.future import select
from usage import track_token_usage


async def test_token_tracking():
    """Test token tracking for user ID 2."""
    async with AsyncSessionLocal() as db:
        # Get user
        result = await db.execute(select(User).where(User.id == 2))
        user = result.scalar_one_or_none()
        
        if not user:
            print("❌ User 2 not found")
            return
        
        print(f"✅ Found user: {user.email}")
        print(f"Before: tokens_month={user.tokens_used_this_month}, tokens_total={user.tokens_used_total}")
        
        # Try tracking 1000 tokens
        try:
            await track_token_usage(db, user, 1000)
            print(f"✅ Token tracking succeeded!")
            
            # Refresh user to see updated values
            await db.refresh(user)
            print(f"After: tokens_month={user.tokens_used_this_month}, tokens_total={user.tokens_used_total}")
        except Exception as e:
            print(f"❌ Token tracking failed: {e}")
            import traceback
            traceback.print_exc()


if __name__ == "__main__":
    asyncio.run(test_token_tracking())
