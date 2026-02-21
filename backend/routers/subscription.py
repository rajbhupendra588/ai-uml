"""
Subscription API endpoints for Razorpay integration.
Production-grade: create, verify, cancel, status, webhooks.
"""
from fastapi import APIRouter, Depends, HTTPException, Request, Header
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy import select
from pydantic import BaseModel
from typing import Optional
from datetime import datetime
import os
import logging

from database import get_db
from models import User, Subscription, Payment
from routers.auth import get_current_user_required
from services.razorpay_service import RazorpayService, RAZORPAY_PLANS

logger = logging.getLogger("architectai")
router = APIRouter(prefix="/subscription", tags=["subscription"])


# ── Request / Response schemas ────────────────────────────────────────

class CreateSubscriptionRequest(BaseModel):
    plan_type: str  # "pro_monthly" or "pro_annual"


class VerifyPaymentRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_subscription_id: str
    razorpay_signature: str


class SubscriptionResponse(BaseModel):
    subscription_id: str
    status: str
    plan_id: str
    current_period_start: datetime
    current_period_end: datetime
    key_id: str  # Razorpay Key ID for frontend
    short_url: Optional[str] = None  # Razorpay checkout URL


class CancelSubscriptionRequest(BaseModel):
    cancel_at_period_end: bool = True


class PaymentResponse(BaseModel):
    id: int
    razorpay_payment_id: str
    amount: float
    currency: str
    status: str
    method: Optional[str] = None
    created_at: datetime


# ── POST /create ──────────────────────────────────────────────────────

@router.post("/create", response_model=SubscriptionResponse)
async def create_subscription(
    request: CreateSubscriptionRequest,
    current_user: User = Depends(get_current_user_required),
    db: AsyncSession = Depends(get_db),
):
    """Create a new Razorpay subscription for the user."""
    logger.info(
        "subscription_create: request",
        extra={"user_id": current_user.id, "plan_type": request.plan_type},
    )

    # ── Guard: active subscription already exists ──
    existing_sub = await db.execute(
        select(Subscription).where(
            Subscription.user_id == current_user.id,
            Subscription.status == "active",
        )
    )
    if existing_sub.scalar_one_or_none():
        logger.warning(
            "subscription_create: 400 - user already has active subscription",
            extra={"user_id": current_user.id},
        )
        raise HTTPException(status_code=400, detail="You already have an active subscription.")

    # ── Get or create Razorpay customer ──
    if not current_user.razorpay_customer_id:
        import time
        last_err = None
        for attempt in range(3):
            try:
                customer = RazorpayService.create_customer(
                    email=current_user.email,
                    name=current_user.username or current_user.email.split("@")[0],
                )
                current_user.razorpay_customer_id = customer["id"]
                db.add(current_user)
                await db.commit()
                last_err = None
                break
            except (ConnectionError, OSError) as e:
                last_err = e
                logger.warning(f"subscription_create: customer creation attempt {attempt+1} failed (connection): {e}")
                if attempt < 2:
                    time.sleep(1)
            except Exception as e:
                logger.error(f"subscription_create: failed to create customer: {e}")
                raise HTTPException(status_code=503, detail="Could not set up payment profile. Please try again.")
        if last_err:
            logger.error(f"subscription_create: customer creation failed after 3 attempts: {last_err}")
            raise HTTPException(status_code=503, detail="Could not reach payment provider. Please try again in a moment.")

    # ── Resolve plan ──
    plan_id = RAZORPAY_PLANS.get(request.plan_type)
    if not plan_id:
        raise HTTPException(
            status_code=400,
            detail=f"Invalid plan type: {request.plan_type}. Use pro_monthly or pro_annual.",
        )

    # Set duration. For an apparently infinite monthly plan, Razorpay recommends setting a high count.
    total_count = 12 if "annual" in request.plan_type else 120

    # ── Create subscription on Razorpay (with retry on stale customer) ──
    razorpay_sub = await _create_razorpay_subscription(
        plan_id=plan_id,
        total_count=total_count,
        current_user=current_user,
        db=db,
    )

    # ── Persist to DB ──
    now_ts = int(datetime.utcnow().timestamp())
    start_ts = razorpay_sub.get("current_start") or razorpay_sub.get("start_at") or now_ts
    end_ts = razorpay_sub.get("current_end") or razorpay_sub.get("charge_at") or now_ts

    subscription = Subscription(
        user_id=current_user.id,
        razorpay_subscription_id=razorpay_sub["id"],
        razorpay_plan_id=plan_id,
        status=razorpay_sub["status"],
        current_period_start=datetime.fromtimestamp(start_ts),
        current_period_end=datetime.fromtimestamp(end_ts),
    )
    db.add(subscription)
    await db.commit()
    await db.refresh(subscription)

    logger.info(
        "subscription_create: success",
        extra={
            "user_id": current_user.id,
            "razorpay_sub_id": razorpay_sub["id"],
            "status": razorpay_sub["status"],
        },
    )

    return SubscriptionResponse(
        subscription_id=subscription.razorpay_subscription_id,
        status=subscription.status,
        plan_id=subscription.razorpay_plan_id,
        current_period_start=subscription.current_period_start,
        current_period_end=subscription.current_period_end,
        key_id=os.getenv("RAZORPAY_KEY_ID", ""),
        short_url=razorpay_sub.get("short_url"),
    )


async def _create_razorpay_subscription(
    plan_id: str,
    total_count: int,
    current_user: User,
    db: AsyncSession,
) -> dict:
    """
    Internal helper: tries to create a Razorpay subscription.
    If the customer id is stale (test↔live mismatch), it retries with a fresh customer.
    """
    import razorpay
    try:
        return RazorpayService.create_subscription(
            plan_id=plan_id,
            customer_id=current_user.razorpay_customer_id,
            total_count=total_count,
        )
    except razorpay.errors.ServerError as e:
        logger.warning(f"subscription_create: Razorpay ServerError: {e}")
        raise HTTPException(
            status_code=503,
            detail="Payment provider is temporarily unavailable. Please try again in a few minutes.",
        ) from e
    except razorpay.errors.GatewayError as e:
        logger.warning(f"subscription_create: Razorpay GatewayError: {e}")
        raise HTTPException(
            status_code=503,
            detail="Payment gateway error. Please try again in a few minutes.",
        ) from e
    except razorpay.errors.BadRequestError as e:
        msg = str(e).lower()
        # Stale customer (test↔live switch) or transient error – retry with fresh customer
        if ("does not exist" in msg or "server encountered an error" in msg) and current_user.razorpay_customer_id:
            logger.info("subscription_create: retrying with fresh Razorpay customer")
            current_user.razorpay_customer_id = None
            db.add(current_user)
            await db.commit()
            customer = RazorpayService.create_customer(
                email=current_user.email,
                name=current_user.username or current_user.email.split("@")[0],
            )
            current_user.razorpay_customer_id = customer["id"]
            db.add(current_user)
            await db.commit()
            try:
                return RazorpayService.create_subscription(
                    plan_id=plan_id,
                    customer_id=current_user.razorpay_customer_id,
                    total_count=total_count,
                )
            except razorpay.errors.BadRequestError as e2:
                logger.error(f"subscription_create: retry also failed: {e2}")
                raise HTTPException(
                    status_code=400,
                    detail=(
                        "Plans may have been created in a different Razorpay mode (Test vs Live). "
                        "Check Razorpay Dashboard → Plans match your API key mode. "
                        f"Error: {e2}"
                    ),
                ) from e2
        else:
            raise HTTPException(status_code=400, detail=f"Payment setup failed: {e}") from e
    except ConnectionError as e:
        logger.error(f"subscription_create: connection error to Razorpay: {e}")
        raise HTTPException(
            status_code=503,
            detail="Could not reach payment provider. Check your internet connection and try again.",
        ) from e


# ── POST /verify ──────────────────────────────────────────────────────

@router.post("/verify")
async def verify_payment(
    request: VerifyPaymentRequest,
    current_user: User = Depends(get_current_user_required),
    db: AsyncSession = Depends(get_db),
):
    """
    Verify Razorpay payment signature after checkout completes.

    This is the PRIMARY path for activating subscriptions. Webhooks serve as
    a backup/sync mechanism for edge cases (browser close, recurring charges, etc.).
    """
    logger.info(
        "subscription_verify: request",
        extra={
            "user_id": current_user.id,
            "payment_id": request.razorpay_payment_id,
            "subscription_id": request.razorpay_subscription_id,
        },
    )

    # ── Step 1: Verify Razorpay signature ──
    is_valid = RazorpayService.verify_payment_signature(
        razorpay_payment_id=request.razorpay_payment_id,
        razorpay_subscription_id=request.razorpay_subscription_id,
        razorpay_signature=request.razorpay_signature,
    )

    if not is_valid:
        logger.warning(
            "subscription_verify: INVALID signature",
            extra={"user_id": current_user.id, "payment_id": request.razorpay_payment_id},
        )
        raise HTTPException(
            status_code=400,
            detail="Payment signature verification failed. The transaction may have been tampered with.",
        )

    # ── Step 2: Find the subscription in DB ──
    result = await db.execute(
        select(Subscription).where(
            Subscription.razorpay_subscription_id == request.razorpay_subscription_id,
            Subscription.user_id == current_user.id,
        )
    )
    subscription = result.scalar_one_or_none()

    if not subscription:
        logger.error(
            "subscription_verify: subscription not found in DB",
            extra={
                "user_id": current_user.id,
                "razorpay_subscription_id": request.razorpay_subscription_id,
            },
        )
        raise HTTPException(status_code=404, detail="Subscription not found.")

    # ── Step 3: Idempotency – already verified? ──
    if subscription.status == "active":
        logger.info(
            "subscription_verify: already active (idempotent)",
            extra={"subscription_id": subscription.razorpay_subscription_id},
        )
        return {"status": "success", "message": "Subscription is already active."}

    # ── Step 4: Activate subscription ──
    subscription.status = "active"
    db.add(subscription)

    # Upgrade user plan
    current_user.plan = "pro"
    db.add(current_user)

    # ── Step 5: Record payment (idempotent check) ──
    existing_payment = await db.execute(
        select(Payment).where(Payment.razorpay_payment_id == request.razorpay_payment_id)
    )
    if not existing_payment.scalar_one_or_none():
        # Try to fetch payment details from Razorpay for accurate amount/method
        try:
            rzp_payment = RazorpayService.fetch_payment(request.razorpay_payment_id)
            amount = rzp_payment.get("amount", 0)
            currency = rzp_payment.get("currency", "INR")
            method = rzp_payment.get("method")
            razorpay_order_id = rzp_payment.get("order_id")
        except Exception as fetch_err:
            logger.warning(f"subscription_verify: could not fetch payment details: {fetch_err}")
            amount = 0
            currency = "INR"
            method = None
            razorpay_order_id = None

        payment = Payment(
            user_id=current_user.id,
            subscription_id=subscription.id,
            razorpay_payment_id=request.razorpay_payment_id,
            razorpay_order_id=razorpay_order_id,
            amount=amount,
            currency=currency,
            status="captured",
            method=method,
        )
        db.add(payment)

    await db.commit()

    logger.info(
        "subscription_verify: SUCCESS – subscription activated",
        extra={
            "user_id": current_user.id,
            "subscription_id": subscription.razorpay_subscription_id,
            "payment_id": request.razorpay_payment_id,
        },
    )

    return {"status": "success", "message": "Payment verified! Your Pro subscription is now active."}


# ── GET /status ───────────────────────────────────────────────────────

@router.get("/status")
async def get_subscription_status(
    current_user: User = Depends(get_current_user_required),
    db: AsyncSession = Depends(get_db),
):
    """Get current user's subscription status."""
    result = await db.execute(
        select(Subscription)
        .where(Subscription.user_id == current_user.id)
        .order_by(Subscription.created_at.desc())
    )
    subscription = result.scalar_one_or_none()

    if not subscription:
        return {"has_subscription": False, "plan": current_user.plan}

    return {
        "has_subscription": True,
        "subscription_id": subscription.razorpay_subscription_id,
        "status": subscription.status,
        "plan_id": subscription.razorpay_plan_id,
        "current_period_start": subscription.current_period_start,
        "current_period_end": subscription.current_period_end,
        "cancel_at_period_end": subscription.cancel_at_period_end,
        "plan": current_user.plan,
    }


# ── GET /payments ─────────────────────────────────────────────────────

@router.get("/payments", response_model=list[PaymentResponse])
async def get_payments(
    current_user: User = Depends(get_current_user_required),
    db: AsyncSession = Depends(get_db),
):
    """Get all payment transactions for the current user."""
    result = await db.execute(
        select(Payment)
        .where(Payment.user_id == current_user.id)
        .order_by(Payment.created_at.desc())
    )
    payments = result.scalars().all()
    
    return [
        PaymentResponse(
            id=p.id,
            razorpay_payment_id=p.razorpay_payment_id,
            amount=p.amount_in_currency,
            currency=p.currency,
            status=p.status,
            method=p.method,
            created_at=p.created_at
        ) for p in payments
    ]


# ── POST /cancel ──────────────────────────────────────────────────────


@router.post("/cancel")
async def cancel_subscription(
    request: CancelSubscriptionRequest,
    current_user: User = Depends(get_current_user_required),
    db: AsyncSession = Depends(get_db),
):
    """Cancel user's subscription."""
    result = await db.execute(
        select(Subscription).where(
            Subscription.user_id == current_user.id,
            Subscription.status == "active",
        )
    )
    subscription = result.scalar_one_or_none()

    if not subscription:
        raise HTTPException(status_code=404, detail="No active subscription found.")

    try:
        RazorpayService.cancel_subscription(
            subscription.razorpay_subscription_id,
            cancel_at_cycle_end=request.cancel_at_period_end,
        )
    except Exception as e:
        error_msg = str(e).lower()
        if "not cancellable" in error_msg or "already cancelled" in error_msg:
            logger.info(f"subscription_cancel: Subscription already cancelled or completed on Razorpay: {e}")
            # we can safely proceed to update our database
        else:
            logger.error(f"subscription_cancel: Razorpay error: {e}")
            raise HTTPException(status_code=400, detail=f"Could not cancel subscription. Provider error: {e}")

    subscription.cancel_at_period_end = request.cancel_at_period_end
    if not request.cancel_at_period_end:
        subscription.status = "cancelled"
        subscription.cancelled_at = datetime.utcnow()
        current_user.plan = "free"
        db.add(current_user)

    db.add(subscription)
    await db.commit()

    return {
        "message": "Subscription cancelled successfully.",
        "cancel_at_period_end": request.cancel_at_period_end,
        "cancelled_at": subscription.cancelled_at,
    }


# ── POST /webhooks/razorpay ──────────────────────────────────────────

@router.post("/webhooks/razorpay")
async def razorpay_webhook(
    request: Request,
    db: AsyncSession = Depends(get_db),
    x_razorpay_signature: str = Header(None),
):
    """
    Handle Razorpay webhook events.
    These are server-to-server callbacks for events that happen outside the
    normal checkout flow: recurring charges, cancellations, refunds, failures.
    """
    webhook_secret = os.getenv("RAZORPAY_WEBHOOK_SECRET", "")
    if not webhook_secret:
        logger.error("webhook: RAZORPAY_WEBHOOK_SECRET not configured")
        raise HTTPException(status_code=500, detail="Webhook secret not configured.")

    body = await request.body()

    # ── Signature verification ──
    if not x_razorpay_signature or not RazorpayService.verify_webhook_signature(
        body, x_razorpay_signature, webhook_secret
    ):
        logger.warning("webhook: invalid signature – ignoring event")
        raise HTTPException(status_code=400, detail="Invalid webhook signature.")

    event = await request.json()
    event_type = event.get("event")
    payload = event.get("payload", {})

    logger.info("webhook: received", extra={"event_type": event_type})

    # ── Dispatch ──
    if event_type == "subscription.activated":
        await _webhook_subscription_activated(payload, db)
    elif event_type == "subscription.charged":
        await _webhook_subscription_charged(payload, db)
    elif event_type == "subscription.cancelled":
        await _webhook_subscription_cancelled(payload, db)
    elif event_type == "payment.captured":
        await _webhook_payment_captured(payload, db)
    elif event_type == "payment.failed":
        await _webhook_payment_failed(payload, db)
    else:
        logger.info(f"webhook: unhandled event type '{event_type}'")

    return {"status": "ok"}


# ── Webhook handlers (idempotent) ─────────────────────────────────────

async def _webhook_subscription_activated(payload: dict, db: AsyncSession):
    """Subscription activated – ensure user is on Pro."""
    sub_entity = payload.get("subscription", {}).get("entity", {})
    sub_id = sub_entity.get("id")

    result = await db.execute(
        select(Subscription).where(Subscription.razorpay_subscription_id == sub_id)
    )
    subscription = result.scalar_one_or_none()

    if not subscription:
        logger.warning(f"webhook: subscription {sub_id} not found in DB – ignoring")
        return

    # Idempotent: skip if already active
    if subscription.status == "active":
        logger.info(f"webhook: subscription {sub_id} already active – no-op")
        return

    subscription.status = "active"
    if sub_entity.get("current_start"):
        subscription.current_period_start = datetime.fromtimestamp(sub_entity["current_start"])
    if sub_entity.get("current_end"):
        subscription.current_period_end = datetime.fromtimestamp(sub_entity["current_end"])

    user = await db.get(User, subscription.user_id)
    if user:
        user.plan = "pro"
        db.add(user)

    db.add(subscription)
    await db.commit()
    logger.info(f"webhook: subscription {sub_id} activated for user {subscription.user_id}")


async def _webhook_subscription_charged(payload: dict, db: AsyncSession):
    """Recurring charge succeeded – record payment."""
    payment_entity = payload.get("payment", {}).get("entity", {})
    sub_entity = payload.get("subscription", {}).get("entity", {})
    payment_id = payment_entity.get("id")

    if not payment_id:
        return

    # Idempotent: skip if payment already recorded
    existing = await db.execute(
        select(Payment).where(Payment.razorpay_payment_id == payment_id)
    )
    if existing.scalar_one_or_none():
        logger.info(f"webhook: payment {payment_id} already recorded – no-op")
        return

    result = await db.execute(
        select(Subscription).where(
            Subscription.razorpay_subscription_id == sub_entity.get("id")
        )
    )
    subscription = result.scalar_one_or_none()

    if subscription:
        payment = Payment(
            user_id=subscription.user_id,
            subscription_id=subscription.id,
            razorpay_payment_id=payment_id,
            razorpay_order_id=payment_entity.get("order_id"),
            amount=payment_entity.get("amount", 0),
            currency=payment_entity.get("currency", "INR"),
            status="captured",
            method=payment_entity.get("method"),
        )
        db.add(payment)

        # Update billing period if present
        if sub_entity.get("current_start"):
            subscription.current_period_start = datetime.fromtimestamp(sub_entity["current_start"])
        if sub_entity.get("current_end"):
            subscription.current_period_end = datetime.fromtimestamp(sub_entity["current_end"])
        db.add(subscription)

        await db.commit()
        logger.info(f"webhook: payment {payment_id} recorded for subscription {subscription.razorpay_subscription_id}")


async def _webhook_subscription_cancelled(payload: dict, db: AsyncSession):
    """Subscription cancelled – downgrade user."""
    sub_entity = payload.get("subscription", {}).get("entity", {})
    sub_id = sub_entity.get("id")

    result = await db.execute(
        select(Subscription).where(Subscription.razorpay_subscription_id == sub_id)
    )
    subscription = result.scalar_one_or_none()

    if not subscription:
        logger.warning(f"webhook: subscription {sub_id} not found – ignoring cancel")
        return

    if subscription.status == "cancelled":
        logger.info(f"webhook: subscription {sub_id} already cancelled – no-op")
        return

    subscription.status = "cancelled"
    subscription.cancelled_at = datetime.utcnow()

    user = await db.get(User, subscription.user_id)
    if user:
        user.plan = "free"
        db.add(user)

    db.add(subscription)
    await db.commit()
    logger.info(f"webhook: subscription {sub_id} cancelled, user {subscription.user_id} downgraded to free")


async def _webhook_payment_captured(payload: dict, db: AsyncSession):
    """Payment captured – mostly handled by subscription.charged, but log it."""
    payment_entity = payload.get("payment", {}).get("entity", {})
    logger.info(
        "webhook: payment.captured",
        extra={"payment_id": payment_entity.get("id"), "amount": payment_entity.get("amount")},
    )


async def _webhook_payment_failed(payload: dict, db: AsyncSession):
    """Payment failed – record the failed payment and log for monitoring."""
    payment_entity = payload.get("payment", {}).get("entity", {})
    payment_id = payment_entity.get("id")

    if not payment_id:
        return

    logger.warning(
        "webhook: payment.failed",
        extra={
            "payment_id": payment_id,
            "amount": payment_entity.get("amount"),
            "method": payment_entity.get("method"),
            "error_code": payment_entity.get("error_code"),
            "error_description": payment_entity.get("error_description"),
        },
    )

    # Record failed payment (idempotent)
    existing = await db.execute(
        select(Payment).where(Payment.razorpay_payment_id == payment_id)
    )
    if existing.scalar_one_or_none():
        return

    # Try to find user via subscription
    sub_id = payment_entity.get("subscription_id")
    user_id = None
    subscription_db_id = None
    if sub_id:
        result = await db.execute(
            select(Subscription).where(Subscription.razorpay_subscription_id == sub_id)
        )
        sub = result.scalar_one_or_none()
        if sub:
            user_id = sub.user_id
            subscription_db_id = sub.id

    if user_id:
        payment = Payment(
            user_id=user_id,
            subscription_id=subscription_db_id,
            razorpay_payment_id=payment_id,
            razorpay_order_id=payment_entity.get("order_id"),
            amount=payment_entity.get("amount", 0),
            currency=payment_entity.get("currency", "INR"),
            status="failed",
            method=payment_entity.get("method"),
        )
        db.add(payment)
        await db.commit()
        logger.info(f"webhook: failed payment {payment_id} recorded for user {user_id}")
