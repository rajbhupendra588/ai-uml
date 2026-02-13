import os
import razorpay
from dotenv import load_dotenv
import sys

# Load .env
load_dotenv()

key_id = os.getenv("RAZORPAY_KEY_ID")
key_secret = os.getenv("RAZORPAY_KEY_SECRET")
plan_id_monthly = os.getenv("RAZORPAY_PLAN_PRO_MONTHLY")
plan_id_annual = os.getenv("RAZORPAY_PLAN_PRO_ANNUAL")

print(f"--- Razorpay Verification ---")
print(f"Key ID: {key_id}")
if not key_id or not key_secret:
    print("❌ Error: Missing keys")
    sys.exit(1)

client = razorpay.Client(auth=(key_id, key_secret))

def check_plan(pid, name):
    if not pid:
        print(f"⚠️  Skipping {name}: No Plan ID in .env")
        return
    print(f"\nChecking {name} ({pid})...")
    try:
        plan = client.plan.fetch(pid)
        print(f"✅ Plan found: {plan.get('item', {}).get('name')} - {plan.get('item', {}).get('amount')/100} {plan.get('item', {}).get('currency')}")
        if plan.get('status') != 'active':
            print(f"⚠️  Plan status is: {plan.get('status')}")
    except Exception as e:
        print(f"❌ Error fetching plan: {e}")

check_plan(plan_id_monthly, "Monthly Plan")

# Try creating a dummy subscription
print("\n--- Trying to create Subscription (Monthly) ---")
try:
    # 1. Create Dummy Customer
    cust = client.customer.create({
        "name": "Test User",
        "email": "test_verification@example.com",
        "contact": "9999999999"
    })
    cust_id = cust['id']
    print(f"✅ Customer created: {cust_id}")

    # 2. Create Subscription
    if plan_id_monthly:
        sub = client.subscription.create({
            "plan_id": plan_id_monthly,
            "customer_id": cust_id,
            "total_count": 1
        })
        print(f"✅ Subscription created successfully: {sub['id']}")
        print(f"   Status: {sub['status']}")
        print(f"   Short URL: {sub['short_url']}")
    else:
        print("⚠️  Skipping subscription creation (No Monthly Plan ID)")

except Exception as e:
    print(f"❌ SUBSCRIPTION CREATION FAILED: {e}")
