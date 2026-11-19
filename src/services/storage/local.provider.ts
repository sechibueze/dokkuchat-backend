import { access, mkdir, readFile, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';
import { BaseFileStorageProvider } from './base-storage.provider';

export class LocalDiskStorageProvider extends BaseFileStorageProvider {
  readonly name = 'local';
  private readonly root: string;

  constructor(rootDirectory: string) {
    super();
    this.root = path.resolve(rootDirectory);
  }

  private resolveSafe(key: string) {
    const target = path.resolve(this.root, key);
    if (!target.startsWith(this.root + path.sep)) throw new Error('Invalid storage key');
    return target;
  }

  protected async putObject(key: string, body: Buffer) {
    const target = this.resolveSafe(key);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, body);
  }

  async fileExists(key: string) {
    try {
      await access(this.resolveSafe(key));
      return true;
    } catch {
      return false;
    }
  }

  async downloadFile(key: string) {
    return readFile(this.resolveSafe(key));
  }

  async deleteFile(key: string) {
    await rm(this.resolveSafe(key), { force: true });
  }

  /** Development only: a file:// URL is not reachable by API clients. */
  async getFileUrl(key: string) {
    return pathToFileURL(this.resolveSafe(key)).href;
  }
}
