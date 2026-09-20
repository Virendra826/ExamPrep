import crypto from 'crypto';
import path from 'path';
import { StorageProvider, StorageSaveOptions, StorageBucketType } from './StorageProvider.js';
import { env } from '../config/env.js';

export class SupabaseStorageProvider implements StorageProvider {
  private supabaseUrl: string;
  private serviceKey: string;
  private diagramBucket: string;
  private rawBucket: string;

  constructor(
    supabaseUrl?: string,
    serviceKey?: string,
    diagramBucket?: string,
    rawBucket?: string
  ) {
    this.supabaseUrl = (supabaseUrl || env.SUPABASE_URL || '').replace(/\/+$/, '');
    this.serviceKey = serviceKey || env.SUPABASE_SERVICE_KEY || '';
    this.diagramBucket =
      diagramBucket || env.SUPABASE_DIAGRAM_BUCKET || env.SUPABASE_STORAGE_BUCKET || 'examprep-diagrams';
    this.rawBucket = rawBucket || env.SUPABASE_RAW_UPLOAD_BUCKET || 'examprep-raw-uploads';

    if (!this.supabaseUrl || !this.serviceKey) {
      console.warn(
        '[SupabaseStorageProvider] SUPABASE_URL or SUPABASE_SERVICE_KEY is unset. Operations may fail.'
      );
    }
  }

  private resolveBucket(bucketType?: StorageBucketType): { bucketName: string; isPublic: boolean } {
    if (bucketType === 'raw') {
      return { bucketName: this.rawBucket, isPublic: false };
    }
    // Default to diagram bucket (public for student rendering)
    return { bucketName: this.diagramBucket, isPublic: true };
  }

  async saveFile(
    fileBuffer: Buffer,
    originalFilename: string,
    mimeType: string,
    options?: StorageSaveOptions
  ): Promise<{ storageKey: string; filePath: string }> {
    const { bucketName, isPublic } = this.resolveBucket(options?.bucketType);
    const ext = path.extname(originalFilename).toLowerCase() || '.pdf';
    const storageKey = `${crypto.randomUUID()}${ext}`;

    const uploadUrl = `${this.supabaseUrl}/storage/v1/object/${encodeURIComponent(
      bucketName
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
        `Failed to upload file to Supabase Storage [bucket: ${bucketName}] (HTTP ${response.status}): ${errText}`
      );
    }

    if (isPublic) {
      const publicUrl = `${this.supabaseUrl}/storage/v1/object/public/${encodeURIComponent(
        bucketName
      )}/${encodeURIComponent(storageKey)}`;
      return { storageKey, filePath: publicUrl };
    }

    // For private raw uploads, return the storage path (not a public URL)
    const privatePath = `${bucketName}/${storageKey}`;
    return {
      storageKey,
      filePath: privatePath,
    };
  }

  async getFile(
    storageKey: string,
    options?: { bucketType?: StorageBucketType }
  ): Promise<Buffer> {
    const { bucketName, isPublic } = this.resolveBucket(options?.bucketType);

    const downloadUrl = `${this.supabaseUrl}/storage/v1/object/authenticated/${encodeURIComponent(
      bucketName
    )}/${encodeURIComponent(storageKey)}`;

    const response = await fetch(downloadUrl, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${this.serviceKey}`,
        apikey: this.serviceKey,
      },
    });

    if (!response.ok) {
      if (isPublic) {
        // Fallback try public URL for diagram bucket
        const publicUrl = `${this.supabaseUrl}/storage/v1/object/public/${encodeURIComponent(
          bucketName
        )}/${encodeURIComponent(storageKey)}`;
        const pubRes = await fetch(publicUrl);
        if (pubRes.ok) {
          const arrayBuf = await pubRes.arrayBuffer();
          return Buffer.from(arrayBuf);
        }
      }
      throw new Error(
        `Failed to retrieve file from Supabase Storage [bucket: ${bucketName}] (HTTP ${response.status})`
      );
    }

    const arrayBuf = await response.arrayBuffer();
    return Buffer.from(arrayBuf);
  }

  async deleteFile(
    storageKey: string,
    options?: { bucketType?: StorageBucketType }
  ): Promise<void> {
    const { bucketName } = this.resolveBucket(options?.bucketType);
    const deleteUrl = `${this.supabaseUrl}/storage/v1/object/${encodeURIComponent(bucketName)}`;
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
