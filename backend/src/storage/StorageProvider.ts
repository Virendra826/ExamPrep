export interface StorageProvider {
  saveFile(
    fileBuffer: Buffer,
    originalFilename: string,
    mimeType: string
  ): Promise<{ storageKey: string; filePath: string }>;

  getFile(storageKey: string): Promise<Buffer>;

  deleteFile(storageKey: string): Promise<void>;
}
