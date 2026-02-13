"""
Test Supabase connection with SSL and IPv4 configuration.
"""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import select

async def test_connection_with_params():
    """Test connection with SSL parameters."""
    
    # Try with SSL parameters
    url = "postgresql+asyncpg://postgres:MySecurePassword123!@db.nkcjuwoltqcvaiutpdkj.supabase.co:5432/postgres"
    
    # Add SSL and connection parameters
    connect_args = {
        "ssl": "require",
        "server_settings": {
            "application_name": "architectai_migration"
        }
    }
    
    print("=" * 60)
    print("Testing Supabase connection with SSL parameters...")
    print("=" * 60)
    
    try:
        print(f"\n🔄 Connecting to Supabase...")
        engine = create_async_engine(
            url,
            echo=True,
            connect_args=connect_args
        )
        
        async with engine.begin() as conn:
            result = await conn.execute(select(1))
            value = result.scalar()
            
        print(f"\n✅ CONNECTION SUCCESSFUL!")
        print(f"   Test query returned: {value}")
        
        await engine.dispose()
        return True
        
    except Exception as e:
        print(f"\n❌ Connection failed: {e}")
        print(f"\nError type: {type(e).__name__}")
        
        # Try without SSL requirement
        print("\n🔄 Trying without SSL requirement...")
        try:
            engine2 = create_async_engine(url, echo=False)
            async with engine2.begin() as conn:
                result = await conn.execute(select(1))
                value = result.scalar()
            
            print(f"✅ Connection successful without SSL!")
            await engine2.dispose()
            return True
        except Exception as e2:
            print(f"❌ Also failed without SSL: {e2}")
            await engine2.dispose()
        
        return False


if __name__ == "__main__":
    success = asyncio.run(test_connection_with_params())
    
    if not success:
        print("\n" + "=" * 60)
        print("⚠️  RECOMMENDATION: Use SQLite for now")
        print("=" * 60)
        print("\nThe Supabase connection is having network issues.")
        print("We have two options:")
        print("\n1. Continue with SQLite locally (works fine for development)")
        print("2. Add Render PostgreSQL later when deploying")
        print("\nFor now, let's focus on implementing the pricing features")
        print("and we can migrate to PostgreSQL when deploying to Render.")
