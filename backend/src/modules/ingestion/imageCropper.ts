import sharp from 'sharp';
import { GeminiBoundingBox } from './gemini/gemini.schema.js';

export interface CropOptions {
  boundingBox?: GeminiBoundingBox | null;
}

/**
 * Crops an image buffer (PNG/JPEG) based on a normalized bounding box (0.0 to 1.0 coordinates).
 * If no boundingBox is provided, or if the boundingBox is invalid or out-of-bounds,
 * returns the original image buffer unmodified.
 */
export async function cropImageBuffer(
  imageBuffer: Buffer,
  boundingBox?: GeminiBoundingBox | null
): Promise<Buffer> {
  if (!imageBuffer || imageBuffer.length === 0) {
    return imageBuffer;
  }

  if (!boundingBox) {
    return imageBuffer;
  }

  const { x, y, width, height } = boundingBox;

  // Validate normalized range
  if (
    typeof x !== 'number' ||
    typeof y !== 'number' ||
    typeof width !== 'number' ||
    typeof height !== 'number' ||
    isNaN(x) ||
    isNaN(y) ||
    isNaN(width) ||
    isNaN(height) ||
    x < 0 ||
    y < 0 ||
    width <= 0 ||
    height <= 0 ||
    x >= 1 ||
    y >= 1
  ) {
    return imageBuffer;
  }

  try {
    const image = sharp(imageBuffer);
    const metadata = await image.metadata();

    if (!metadata.width || !metadata.height) {
      return imageBuffer;
    }

    const imgWidth = metadata.width;
    const imgHeight = metadata.height;

    // Calculate pixel coordinates with safe bounds
    const left = Math.max(0, Math.min(imgWidth - 1, Math.floor(x * imgWidth)));
    const top = Math.max(0, Math.min(imgHeight - 1, Math.floor(y * imgHeight)));
    const pixelWidth = Math.max(1, Math.min(imgWidth - left, Math.ceil(width * imgWidth)));
    const pixelHeight = Math.max(1, Math.min(imgHeight - top, Math.ceil(height * imgHeight)));

    // Do not crop if dimensions are negligibly small (< 5px)
    if (pixelWidth < 5 || pixelHeight < 5) {
      return imageBuffer;
    }

    return await image
      .extract({
        left,
        top,
        width: pixelWidth,
        height: pixelHeight,
      })
      .png()
      .toBuffer();
  } catch (err: unknown) {
    console.warn(`[ImageCropper] Failed to crop image with bounding box, falling back to full image:`, err);
    return imageBuffer;
  }
}
