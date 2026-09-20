export type StorageBucketType = 'diagram' | 'raw';

export interface StorageSaveOptions {
  bucketType?: StorageBucketType;
  isPublic?: boolean;
}

export interface StorageProvider {
  saveFile(
    fileBuffer: Buffer,
    originalFilename: string,
    mimeType: string,
    options?: StorageSaveOptions
  ): Promise<{ storageKey: string; filePath: string }>;

  getFile(storageKey: string, options?: { bucketType?: StorageBucketType }): Promise<Buffer>;

  deleteFile(storageKey: string, options?: { bucketType?: StorageBucketType }): Promise<void>;
}
