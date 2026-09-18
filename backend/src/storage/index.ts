import { env } from '../config/env.js';
import { StorageProvider } from './StorageProvider.js';
import { LocalStorageProvider } from './LocalStorageProvider.js';

export * from './StorageProvider.js';
export * from './LocalStorageProvider.js';

export function getStorageProvider(): StorageProvider {
  if (env.STORAGE_DRIVER === 'local') {
    return new LocalStorageProvider();
  }
  // Default to local for development
  return new LocalStorageProvider();
}

export const storageProvider = getStorageProvider();
