/**
 * Add watermark to an image using HTML5 Canvas.
 * @param imageBlob - Original image blob
 * @param watermarkText - Text to display as watermark
 * @returns Promise<Blob> - Watermarked image blob
 */
export async function addWatermarkToImage(
    imageBlob: Blob,
    watermarkText: string = "Created with ArchitectAI - Free Plan"
): Promise<Blob> {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.crossOrigin = "anonymous"; // Prevent canvas tainting
        const url = URL.createObjectURL(imageBlob);

        img.onload = () => {
            // Create canvas
            const canvas = document.createElement("canvas");
            canvas.width = img.width;
            canvas.height = img.height;
            const ctx = canvas.getContext("2d");

            if (!ctx) {
                reject(new Error("Could not get canvas context"));
                return;
            }

            // Draw original image
            ctx.drawImage(img, 0, 0);

            // Add watermark
            const fontSize = Math.max(img.height / 30, 14); // Adaptive font size
            ctx.font = `${fontSize}px Arial, sans-serif`;
            ctx.fillStyle = "rgba(128, 128, 128, 0.3)"; // Gray with 30% opacity
            ctx.textAlign = "right";
            ctx.textBaseline = "bottom";

            // Position at bottom-right corner with margin
            const margin = 20;
            const x = img.width - margin;
            const y = img.height - margin;

            ctx.fillText(watermarkText, x, y);

            // Convert canvas to blob
            canvas.toBlob(
                (blob) => {
                    URL.revokeObjectURL(url);
                    if (blob) {
                        resolve(blob);
                    } else {
                        reject(new Error("Failed to create watermarked image"));
                    }
                },
                "image/png",
                1.0
            );
        };

        img.onerror = () => {
            URL.revokeObjectURL(url);
            reject(new Error("Failed to load image"));
        };

        img.src = url;
    });
}

/**
 * Check if user is on free plan and should have watermarked exports.
 */
export function shouldAddWatermark(userPlan?: string): boolean {
    return !userPlan || userPlan.toLowerCase() === "free";
}
