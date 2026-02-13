
import requests
import hmac
import hashlib
import json
import os
import sys

# Load .env manually
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
    print("Error: .env file not found")
    sys.exit(1)

WEBHOOK_SECRET = os.environ.get("RAZORPAY_WEBHOOK_SECRET")
BASE_URL = "http://localhost:8000/api/v1"

if not WEBHOOK_SECRET:
    print("Error: RAZORPAY_WEBHOOK_SECRET not found in .env")
    sys.exit(1)

def generate_signature(body: bytes, secret: str) -> str:
    return hmac.new(
        key=bytes(secret, "utf-8"),
        msg=body,
        digestmod=hashlib.sha256
    ).hexdigest()

def test_webhook_activated():
    """Simulate subscription.activated event"""
    print("Testing subscription.activated webhook...")
    
    # Payload from Razorpay docs (simplified)
    # Using a fake subscription_id and payment_id
    payload = {
        "entity": "event",
        "account_id": "acc_TestAccount",
        "event": "subscription.activated",
        "contains": ["subscription"],
        "payload": {
            "subscription": {
                "entity": {
                    "id": "sub_TestSub123",
                    "entity": "subscription",
                    "plan_id": os.environ.get("RAZORPAY_PLAN_PRO_MONTHLY", "plan_Test"),
                    "customer_id": "cust_TestCust123",
                    "status": "active",
                    "current_start": 1690000000,
                    "current_end": 1790000000,
                    "quantity": 1,
                    "notes": []
                }
            }
        },
        "created_at": 1690000000
    }
    
    body = json.dumps(payload, separators=(',', ':'))
    signature = generate_signature(bytes(body, "utf-8"), WEBHOOK_SECRET)
    
    headers = {
        "Content-Type": "application/json",
        "X-Razorpay-Signature": signature
    }
    
    try:
        response = requests.post(f"{BASE_URL}/subscription/webhooks/razorpay", data=body, headers=headers)
        print(f"Status: {response.status_code}")
        print(f"Response: {response.text}")
        
        if response.status_code == 200:
            print("✅ Webhook processed successfully!")
        else:
            print("❌ Webhook failed processing")
            
    except requests.exceptions.ConnectionError:
        print("❌ Could not connect to backend. Is it running?")

if __name__ == "__main__":
    print(f"Using Secret: {WEBHOOK_SECRET[:5]}...")
    test_webhook_activated()
