"""
Database configuration and session management.
"""
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from config import DATABASE_URL, ENVIRONMENT

connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}

# For Postgres/Supabase: avoid using connections closed by server or client disconnect.
import ssl
# pre_ping: test connection before use; recycle: replace connections before server idle timeout.
def _create_ssl_context():
    context = ssl.create_default_context()
    context.check_hostname = False
    context.verify_mode = ssl.CERT_NONE
    return context

engine = create_async_engine(
    DATABASE_URL,
    echo=(ENVIRONMENT == "development"),
    # ssl=True verifies certs by default. For some poolers (Supabase Transaction Mode),
    # self-signed certs in the chain might fail verification.
    # We disable verification if needed for connectivity.
    connect_args={"ssl": _create_ssl_context()} if "sqlite" not in DATABASE_URL else connect_args,
    pool_pre_ping=True,
    pool_recycle=300 if "sqlite" not in DATABASE_URL else -1,
    pool_size=10,
    max_overflow=20,
)

AsyncSessionLocal = async_sessionmaker(
    bind=engine,
    expire_on_commit=False,
    class_=AsyncSession,
    autoflush=False,
)

class Base(DeclarativeBase):
    pass

async def get_db() -> AsyncGenerator[AsyncSession, None]:
    """Dependency for getting DB session."""
    async with AsyncSessionLocal() as session:
        yield session

def _add_missing_user_columns(sync_conn):
    """Add missing columns to users table (SQLite). Safe to run multiple times."""
    from sqlalchemy import text
    if "sqlite" not in DATABASE_URL:
        return
    for sql in [
        "ALTER TABLE users ADD COLUMN tokens_used_this_month BIGINT DEFAULT 0",
        "ALTER TABLE users ADD COLUMN tokens_used_total BIGINT DEFAULT 0",
        "ALTER TABLE users ADD COLUMN razorpay_customer_id VARCHAR(100) NULL UNIQUE",
    ]:
        try:
            sync_conn.execute(text(sql))
        except Exception:
            # Column already exists or table doesn't exist yet
            pass


async def init_db() -> None:
    """Create tables if they don't exist. For schema changes (e.g. auth migration),
    delete architectai.db and restart to recreate tables."""
    async with engine.begin() as conn:
        # Import models so they are registered in metadata
        from models import user, diagram  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
        await conn.run_sync(_add_missing_user_columns)