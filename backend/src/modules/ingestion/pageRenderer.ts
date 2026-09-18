import * as pdfParseModule from 'pdf-parse';

export class PageRenderingError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'PageRenderingError';
  }
}

export class PageOutOfRangeError extends PageRenderingError {
  constructor(pageNumber: number, totalPages?: number) {
    const totalMsg = totalPages !== undefined && totalPages > 0 ? ` (document has ${totalPages} pages)` : '';
    super(`Requested page number ${pageNumber} is out of range${totalMsg}`);
    this.name = 'PageOutOfRangeError';
  }
}

export interface RenderedPageImage {
  base64: string;
  mimeType: string;
}

interface PDFParseInstance {
  load(): Promise<void>;
  getInfo(): Promise<{ total?: number } | null>;
  getText(): Promise<{ pages?: Array<{ text?: string }> } | null>;
  getScreenshot(options: { pageNumber: number }): Promise<{
    pages?: Array<{ pageNumber: number; dataUrl?: string }>;
  } | null>;
  destroy?(): Promise<void>;
}

interface PDFParseClass {
  new (options: { data: Buffer }): PDFParseInstance;
}

/**
 * Targeted single-page rasterizer:
 * Renders one specific PDF page (by 1-indexed pageNumber) to base64 image and mimeType
 * entirely in-memory without creating temporary files on disk.
 */
export async function renderPageToImage(
  buffer: Buffer,
  pageNumber: number
): Promise<RenderedPageImage> {
  if (!buffer || buffer.length === 0) {
    throw new PageRenderingError('Cannot render empty or missing PDF buffer');
  }

  if (pageNumber < 1) {
    throw new PageOutOfRangeError(pageNumber);
  }

  const moduleObj = pdfParseModule as unknown as Record<string, unknown>;
  const P = (moduleObj.PDFParse || (moduleObj.default as Record<string, unknown> | undefined)?.PDFParse) as
    | PDFParseClass
    | undefined;

  if (!P) {
    throw new PageRenderingError('PDF parser module does not support screenshot rendering');
  }

  const parser = new P({ data: buffer });
  try {
    await parser.load();
    const info = await parser.getInfo().catch(() => null);
    const totalPages =
      info?.total ||
      (await parser
        .getText()
        .then((t) => t?.pages?.length || 1)
        .catch(() => 1));

    if (pageNumber > totalPages) {
      throw new PageOutOfRangeError(pageNumber, totalPages);
    }

    const screenshotRes = await parser.getScreenshot({ pageNumber });
    const page =
      screenshotRes?.pages?.find((p) => p.pageNumber === pageNumber) ||
      screenshotRes?.pages?.[0];

    if (!page?.dataUrl) {
      throw new PageRenderingError(`Failed to render page ${pageNumber} to image`);
    }

    const match = page.dataUrl.match(/^data:([^;]+);base64,(.+)$/);
    if (!match) {
      throw new PageRenderingError('Invalid dataUrl format returned from page renderer');
    }

    return {
      mimeType: match[1],
      base64: match[2],
    };
  } catch (err: unknown) {
    if (err instanceof PageRenderingError) {
      throw err;
    }
    const msg = err instanceof Error ? err.message : String(err);
    if (/out of range|invalid page/i.test(msg)) {
      throw new PageOutOfRangeError(pageNumber);
    }
    throw new PageRenderingError(`Page rendering failed: ${msg}`);
  } finally {
    if (typeof parser.destroy === 'function') {
      await parser.destroy().catch(() => {});
    }
  }
}
