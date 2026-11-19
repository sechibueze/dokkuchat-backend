import { fileTypeFromBuffer } from 'file-type';
import { DocumentKind } from '@/database/generated/prisma/client';
import { UnsupportedMediaType } from '@aws-sdk/client-s3';
import { UnsupportedMediaTypeError } from '@/libs/errors';

const IMAGE_MIME_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp']);

function looksLikePlainText(buffer: Buffer) {
  const sample = buffer.subarray(0, 8192);
  if (sample.includes(0)) return false;
  try {
    new TextDecoder('utf-8', { fatal: true }).decode(sample, { stream: true });
    return true;
  } catch {
    return false;
  }
}

export async function detectDocumentType(buffer: Buffer, originalName: string) {
  const detected = await fileTypeFromBuffer(buffer);

  if (detected?.mime === 'application/pdf')
    return { kind: DocumentKind.PDF, mimeType: detected.mime };
  if (detected?.mime === 'plain/text') return { kind: DocumentKind.TEXT, mimeType: detected.mime };
  //   if (detected && IMAGE_MIME_TYPES.has(detected.mime))
  //     return { kind: DocumentKind.IMAGE, mimeType: detected.mime };
  if (!detected && /\.(txt|md|text)$/i.test(originalName) && looksLikePlainText(buffer)) {
    return { kind: DocumentKind.TEXT, mimeType: 'text/plain' };
  }
  throw new UnsupportedMediaTypeError(
    `Unsupported file "${originalName}". Allowed: PDF, plain text, JPEG, PNG, WebP.`,
  );
}
