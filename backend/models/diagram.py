from sqlalchemy import String, Integer, DateTime, ForeignKey, Text, JSON
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.sql import func
from datetime import datetime

from database import Base

class Diagram(Base):
    __tablename__ = "diagrams"
    
    id: Mapped[int] = mapped_column(Integer, primary_key=True)
    user_id: Mapped[int] = mapped_column(ForeignKey("users.id"), index=True)
    
    title: Mapped[str] = mapped_column(String(255), nullable=True)
    diagram_type: Mapped[str] = mapped_column(String(50), nullable=True) # architecture, sequence, etc.
    mermaid_code: Mapped[str] = mapped_column(Text, nullable=True)
    
    # Store full plan/LLM output for restoring context or "Continue editing"
    diagram_data: Mapped[dict] = mapped_column(JSON, nullable=True) 
    
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now(), onupdate=func.now())
    
    user = relationship("User", back_populates="diagrams")
