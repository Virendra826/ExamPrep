import crypto from 'crypto';
import path from 'path';
import { StorageProvider } from './StorageProvider.js';
import { env } from '../config/env.js';

export class SupabaseStorageProvider implements StorageProvider {
  private supabaseUrl: string;
  private serviceKey: string;
  private bucket: string;

  constructor(supabaseUrl?: string, serviceKey?: string, bucket?: string) {
    this.supabaseUrl = (supabaseUrl || env.SUPABASE_URL || '').replace(/\/+$/, '');
    this.serviceKey = serviceKey || env.SUPABASE_SERVICE_KEY || '';
    this.bucket = bucket || env.SUPABASE_STORAGE_BUCKET || 'examprep-assets';

    if (!this.supabaseUrl || !this.serviceKey) {
      console.warn(
        '[SupabaseStorageProvider] SUPABASE_URL or SUPABASE_SERVICE_KEY is unset. Operations may fail.'
      );
    }
  }

  async saveFile(
    fileBuffer: Buffer,
    originalFilename: string,
    mimeType: string
  ): Promise<{ storageKey: string; filePath: string }> {
    const ext = path.extname(originalFilename).toLowerCase() || '.pdf';
    const storageKey = `${crypto.randomUUID()}${ext}`;

    const uploadUrl = `${this.supabaseUrl}/storage/v1/object/${encodeURIComponent(
      this.bucket
    )}/${encodeURIComponent(storageKey)}`;

    const response = await fetch(uploadUrl, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.serviceKey}`,
        apikey: this.serviceKey,
        'Content-Type': mimeType || 'application/octet-stream',
        'x-upsert': 'true',
      },
      body: new Uint8Array(fileBuffer),
    });

    if (!response.ok) {
      const errText = await response.text().catch(() => response.statusText);
      throw new Error(
        `Failed to upload file to Supabase Storage (HTTP ${response.status}): ${errText}`
      );
    }

    const publicUrl = `${this.supabaseUrl}/storage/v1/object/public/${encodeURIComponent(
      this.bucket
    )}/${encodeURIComponent(storageKey)}`;

    return {
      storageKey,
      filePath: publicUrl,
    };
  }

  async getFile(storageKey: string): Promise<Buffer> {
    const downloadUrl = `${this.supabaseUrl}/storage/v1/object/authenticated/${encodeURIComponent(
      this.bucket
    )}/${encodeURIComponent(storageKey)}`;

    const response = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.serviceKey}`,
        apikey: this.serviceKey,
      },
    });

    if (!response.ok) {
      // Fallback try public URL
      const publicUrl = `${this.supabaseUrl}/storage/v1/object/public/${encodeURIComponent(
        this.bucket
      )}/${encodeURIComponent(storageKey)}`;
      const pubRes = await fetch(publicUrl);
      if (!pubRes.ok) {
        throw new Error(
          `Failed to retrieve file from Supabase Storage (HTTP ${response.status})`
        );
      }
      const arrayBuf = await pubRes.arrayBuffer();
      return Buffer.from(arrayBuf);
    }

    const arrayBuf = await response.arrayBuffer();
    return Buffer.from(arrayBuf);
  }

  async deleteFile(storageKey: string): Promise<void> {
    const deleteUrl = `${this.supabaseUrl}/storage/v1/object/${encodeURIComponent(this.bucket)}`;
    try {
      await fetch(deleteUrl, {
        method: 'DELETE',
        headers: {
          Authorization: `Bearer ${this.serviceKey}`,
          apikey: this.serviceKey,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ prefixes: [storageKey] }),
      });
    } catch {
      // Ignore errors on delete
    }
  }
}
