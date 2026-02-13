"""
Migration script to set up Supabase PostgreSQL database.
This script will:
1. Create all tables in Supabase
2. Optionally migrate existing SQLite data to PostgreSQL
"""
import asyncio
import os
import sys

import argparse

# Load .env manually to ensure we get credentials
try:
    with open(".env", "r") as f:
        for line in f:
            if line.strip() and not line.startswith("#"):
                try:
                    key, value = line.strip().split("=", 1)
                    os.environ[key] = value
                except ValueError:
                    pass
except FileNotFoundError:
    pass

# Parse arguments
parser = argparse.ArgumentParser(description="Migrate to Supabase PostgreSQL")
parser.add_argument("--url", help="Database URL (overrides env var)")
parser.add_argument("--migrate-data", action="store_true", help="Migrate data from SQLite")
parser.add_argument("--check-connection", action="store_true", help="Check connection only")
args = parser.parse_args()

# Set environment to use Supabase
# Prioritize CLI arg, then SUPABASE_DATABASE_URL, then configured DATABASE_URL if it looks like postgres
db_url = args.url or os.environ.get("SUPABASE_DATABASE_URL")
if not db_url and "postgresql" in os.environ.get("DATABASE_URL", ""):
    db_url = os.environ.get("DATABASE_URL")

if not db_url:
    print("❌ Error: Verification failed. No PostgreSQL URL found.")
    print("   Please set SUPABASE_DATABASE_URL in .env or pass --url")
    sys.exit(1)

os.environ["DATABASE_URL"] = db_url

from database import engine, Base, AsyncSessionLocal
from models import user, diagram  # Import to register models
from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import select


async def create_tables():
    """Create all tables in Supabase PostgreSQL."""
    print("🔄 Creating tables in Supabase PostgreSQL...")
    async with engine.begin() as conn:
        # Drop all tables first (fresh start)
        # await conn.run_sync(Base.metadata.drop_all)
        # Create all tables
        await conn.run_sync(Base.metadata.create_all)
    print("✅ Tables created successfully!")


async def migrate_from_sqlite():
    """Migrate data from SQLite to PostgreSQL (optional)."""
    sqlite_url = "sqlite+aiosqlite:///./architectai.db"
    
    # Check if SQLite database exists
    import os.path
    if not os.path.exists("architectai.db"):
        print("ℹ️  No SQLite database found. Skipping data migration.")
        return
    
    print("🔄 Migrating data from SQLite to PostgreSQL...")
    
    # Create SQLite engine
    sqlite_engine = create_async_engine(sqlite_url, echo=False)
    
    # Import models
    from models.user import User
    from models.diagram import Diagram
    
    async with AsyncSessionLocal() as pg_session:
        # Migrate users
        async with sqlite_engine.connect() as sqlite_conn:
            from sqlalchemy.orm import sessionmaker
            from sqlalchemy.ext.asyncio import AsyncSession
            
            SQLiteSession = sessionmaker(sqlite_engine, class_=AsyncSession, expire_on_commit=False)
            
            async with SQLiteSession() as sqlite_session:
                # Get all users from SQLite
                result = await sqlite_session.execute(select(User))
                users = result.scalars().all()
                
                print(f"  📊 Found {len(users)} users to migrate")
                
                # Add to PostgreSQL
                for user in users:
                    # Detach from SQLite session
                    sqlite_session.expunge(user)
                    # Reset primary key for PostgreSQL
                    existing = await pg_session.execute(
                        select(User).where(User.email == user.email)
                    )
                    if existing.scalar_one_or_none():
                        print(f"  ⏭️  User {user.email} already exists, skipping")
                        continue
                    
                    pg_session.add(user)
                    print(f"  ✅ Migrated user: {user.email}")
                
                await pg_session.commit()
                
                # Get all diagrams from SQLite
                result = await sqlite_session.execute(select(Diagram))
                diagrams = result.scalars().all()
                
                print(f"  📊 Found {len(diagrams)} diagrams to migrate")
                
                # Add to PostgreSQL
                for diagram in diagrams:
                    sqlite_session.expunge(diagram)
                    pg_session.add(diagram)
                
                await pg_session.commit()
                print(f"  ✅ Migrated {len(diagrams)} diagrams")
    
    print("✅ Data migration completed!")


async def test_connection():
    """Test connection to Supabase."""
    print("🔄 Testing Supabase connection...")
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(1))
        value = result.scalar()
        assert value == 1
    print("✅ Connection successful!")


async def main():
    """Main migration function."""
    print("=" * 60)
    print("🚀 Supabase PostgreSQL Migration")
    print("=" * 60)
    
    try:
        # Test connection first
        await test_connection()
        if args.check_connection:
            return

        # Create tables
        await create_tables()
        
        # Migrate data if requested
        if args.migrate_data:
            await migrate_from_sqlite()
        else:
            print("\nℹ️  To migrate existing SQLite data, run:")
            print("   python migrate_supabase.py --migrate-data")
        
        print("\n" + "=" * 60)
        print("✅ Migration completed successfully!")
        print("=" * 60)
        print("\n📝 Next steps:")
        print("1. Update your Render Environment Variables with:")
        print(f"   DATABASE_URL={db_url}")
        print("2. Restart your backend after deployment")
        
    except Exception as e:
        print(f"\n❌ Migration failed: {e}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == "__main__":
    asyncio.run(main())
