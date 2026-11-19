import { env } from '@/config/env';
import { LocalDiskStorageProvider } from './local.provider';
import { FileStorageProvider } from './storage-provider.interface';
import { S3StorageProvider } from './s3.provider';

export function createStorageProvider(): FileStorageProvider {
  if (env.STORAGE_PROVIDER === 'local') return new LocalDiskStorageProvider(env.STORAGE_LOCAL_DIR);

  const credentials = {
    bucket: env.STORAGE_BUCKET!,
    accessKeyId: env.STORAGE_ACCESS_KEY_ID!,
    secretAccessKey: env.STORAGE_SECRET_ACCESS_KEY!,
  };

  return new S3StorageProvider('S3', {
    ...credentials,
    region: env.STORAGE_REGION,
    endpoint: env.STORAGE_ENDPOINT,
  });
}

export const fileStorage = createStorageProvider();
