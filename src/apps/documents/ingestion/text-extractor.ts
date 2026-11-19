import { DocumentKind } from '@/database/generated/prisma/client';
import { PdfTextExtractor } from './pdf-text.extractor';
import { PlainTextExtractor } from './plain-text.extractor';

export interface ExtractedPage {
  pageNumber: number;
  text: string;
}

export interface TextExtractor {
  extract(buffer: Buffer): Promise<{ pages: ExtractedPage[] }>;
}

const extractors: Partial<Record<DocumentKind, TextExtractor>> = {
  [DocumentKind.PDF]: new PdfTextExtractor(),
  [DocumentKind.TEXT]: new PlainTextExtractor(),
};

/** Undefined means the kind has nothing to extract (images). */
export const getTextExtractor = (kind: DocumentKind) => extractors[kind];
