import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SupabaseStorageProvider } from '../src/storage/SupabaseStorageProvider.js';

describe('SupabaseStorageProvider Unit Tests', () => {
  const mockSupabaseUrl = 'https://mock-project.supabase.co';
  const mockServiceKey = 'mock-service-role-key-12345';
  const mockBucket = 'test-bucket';

  let provider: SupabaseStorageProvider;
  const originalFetch = global.fetch;

  beforeEach(() => {
    provider = new SupabaseStorageProvider(mockSupabaseUrl, mockServiceKey, mockBucket);
  });

  afterEach(() => {
    global.fetch = originalFetch;
    vi.restoreAllMocks();
  });

  it('saves file and returns public URL with correct headers and key', async () => {
    const mockFileBuffer = Buffer.from('PDF content mock data');
    const mockOriginalFilename = 'sample_exam.pdf';
    const mockMimeType = 'application/pdf';

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ Key: 'test-key' }),
    });
    global.fetch = fetchMock;

    const result = await provider.saveFile(mockFileBuffer, mockOriginalFilename, mockMimeType);

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [callUrl, callOptions] = fetchMock.mock.calls[0];

    expect(callUrl).toContain(`${mockSupabaseUrl}/storage/v1/object/${mockBucket}/`);
    expect(callUrl).toMatch(/\.pdf$/);
    expect(callOptions.method).toBe('POST');
    expect(callOptions.headers['Authorization']).toBe(`Bearer ${mockServiceKey}`);
    expect(callOptions.headers['apikey']).toBe(mockServiceKey);
    expect(callOptions.headers['Content-Type']).toBe(mockMimeType);
    expect(callOptions.headers['x-upsert']).toBe('true');

    expect(result.storageKey).toMatch(/\.pdf$/);
    expect(result.filePath).toBe(
      `${mockSupabaseUrl}/storage/v1/object/public/${mockBucket}/${result.storageKey}`
    );
  });

  it('throws descriptive error if Supabase Storage upload fails', async () => {
    const mockFileBuffer = Buffer.from('Corrupt data');
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 403,
      text: async () => 'Bucket access denied / unauthorized',
    });

    await expect(
      provider.saveFile(mockFileBuffer, 'test.pdf', 'application/pdf')
    ).rejects.toThrow(/Failed to upload file to Supabase Storage \(HTTP 403\): Bucket access denied/);
  });

  it('downloads file successfully from authenticated endpoint', async () => {
    const fileBytes = new Uint8Array([1, 2, 3, 4, 5]);
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      arrayBuffer: async () => fileBytes.buffer,
    });

    const buffer = await provider.getFile('sample-key.pdf');
    expect(buffer).toEqual(Buffer.from(fileBytes));
  });

  it('deletes file with correct payload and authorization', async () => {
    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
    });
    global.fetch = fetchMock;

    await provider.deleteFile('file-to-delete.pdf');

    expect(fetchMock).toHaveBeenCalledTimes(1);
    const [callUrl, callOptions] = fetchMock.mock.calls[0];
    expect(callUrl).toBe(`${mockSupabaseUrl}/storage/v1/object/${mockBucket}`);
    expect(callOptions.method).toBe('DELETE');
    expect(callOptions.body).toBe(JSON.stringify({ prefixes: ['file-to-delete.pdf'] }));
  });
});
