import type { DocumentProfile } from '../../types/document.types.js';
import type { ExtractionResult, RawBlock, RawPage } from '../../types/extraction.types.js';
import { stageTrace } from '../_internal/utils.js';

export class TextExtractorService {
  extract(text: string, profile: DocumentProfile): {
    result: ExtractionResult;
    trace: ReturnType<typeof stageTrace>;
  } {
    const t0 = Date.now();
    const lines = String(text || '')
      .split(/\r?\n/)
      .map((l) => l.trim())
      .filter(Boolean);

    const pages: RawPage[] = [{
      page_number: 1,
      width: 595,
      height: Math.max(842, lines.length * 16 + 100),
      rotation: 0,
      has_native_text: true,
      has_images: false,
    }];

    const blocks: RawBlock[] = lines.map((line, idx) => ({
      block_id: `b_txt_${idx}`,
      page_number: 1,
      text: line,
      bbox: { x: 72, y: 800 - idx * 16, w: Math.max(24, line.length * 6), h: 14 },
      source: 'plain_text',
      line_index: idx,
      reading_order: idx,
      column_id: 'main',
    }));

    return {
      result: { pages, blocks, profile: { ...profile, pages: 1 } },
      trace: stageTrace('text_extraction_done', 'ok', t0, { blocks: blocks.length }),
    };
  }
}
