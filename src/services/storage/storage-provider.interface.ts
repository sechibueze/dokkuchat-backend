export interface UploadFileInput {
  namespace: string;
  originalName: string;
  contentType: string;
  body: Buffer;
}

export interface StoredFile {
  provider: string;
  key: string;
  checksum: string;
  sizeBytes: number;
  contentType: string;
  /** True when identical content was already stored and nothing was uploaded. */
  alreadyExisted: boolean;
}

export interface SignedUrlOptions {
  expiresInSeconds?: number;
  downloadName?: string;
}

export interface FileStorageProvider {
  readonly name: string;
  uploadFile(input: UploadFileInput): Promise<StoredFile>;
  uploadMany(inputs: UploadFileInput[]): Promise<StoredFile[]>;
  getFileUrl(key: string, options?: SignedUrlOptions): Promise<string>;
  downloadFile(key: string): Promise<Buffer>;
  deleteFile(key: string): Promise<void>;
  fileExists(key: string): Promise<boolean>;
}
