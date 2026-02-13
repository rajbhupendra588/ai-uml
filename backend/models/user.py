from enum import Enum as PyEnum
from sqlalchemy import String, Integer, DateTime, BigInteger
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime

from database import Base


class PlanType(str, PyEnum):
    FREE = "free"
    PRO = "pro"
    TEAM = "team"


class User(Base):
    __tablename__ = "users"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    email: Mapped[str] = mapped_column(String(255), unique=True, nullable=False, index=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=True)  # Nullable for GitHub-only users
    username: Mapped[str] = mapped_column(String(100), nullable=True)
    github_id: Mapped[int] = mapped_column(Integer, unique=True, nullable=True, index=True)
    avatar_url: Mapped[str] = mapped_column(String(255), nullable=True)

    plan: Mapped[str] = mapped_column(String(20), default=PlanType.FREE.value)
    diagrams_this_month: Mapped[int] = mapped_column(Integer, default=0)
    last_reset_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Token usage tracking
    tokens_used_this_month: Mapped[int] = mapped_column(BigInteger, default=0)
    tokens_used_total: Mapped[int] = mapped_column(BigInteger, default=0)
    
    # Razorpay customer ID
    razorpay_customer_id: Mapped[str] = mapped_column(String(100), nullable=True, unique=True)

    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())

    # Relationships
    diagrams = relationship("Diagram", back_populates="user", cascade="all, delete-orphan")
    subscriptions = relationship("Subscription", back_populates="user", cascade="all, delete-orphan")
    payments = relationship("Payment", back_populates="user", cascade="all, delete-orphan")

