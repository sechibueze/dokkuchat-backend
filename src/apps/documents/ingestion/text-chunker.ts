import type { ExtractedPage } from './text-extractor';

export interface TextChunk {
  chunkIndex: number;
  content: string;
  pageNumber: number;
}

export interface ChunkingOptions {
  maxChars: number;
  overlapChars: number;
}

export const DEFAULT_CHUNKING: ChunkingOptions = { maxChars: 2000, overlapChars: 20 };

const normalize = (text: string) =>
  text
    .replace(/\r\n/g, '\n')
    .replace(/\0/g, '')
    .replace(/[ \t]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .trim();

function hardSlice(text: string, maxChars: number) {
  const slices: string[] = [];
  for (let start = 0; start < text.length; start += maxChars)
    slices.push(text.slice(start, start + maxChars));
  return slices;
}

function splitLongParagraph(paragraph: string, maxChars: number) {
  const pieces: string[] = [];
  let current = '';
  for (const sentence of paragraph.split(/(?<=[.!?])\s+/)) {
    for (const part of hardSlice(sentence, maxChars)) {
      const candidate = current ? `${current} ${part}` : part;
      if (candidate.length <= maxChars) {
        current = candidate;
      } else {
        pieces.push(current);
        current = part;
      }
    }
  }
  if (current) pieces.push(current);
  return pieces;
}

/** Trailing text of the previous chunk, trimmed to start at a word boundary. */
function tailOverlap(text: string, overlapChars: number) {
  if (!overlapChars || !text) return '';
  const tail = text.slice(-overlapChars);
  const firstSpace = tail.search(/\s/);
  return (firstSpace === -1 ? tail : tail.slice(firstSpace + 1)).trim();
}

function splitText(text: string, { maxChars, overlapChars }: ChunkingOptions) {
  if (!text) return [];

  const units = text
    .split(/\n{2,}/)
    .flatMap((paragraph) =>
      paragraph.length <= maxChars ? [paragraph] : splitLongParagraph(paragraph, maxChars),
    );

  const chunks: string[] = [];
  let current = '';
  for (const unit of units) {
    const candidate = current ? `${current}\n\n${unit}` : unit;
    if (candidate.length <= maxChars) {
      current = candidate;
      continue;
    }
    if (current) chunks.push(current);
    const overlap = tailOverlap(current, overlapChars);
    current =
      overlap && overlap.length + unit.length + 2 <= maxChars ? `${overlap}\n\n${unit}` : unit;
  }
  if (current.trim()) chunks.push(current);
  return chunks;
}

export function chunkPages(
  pages: ExtractedPage[],
  options: ChunkingOptions = DEFAULT_CHUNKING,
): TextChunk[] {
  const chunks: TextChunk[] = [];
  for (const page of pages) {
    for (const content of splitText(normalize(page.text), options)) {
      chunks.push({ chunkIndex: chunks.length, content, pageNumber: page.pageNumber });
    }
  }
  return chunks;
}
