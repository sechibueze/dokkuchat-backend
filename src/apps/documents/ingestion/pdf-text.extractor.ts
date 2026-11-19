import { PDFParse } from 'pdf-parse';
import type { TextExtractor } from './text-extractor';

export class PdfTextExtractor implements TextExtractor {
  async extract(buffer: Buffer) {
    const parser = new PDFParse({ data: new Uint8Array(buffer) });
    try {
      const result = await parser.getText();
      return { pages: result.pages.map((page) => ({ pageNumber: page.num, text: page.text })) };
    } finally {
      await parser.destroy();
    }
  }
}
