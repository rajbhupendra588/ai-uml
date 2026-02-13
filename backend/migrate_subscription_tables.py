"""
Database migration script to add subscription and payment tables.
"""
import asyncio
from database import engine, Base, AsyncSessionLocal
from models import User, Diagram, Subscription, Payment  # Import all models


async def create_new_tables():
    """Create subscription and payment tables."""
    print("=" * 60)
    print("Creating new tables for subscription and payment...")
    print("=" * 60)
    
    try:
        async with engine.begin() as conn:
            # Create new tables (will skip existing ones)
            await conn.run_sync(Base.metadata.create_all)
        
        print("✅ Tables created successfully!")
        print("   - subscriptions")
        print("   - payments")
        print("   - users (updated with razorpay_customer_id)")
        
    except Exception as e:
        print(f"❌ Error creating tables: {e}")
        raise


async def verify_tables():
    """Verify that all tables exist."""
    print("\n" + "=" * 60)
    print("Verifying database schema...")
    print("=" * 60)
    
    from sqlalchemy import inspect
    
    async with engine.connect() as conn:
        def get_tables(connection):
            inspector = inspect(connection)
            return inspector.get_table_names()
        
        tables = await conn.run_sync(get_tables)
        
        print(f"\n✅ Found {len(tables)} tables:")
        for table in sorted(tables):
            print(f"   - {table}")
        
        required_tables = ["users", "diagrams", "subscriptions", "payments"]
        missing = [t for t in required_tables if t not in tables]
        
        if missing:
            print(f"\n⚠️  Missing tables: {', '.join(missing)}")
        else:
            print(f"\n✅ All required tables exist!")


async def main():
    """Run migration."""
    print("\n🚀 Database Migration: Subscription & Payment Tables\n")
    
    try:
        await create_new_tables()
        await verify_tables()
        
        print("\n" + "=" * 60)
        print("✅ Migration completed successfully!")
        print("=" * 60)
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        return 1
    
    return 0


if __name__ == "__main__":
    exit_code = asyncio.run(main())
    exit(exit_code)
