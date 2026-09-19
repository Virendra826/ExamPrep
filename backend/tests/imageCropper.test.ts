import { describe, it, expect } from 'vitest';
import sharp from 'sharp';
import { cropImageBuffer } from '../src/modules/ingestion/imageCropper.js';

describe('Image Cropper Utility', () => {
  it('returns unchanged buffer when boundingBox is undefined or null', async () => {
    const testImg = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    const result = await cropImageBuffer(testImg, undefined);
    expect(result).toEqual(testImg);

    const resultNull = await cropImageBuffer(testImg, null);
    expect(resultNull).toEqual(testImg);
  });

  it('correctly crops a valid bounding box region', async () => {
    // Create 200x200 test image
    const testImg = await sharp({
      create: {
        width: 200,
        height: 200,
        channels: 4,
        background: { r: 0, g: 255, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    // Crop center 50%: x=0.25, y=0.25, width=0.5, height=0.5 -> 100x100
    const cropped = await cropImageBuffer(testImg, {
      x: 0.25,
      y: 0.25,
      width: 0.5,
      height: 0.5,
    });

    const meta = await sharp(cropped).metadata();
    expect(meta.width).toBe(100);
    expect(meta.height).toBe(100);
  });

  it('handles out-of-bounds or invalid bounding box values safely without throwing', async () => {
    const testImg = await sharp({
      create: {
        width: 100,
        height: 100,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    // Invalid negative width
    const resultNeg = await cropImageBuffer(testImg, {
      x: 0.1,
      y: 0.1,
      width: -0.5,
      height: 0.5,
    });
    expect(resultNeg).toEqual(testImg);

    // Bounding box with x >= 1
    const resultOutOfBounds = await cropImageBuffer(testImg, {
      x: 1.5,
      y: 0.2,
      width: 0.2,
      height: 0.2,
    });
    expect(resultOutOfBounds).toEqual(testImg);
  });

  it('handles empty image buffer safely', async () => {
    const empty = Buffer.from([]);
    const res = await cropImageBuffer(empty, { x: 0, y: 0, width: 0.5, height: 0.5 });
    expect(res).toEqual(empty);
  });
});
