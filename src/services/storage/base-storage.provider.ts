import path from 'node:path';
import type {
  FileStorageProvider,
  SignedUrlOptions,
  StoredFile,
  UploadFileInput,
} from './storage-provider.interface';
import { computeChecksum } from '@/utils/checksum';
import { logger } from '@/libs/logger';

export function buildStorageKey(namespace: string, checksum: string, originalName: string) {
  const extension = path
    .extname(originalName)
    .toLowerCase()
    .replace(/[^a-z0-9.]/g, '')
    .slice(0, 10);
  return `${namespace}/${checksum}${extension}`;
}

export abstract class BaseFileStorageProvider implements FileStorageProvider {
  abstract readonly name: string;

  protected abstract putObject(
    key: string,
    body: Buffer,
    contentType: string,
    metadata: Record<string, string>,
  ): Promise<void>;
  abstract fileExists(key: string): Promise<boolean>;
  abstract downloadFile(key: string): Promise<Buffer>;
  abstract deleteFile(key: string): Promise<void>;
  abstract getFileUrl(key: string, options?: SignedUrlOptions): Promise<string>;

  async uploadFile(input: UploadFileInput): Promise<StoredFile> {
    const checksum = computeChecksum(input.body);
    const key = buildStorageKey(input.namespace, checksum, input.originalName);

    const alreadyExisted = await this.fileExists(key);
    if (!alreadyExisted) {
      await this.putObject(key, input.body, input.contentType, {
        'original-name': encodeURIComponent(input.originalName),
        checksum,
      });
    }
    logger.debug('File stored', { provider: this.name, key, alreadyExisted });

    return {
      provider: this.name,
      key,
      checksum,
      sizeBytes: input.body.length,
      contentType: input.contentType,
      alreadyExisted,
    };
  }

  async uploadMany(inputs: UploadFileInput[], concurrency = 4): Promise<StoredFile[]> {
    const results = new Array<StoredFile>(inputs.length);
    let cursor = 0;
    const lanes = Array.from({ length: Math.min(concurrency, inputs.length) }, async () => {
      while (cursor < inputs.length) {
        const index = cursor++;
        results[index] = await this.uploadFile(inputs[index]!);
      }
    });
    await Promise.all(lanes);
    return results;
  }
}
