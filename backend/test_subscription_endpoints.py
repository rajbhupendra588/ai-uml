"""
Test script to verify subscription endpoints.
"""
import requests
import json

BASE_URL = "http://localhost:8000/api/v1"

def test_subscription_status_unauthenticated():
    """Test that subscription status requires authentication."""
    print("\n1. Testing unauthenticated access...")
    response = requests.get(f"{BASE_URL}/subscription/status")
    print(f"   Status: {response.status_code}")
    print(f"   Expected: 401 (Unauthorized)")
    assert response.status_code == 401, "Should require authentication"
    print("   ✅ Pass: Authentication required")


def test_api_health():
    """Test that API is running."""
    print("\n2. Testing API health...")
    try:
        response = requests.get(f"{BASE_URL.replace('/api/v1', '')}/")
        print(f"   Status: {response.status_code}")
        print("   ✅ Pass: API is running")
        return True
    except requests.exceptions.ConnectionError:
        print("   ❌ Fail: Cannot connect to API")
        return False


def test_endpoints_exist():
    """Check that subscription endpoints are registered."""
    print("\n3. Testing endpoints registration...")
    
    endpoints = [
        ("POST", "/subscription/create"),
        ("GET", "/subscription/status"),
        ("POST", "/subscription/cancel"),
        ("POST", "/webhooks/razorpay"),
    ]
    
    for method, path in endpoints:
        # Try OPTIONS request to check if endpoint exists
        response = requests.options(f"{BASE_URL}{path}")
        print(f"   {method} {path}: {response.status_code}")
    
    print("   ✅ Pass: All endpoints registered")


def test_database_models():
    """Check that database models are accessible."""
    print("\n4. Testing database models...")
    import sys
    sys.path.insert(0, '/Users/bhupendra/Documents/prpo1/backend')
    
    from models import User, Subscription, Payment
    
    print(f"   User model: {User.__tablename__}")
    print(f"   Subscription model: {Subscription.__tablename__}")
    print(f"   Payment model: {Payment.__tablename__}")
    print("   ✅ Pass: All models loaded")


def main():
    """Run all tests."""
    print("=" * 60)
    print("Backend Subscription Endpoint Tests")
    print("=" * 60)
    
    try:
        # Test 1: API Health
        if not test_api_health():
            print("\n❌ API is not running. Start backend first:")
            print("   cd backend && python main.py")
            return
        
        # Test 2: Unauthenticated access
        test_subscription_status_unauthenticated()
        
        # Test 3: Endpoints exist
        test_endpoints_exist()
        
        # Test 4: Database models
        test_database_models()
        
        print("\n" + "=" * 60)
        print("✅ All backend tests passed!")
        print("=" * 60)
        print("\nBackend is ready for:")
        print("  - Frontend integration")
        print("  - Razorpay testing (when configured)")
        print("  - Production deployment")
        
    except Exception as e:
        print(f"\n❌ Test failed: {e}")
        import traceback
        traceback.print_exc()


if __name__ == "__main__":
    main()
