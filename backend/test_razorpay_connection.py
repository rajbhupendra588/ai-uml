"""
Quick diagnostic script to test Razorpay connectivity and plan configuration.

Usage:
  cd backend
  python test_razorpay_connection.py
"""
from __future__ import annotations

import os

from dotenv import load_dotenv
import razorpay


def mask(value: str, keep: int = 4) -> str:
    if not value:
        return ""
    if len(value) <= keep:
        return "*" * len(value)
    return "*" * (len(value) - keep) + value[-keep:]


def main() -> None:
    load_dotenv()

    key_id = os.getenv("RAZORPAY_KEY_ID", "")
    key_secret = os.getenv("RAZORPAY_KEY_SECRET", "")
    plan_monthly = os.getenv("RAZORPAY_PLAN_PRO_MONTHLY", "")

    print("Razorpay environment:")
    print(f"  KEY_ID:     {mask(key_id)}")
    print(f"  KEY_SECRET: {mask(key_secret)}")
    print(f"  PLAN_MONTH: {plan_monthly}")

    if not key_id or not key_secret:
        print("\n❌ RAZORPAY_KEY_ID or RAZORPAY_KEY_SECRET is empty in .env")
        return

    client = razorpay.Client(auth=(key_id, key_secret))

    # Basic API check: fetch the plan
    if plan_monthly:
        print("\n1) Fetching plan to verify it exists...")
        try:
            plan = client.plan.fetch(plan_monthly)
            print("   ✅ Plan fetched successfully:")
            print(f"      id={plan.get('id')}, amount={plan.get('item', {}).get('amount')}, interval={plan.get('period')}")
        except Exception as e:
            print("   ❌ Failed to fetch plan.")
            print(f"      Error: {e}")
            return
    else:
        print("\n⚠️  RAZORPAY_PLAN_PRO_MONTHLY is not set; skipping plan fetch.")

    # Smoke test: create a test customer (using a dummy email)
    print("\n2) Creating a test customer...")
    try:
        customer = client.customer.create(
            data={
                "email": "test-architectai@example.com",
                "name": "ArchitectAI Test User",
                "fail_existing": "0",
            }
        )
        print(f"   ✅ Customer created/fetched: id={customer.get('id')}")
    except Exception as e:
        print("   ❌ Failed to create customer.")
        print(f"      Error: {e}")
        return

    if not plan_monthly:
        return

    # Smoke test: try to create a subscription
    print("\n3) Creating a test subscription (will not be stored in our DB)...")
    try:
        sub = client.subscription.create(
            data={
                "plan_id": plan_monthly,
                "customer_id": customer["id"],
                "total_count": 1,
                "quantity": 1,
            }
        )
        print("   ✅ Subscription created successfully:")
        print(f"      id={sub.get('id')}, status={sub.get('status')}")
    except Exception as e:
        print("   ❌ Failed to create subscription.")
        print(f"      Error: {e}")


if __name__ == "__main__":
    main()

