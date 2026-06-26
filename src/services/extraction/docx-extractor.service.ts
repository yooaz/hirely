import mammoth from 'mammoth';
import { extractDocxTextFromBuffer } from '../../core/extraction/docx-extract.js';
import type { DocumentProfile } from '../../types/document.types.js';
import type { ExtractionResult, RawBlock, RawPage } from '../../types/extraction.types.js';
import { stageTrace } from '../_internal/utils.js';

export class DocxExtractorService {
  async extract(buffer: Buffer | Uint8Array, profile: DocumentProfile): Promise<{
    result: ExtractionResult;
    trace: ReturnType<typeof stageTrace>;
  }> {
    const t0 = Date.now();
    const ab = buffer instanceof Buffer ? buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength) : buffer;
    const text = await extractDocxTextFromBuffer(ab as ArrayBuffer, mammoth);

    const lines = String(text || '')
      .split('\n')
      .map((l) => l.trim())
      .filter(Boolean);

    const pages: RawPage[] = [{
      page_number: 1,
      width: 595,
      height: 842,
      rotation: 0,
      has_native_text: true,
      has_images: false,
    }];

    const blocks: RawBlock[] = lines.map((line, idx) => ({
      block_id: `b_docx_${idx}`,
      page_number: 1,
      text: line,
      bbox: { x: 72, y: 800 - idx * 16, w: Math.max(24, line.length * 6), h: 14 },
      source: 'docx',
      line_index: idx,
      reading_order: idx,
      column_id: 'main',
    }));

    return {
      result: { pages, blocks, profile: { ...profile, pages: 1 } },
      trace: stageTrace('docx_extraction_done', 'ok', t0, { blocks: blocks.length, chars: text.length }),
    };
  }
}
