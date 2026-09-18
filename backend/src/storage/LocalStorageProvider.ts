import fs from 'fs/promises';
import path from 'path';
import crypto from 'crypto';
import { StorageProvider } from './StorageProvider.js';

export class LocalStorageProvider implements StorageProvider {
  private uploadsDir: string;

  constructor(uploadsDir?: string) {
    this.uploadsDir = uploadsDir || path.resolve(process.cwd(), 'uploads');
  }

  private async ensureDir(): Promise<void> {
    await fs.mkdir(this.uploadsDir, { recursive: true });
  }

  async saveFile(
    fileBuffer: Buffer,
    originalFilename: string,
    _mimeType: string
  ): Promise<{ storageKey: string; filePath: string }> {
    await this.ensureDir();
    const ext = path.extname(originalFilename).toLowerCase() || '.pdf';
    const randomKey = `${crypto.randomUUID()}${ext}`;
    const targetPath = path.join(this.uploadsDir, randomKey);

    await fs.writeFile(targetPath, fileBuffer);
    return {
      storageKey: randomKey,
      filePath: targetPath,
    };
  }

  async getFile(storageKey: string): Promise<Buffer> {
    const safeKey = path.basename(storageKey);
    const targetPath = path.join(this.uploadsDir, safeKey);
    return await fs.readFile(targetPath);
  }

  async deleteFile(storageKey: string): Promise<void> {
    try {
      const safeKey = path.basename(storageKey);
      const targetPath = path.join(this.uploadsDir, safeKey);
      await fs.unlink(targetPath);
    } catch {
      // Ignore if file doesn't exist
    }
  }
}
