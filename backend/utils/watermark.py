"""
Watermark utility for adding watermarks to free tier diagram exports.
"""
from PIL import Image, ImageDraw, ImageFont
from io import BytesIO
import os


def add_watermark_to_image(
    image_bytes: bytes,
    watermark_text: str = "Created with ArchitectAI - Free Plan",
    opacity: float = 0.3,
    position: str = "bottom-right"
) -> bytes:
    """
    Add a watermark to an image.
    
    Args:
        image_bytes: Original image as bytes
        watermark_text: Text to use as watermark
        opacity: Watermark opacity (0.0 to 1.0)
        position: Watermark position ("bottom-right", "bottom-left", "center")
    
    Returns:
        Watermarked image as bytes
    """
    # Open image
    image = Image.open(BytesIO(image_bytes))
    
    # Convert to RGBA if needed
    if image.mode != "RGBA":
        image = image.convert("RGBA")
    
    # Create watermark layer
    watermark = Image.new("RGBA", image.size, (0, 0, 0, 0))
    draw = ImageDraw.Draw(watermark)
    
    # Try to use a nice font, fallback to default
    try:
        font_size = int(image.height / 30)  # Adaptive font size
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
    except:
        font = ImageFont.load_default()
    
    # Get text bounding box
    bbox = draw.textbbox((0, 0), watermark_text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    
    # Calculate position
    margin = 20
    if position == "bottom-right":
        x = image.width - text_width - margin
        y = image.height - text_height - margin
    elif position == "bottom-left":
        x = margin
        y = image.height - text_height - margin
    elif position == "center":
        x = (image.width - text_width) // 2
        y = (image.height - text_height) // 2
    else:
        x = image.width - text_width - margin
        y = image.height - text_height - margin
    
    # Calculate opacity (0-255)
    alpha = int(255 * opacity)
    
    # Draw watermark
    draw.text(
        (x, y),
        watermark_text,
        fill=(128, 128, 128, alpha),  # Gray with opacity
        font=font
    )
    
    # Composite watermark onto image
    watermarked = Image.alpha_composite(image, watermark)
    
    # Convert back to RGB for JPEG/PNG
    if watermarked.mode == "RGBA":
        watermarked = watermarked.convert("RGB")
    
    # Save to bytes
    output = BytesIO()
    watermarked.save(output, format="PNG")
    return output.getvalue()


def should_add_watermark(user_plan: str) -> bool:
    """
    Check if watermark should be added based on user plan.
    
    Args:
        user_plan: User's subscription plan
    
    Returns:
        True if watermark should be added, False otherwise
    """
    return user_plan.lower() == "free"
