"""
Razorpay service for handling subscription and payment operations.
Production-grade: signature verification, error handling, logging.
"""
import os
import logging
import razorpay
from typing import Dict, Any, Optional

logger = logging.getLogger("architectai")

# Initialize Razorpay client
RAZORPAY_KEY_ID = os.getenv("RAZORPAY_KEY_ID", "")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "")

client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))


class RazorpayService:
    """Service for Razorpay operations."""

    # ── Customer ──────────────────────────────────────────────────────

    @staticmethod
    def create_customer(email: str, name: Optional[str] = None) -> Dict[str, Any]:
        """Create a Razorpay customer (idempotent – won't fail for existing)."""
        customer_data = {
            "email": email,
            "fail_existing": "0",
        }
        if name:
            customer_data["name"] = name

        customer = client.customer.create(data=customer_data)
        logger.info("razorpay_customer_created", extra={"customer_id": customer.get("id"), "email": email})
        return customer

    # ── Subscription ──────────────────────────────────────────────────

    @staticmethod
    def create_subscription(
        plan_id: str,
        customer_id: str,
        total_count: int = 12,
    ) -> Dict[str, Any]:
        """Create a Razorpay subscription."""
        subscription_data = {
            "plan_id": plan_id,
            "customer_id": customer_id,
            "total_count": total_count,
            "quantity": 1,
        }

        subscription = client.subscription.create(data=subscription_data)
        logger.info(
            "razorpay_subscription_created",
            extra={"subscription_id": subscription.get("id"), "plan_id": plan_id},
        )
        return subscription

    @staticmethod
    def fetch_subscription(subscription_id: str) -> Dict[str, Any]:
        """Fetch subscription details from Razorpay."""
        return client.subscription.fetch(subscription_id)

    @staticmethod
    def cancel_subscription(subscription_id: str, cancel_at_cycle_end: bool = True) -> Dict[str, Any]:
        """Cancel a subscription. Optionally cancel at end of current billing cycle."""
        result = client.subscription.cancel(
            subscription_id,
            data={"cancel_at_cycle_end": 1 if cancel_at_cycle_end else 0},
        )
        logger.info(
            "razorpay_subscription_cancelled",
            extra={"subscription_id": subscription_id, "at_cycle_end": cancel_at_cycle_end},
        )
        return result

    # ── Payment ───────────────────────────────────────────────────────

    @staticmethod
    def fetch_payment(payment_id: str) -> Dict[str, Any]:
        """Fetch payment details from Razorpay."""
        return client.payment.fetch(payment_id)

    # ── Signature Verification ────────────────────────────────────────

    @staticmethod
    def verify_payment_signature(
        razorpay_payment_id: str,
        razorpay_subscription_id: str,
        razorpay_signature: str,
    ) -> bool:
        """
        Verify the subscription payment signature returned by Razorpay Checkout.

        Uses the SDK's subscription verification (HMAC-SHA256 over
        payment_id|subscription_id). For one-time orders use verify_order_signature.

        Returns True if valid, False otherwise.
        """
        try:
            client.utility.verify_subscription_payment_signature({
                "razorpay_payment_id": razorpay_payment_id,
                "razorpay_subscription_id": razorpay_subscription_id,
                "razorpay_signature": razorpay_signature,
            })
            logger.info(
                "razorpay_signature_verified",
                extra={"payment_id": razorpay_payment_id, "subscription_id": razorpay_subscription_id},
            )
            return True
        except razorpay.errors.SignatureVerificationError:
            logger.warning(
                "razorpay_signature_invalid",
                extra={"payment_id": razorpay_payment_id, "subscription_id": razorpay_subscription_id},
            )
            return False

    @staticmethod
    def verify_webhook_signature(
        webhook_body: bytes,
        webhook_signature: str,
        webhook_secret: str,
    ) -> bool:
        """Verify Razorpay webhook signature (server-to-server)."""
        try:
            client.utility.verify_webhook_signature(
                webhook_body.decode("utf-8"),
                webhook_signature,
                webhook_secret,
            )
            return True
        except razorpay.errors.SignatureVerificationError:
            logger.warning("razorpay_webhook_signature_invalid")
            return False


# Plan IDs – create in Razorpay Dashboard (same mode as API keys: Test ↔ Test, Live ↔ Live)
RAZORPAY_PLAN_PRO_MONTHLY = os.getenv("RAZORPAY_PLAN_PRO_MONTHLY", "plan_pro_monthly")
RAZORPAY_PLAN_PRO_ANNUAL = os.getenv("RAZORPAY_PLAN_PRO_ANNUAL", "plan_pro_annual")
RAZORPAY_PLANS = {
    "pro_monthly": RAZORPAY_PLAN_PRO_MONTHLY,
    "pro_annual": RAZORPAY_PLAN_PRO_ANNUAL,
}
