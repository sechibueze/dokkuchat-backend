import {
  DeleteObjectCommand,
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { BaseFileStorageProvider } from './base-storage.provider';
import { SignedUrlOptions } from './storage-provider.interface';

export interface S3Config {
  bucket: string;
  region: string;
  accessKeyId: string;
  secretAccessKey: string;
  endpoint?: string;
  forcePathStyle?: boolean;
}

const isNotFound = (error: unknown) => {
  const e = error as { name?: string; $metadata?: { httpStatusCode?: number } };
  return e.name === 'NotFound' || e.$metadata?.httpStatusCode === 404;
};

export class S3StorageProvider extends BaseFileStorageProvider {
  readonly name: string;
  private readonly client: S3Client;

  constructor(
    name: string,
    private readonly config: S3Config,
  ) {
    super();
    this.name = name;
    this.client = new S3Client({
      region: config.region,
      endpoint: config.endpoint,
      forcePathStyle: config.forcePathStyle,
      credentials: { accessKeyId: config.accessKeyId, secretAccessKey: config.secretAccessKey },
    });
  }

  protected async putObject(
    key: string,
    body: Buffer,
    contentType: string,
    metadata: Record<string, string>,
  ) {
    await this.client.send(
      new PutObjectCommand({
        Bucket: this.config.bucket,
        Key: key,
        Body: body,
        ContentType: contentType,
        Metadata: metadata,
      }),
    );
  }

  async fileExists(key: string) {
    try {
      await this.client.send(new HeadObjectCommand({ Bucket: this.config.bucket, Key: key }));
      return true;
    } catch (error) {
      if (isNotFound(error)) return false;
      throw error;
    }
  }

  async downloadFile(key: string) {
    const response = await this.client.send(
      new GetObjectCommand({ Bucket: this.config.bucket, Key: key }),
    );
    return Buffer.from(await response.Body!.transformToByteArray());
  }

  async deleteFile(key: string) {
    await this.client.send(new DeleteObjectCommand({ Bucket: this.config.bucket, Key: key }));
  }

  getFileUrl(key: string, { expiresInSeconds = 900, downloadName }: SignedUrlOptions = {}) {
    const command = new GetObjectCommand({
      Bucket: this.config.bucket,
      Key: key,
      ...(downloadName && {
        ResponseContentDisposition: `attachment; filename*=UTF-8''${encodeURIComponent(downloadName)}`,
      }),
    });
    return getSignedUrl(this.client, command, { expiresIn: expiresInSeconds });
  }
}
