import { env } from '../config/env.js';
import { StorageProvider } from './StorageProvider.js';
import { LocalStorageProvider } from './LocalStorageProvider.js';
import { SupabaseStorageProvider } from './SupabaseStorageProvider.js';

export * from './StorageProvider.js';
export * from './LocalStorageProvider.js';
export * from './SupabaseStorageProvider.js';

export function getStorageProvider(): StorageProvider {
  if (env.STORAGE_DRIVER === 'supabase') {
    return new SupabaseStorageProvider();
  }
  return new LocalStorageProvider();
}

export const storageProvider = getStorageProvider();

