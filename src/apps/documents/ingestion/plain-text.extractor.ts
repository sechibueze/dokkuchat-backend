import type { TextExtractor } from './text-extractor';

export class PlainTextExtractor implements TextExtractor {
  async extract(buffer: Buffer) {
    return { pages: [{ pageNumber: 1, text: buffer.toString('utf8') }] };
  }
}
