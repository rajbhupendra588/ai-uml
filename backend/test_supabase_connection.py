"""Test Supabase connection with different configurations."""
import asyncio
from sqlalchemy.ext.asyncio import create_async_engine

async def test_connection(url: str):
    """Test connection with given URL."""
    print(f"Testing: {url[:50]}...")
    try:
        engine = create_async_engine(url, echo=False)
        async with engine.begin() as conn:
            result = await conn.execute(select(1))
            print("✅ Connection successful!")
            return True
    except Exception as e:
        print(f"❌ Failed: {e}")
        return False
    finally:
        await engine.dispose()

async def main():
    from sqlalchemy import select
    
    base_url = "db.nkcjuwoltqcvaiutpdkj.supabase.co"
    password = "MySecurePassword123!"
    
    # Try different configurations
    configs = [
        # Direct connection (port 5432)
        f"postgresql+asyncpg://postgres:{password}@{base_url}:5432/postgres",
        
        # Transaction pooler (port 6543)
        f"postgresql+asyncpg://postgres.nkcjuwoltqcvaiutpdkj:{password}@aws-0-ap-south-1.pooler.supabase.com:6543/postgres",
        
        # Session pooler (port 5432)
        f"postgresql+asyncpg://postgres.nkcjuwoltqcvaiutpdkj:{password}@aws-0-ap-south-1.pooler.supabase.com:5432/postgres",
    ]
    
    print("=" * 60)
    print("Testing Supabase connection configurations...")
    print("=" * 60)
    
    for i, url in enumerate(configs, 1):
        print(f"\nConfig {i}:")
        if await test_connection(url):
            print(f"\n✅ SUCCESS! Use this connection string:")
            print(f"   {url}")
            break
    else:
        print("\n❌ All configurations failed.")
        print("\n📝 Please check Supabase dashboard for the correct connection string:")
        print("   Project Settings → Database → Connection string")

if __name__ == "__main__":
    asyncio.run(main())
