"""
Test watermark functionality.
"""
from utils.watermark import add_watermark_to_image, should_add_watermark
from PIL import Image
from io import BytesIO


def create_test_image() -> bytes:
    """Create a simple test image."""
    img = Image.new("RGB", (800, 600), color=(255, 255, 255))
    output = BytesIO()
    img.save(output, format="PNG")
    return output.getvalue()


def test_watermark():
    """Test watermark addition."""
    print("=" * 60)
    print("Testing Watermark Functionality")
    print("=" * 60)
    
    # Test 1: Check watermark logic for different plans
    print("\n1. Testing watermark logic...")
    assert should_add_watermark("free") == True
    assert should_add_watermark("Free") == True
    assert should_add_watermark("pro") == False
    assert should_add_watermark("Pro") == False
    print("   ✅ Watermark logic correct")
    
    # Test 2: Create test image
    print("\n2. Creating test image...")
    test_img = create_test_image()
    print(f"   ✅ Test image created ({len(test_img)} bytes)")
    
    # Test 3: Add watermark
    print("\n3. Adding watermark...")
    watermarked = add_watermark_to_image(
        test_img,
        watermark_text="Created with ArchitectAI - Free Plan",
        opacity=0.3,
        position="bottom-right"
    )
    print(f"   ✅ Watermark added ({len(watermarked)} bytes)")
    
    # Test 4: Verify watermarked image is valid
    print("\n4. Verifying watermarked image...")
    watermarked_img = Image.open(BytesIO(watermarked))
    assert watermarked_img.size == (800, 600)
    print(f"   ✅ Watermarked image valid (size: {watermarked_img.size})")
    
    print("\n" + "=" * 60)
    print("✅ All watermark tests passed!")
    print("=" * 60)


if __name__ == "__main__":
    test_watermark()
