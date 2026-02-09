"""
Database configuration and session management.
"""
from typing import AsyncGenerator

from sqlalchemy.ext.asyncio import create_async_engine, async_sessionmaker, AsyncSession
from sqlalchemy.orm import DeclarativeBase

from config import DATABASE_URL, ENVIRONMENT

connect_args = {"check_same_thread": False} if "sqlite" in DATABASE_URL else {}

engine = create_async_engine(
    DATABASE_URL,
    echo=(ENVIRONMENT == "development"),
    connect_args=connect_args,
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

async def init_db() -> None:
    """Create tables if they don't exist. For schema changes (e.g. auth migration),
    delete architectai.db and restart to recreate tables."""
    async with engine.begin() as conn:
        # Import models so they are registered in metadata
        from models import user, diagram  # noqa: F401
        await conn.run_sync(Base.metadata.create_all)
