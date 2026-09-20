import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SupabaseStorageProvider } from '../src/storage/SupabaseStorageProvider.js';

describe('SupabaseStorageProvider Unit Tests', () => {
  const mockSupabaseUrl = 'https://mock-project.supabase.co';
  const mockServiceKey = 'mock-service-role-key-12345';
  const mockDiagramBucket = 'examprep-diagrams';
  const mockRawBucket = 'examprep-raw-uploads';

  let provider: SupabaseStorageProvider;
  const originalFetch = global.fetch;

  beforeEach(() => {
    provider = new SupabaseStorageProvider(
      mockSupabaseUrl,
      mockServiceKey,
      mockDiagramBucket,
      mockRawBucket
    );
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('saves diagram file and returns public CDN URL in diagram bucket', async () => {
    const mockFileBuffer = Buffer.from('Diagram image mock data');
    const mockOriginalFilename = 'diagram.png';
    const mockMimeType = 'image/png';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ Key: 'test-key' }),
    });
    global.fetch = fetchMock;

    const result = await provider.saveFile(
      mockFileBuffer,
      mockOriginalFilename,
      mockMimeType,
      { bucketType: 'diagram' }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [callUrl, callOptions] = fetchMock.mock.calls[0];

    expect(callUrl).toContain(`${mockSupabaseUrl}/storage/v1/object/${mockDiagramBucket}/`);
    expect(callUrl).toMatch(/\.png$/);
    expect(callOptions.method).toBe('POST');
    expect(callOptions.headers['Authorization']).toBe(`Bearer ${mockServiceKey}`);
    expect(callOptions.headers['apikey']).toBe(mockServiceKey);
    expect(callOptions.headers['Content-Type']).toBe(mockMimeType);
    expect(callOptions.headers['x-upsert']).toBe('true');

    expect(result.storageKey).toMatch(/\.png$/);
    expect(result.filePath).toBe(
      `${mockSupabaseUrl}/storage/v1/object/public/${mockDiagramBucket}/${result.storageKey}`
    );
  });

  it('saves raw source PDF in private raw bucket without exposing public URL', async () => {
    const mockFileBuffer = Buffer.from('%PDF-1.4 Mock Raw Exam PDF');
    const mockOriginalFilename = 'jee_main_exam.pdf';
    const mockMimeType = 'application/pdf';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ Key: 'test-raw-key' }),
    });
    global.fetch = fetchMock;

    const result = await provider.saveFile(
      mockFileBuffer,
      mockOriginalFilename,
      mockMimeType,
      { bucketType: 'raw' }
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [callUrl, callOptions] = fetchMock.mock.calls[0];

    expect(callUrl).toContain(`${mockSupabaseUrl}/storage/v1/object/${mockRawBucket}/`);
    expect(callUrl).toMatch(/\.pdf$/);
    expect(callOptions.method).toBe('POST');

    expect(result.storageKey).toMatch(/\.pdf$/);
    // Private file path format: 'examprep-raw-uploads/<key>', NOT public URL
    expect(result.filePath).toBe(`${mockRawBucket}/${result.storageKey}`);
    expect(result.filePath).not.toContain('/public/');
  });

  it('throws descriptive error if Supabase Storage upload fails', async () => {
    const mockFileBuffer = Buffer.from('Corrupt data');
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Bucket access denied / unauthorized',
    });

    await expect(
      provider.saveFile(mockFileBuffer, 'test.pdf', 'application/pdf', { bucketType: 'raw' })
    ).rejects.toThrow(/Failed to upload file to Supabase Storage \[bucket: examprep-raw-uploads\] \(HTTP 403\): Bucket access denied/);
  });

  it('downloads file successfully from authenticated endpoint', async () => {
    const fileBytes = new Uint8Array([1, 2, 3, 4, 5]);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => fileBytes.buffer,
    });

    const buffer = await provider.getFile('sample-key.pdf', { bucketType: 'raw' });
    expect(buffer).toEqual(Buffer.from(fileBytes));
  });

  it('deletes file with correct payload and authorization in specified bucket', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    global.fetch = fetchMock;

    await provider.deleteFile('file-to-delete.pdf', { bucketType: 'raw' });

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [callUrl, callOptions] = fetchMock.mock.calls[0];
    expect(callUrl).toBe(`${mockSupabaseUrl}/storage/v1/object/${mockRawBucket}`);
    expect(callOptions.method).toBe('DELETE');
    expect(callOptions.body).toBe(JSON.stringify({ prefixes: ['file-to-delete.pdf'] }));
  });
});
