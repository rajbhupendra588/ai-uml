"""
Payment model for tracking individual payment transactions.
"""
from datetime import datetime
from sqlalchemy import Column, Integer, String, DateTime, ForeignKey, Float
from sqlalchemy.orm import relationship

from database import Base


class Payment(Base):
    """Payment transaction model."""
    __tablename__ = "payments"

    id = Column(Integer, primary_key=True, index=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    subscription_id = Column(Integer, ForeignKey("subscriptions.id"), nullable=True)
    
    # Razorpay payment details
    razorpay_payment_id = Column(String, unique=True, nullable=False, index=True)
    razorpay_order_id = Column(String, nullable=True)
    
    # Payment amount (in paise for INR, cents for USD, etc.)
    amount = Column(Integer, nullable=False)
    currency = Column(String, default="INR", nullable=False)
    
    # Payment status: created, authorized, captured, failed, refunded
    status = Column(String, nullable=False)
    
    # Payment method: card, upi, netbanking, wallet
    method = Column(String, nullable=True)
    
    # Timestamps
    created_at = Column(DateTime, default=datetime.utcnow, nullable=False)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow, nullable=False)
    
    # Relationships
    user = relationship("User", back_populates="payments")
    subscription = relationship("Subscription", back_populates="payments")

    def __repr__(self):
        return f"<Payment(id={self.id}, amount={self.amount}, status={self.status})>"
    
    @property
    def amount_in_currency(self) -> float:
        """Return amount in actual currency (not paise/cents)."""
        return self.amount / 100
