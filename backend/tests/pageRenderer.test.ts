import fs from 'fs';
import path from 'path';
import { describe, it, expect } from 'vitest';
import {
  renderPageToImage,
  PageOutOfRangeError,
  PageRenderingError,
} from '../src/modules/ingestion/pageRenderer.js';

describe('Targeted Page Rendering (PROMPT 3)', () => {
  const samplePdfPath = path.resolve(process.cwd(), 'uploads/012b26e9-9620-4a66-bde4-95e39ac7f467.pdf');

  it('renders page 1 of sample PDF to a valid, non-empty base64 image and mimeType', async () => {
    if (!fs.existsSync(samplePdfPath)) return;
    const buffer = fs.readFileSync(samplePdfPath);

    const result = await renderPageToImage(buffer, 1);

    expect(result).toBeDefined();
    expect(result.mimeType).toBe('image/png');
    expect(result.base64).toBeDefined();
    expect(result.base64.length).toBeGreaterThan(1000);
  });

  it('throws PageOutOfRangeError when requesting a page number < 1', async () => {
    if (!fs.existsSync(samplePdfPath)) return;
    const buffer = fs.readFileSync(samplePdfPath);

    await expect(renderPageToImage(buffer, 0)).rejects.toThrow(PageOutOfRangeError);
  });

  it('throws PageOutOfRangeError when requesting an out-of-range page number (> total pages)', async () => {
    if (!fs.existsSync(samplePdfPath)) return;
    const buffer = fs.readFileSync(samplePdfPath);

    await expect(renderPageToImage(buffer, 999)).rejects.toThrow(PageOutOfRangeError);
  });

  it('throws PageRenderingError for an empty buffer', async () => {
    await expect(renderPageToImage(Buffer.from([]), 1)).rejects.toThrow(PageRenderingError);
  });
});
