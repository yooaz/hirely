import type { DocumentProfile } from '../../types/document.types.js';
import type { ExtractionResult, RawBlock, RawPage } from '../../types/extraction.types.js';
import { extractNativePdfLines } from '../../core/extraction/pdf-lines-native.js';
import { loadPdfFromBuffer } from '../_internal/pdf-loader.js';
import { stageTrace } from '../_internal/utils.js';

interface NativeLine {
  text: string;
  page: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

export class NativePdfExtractorService {
  async extract(buffer: Buffer | Uint8Array, profile: DocumentProfile): Promise<{
    result: ExtractionResult;
    trace: ReturnType<typeof stageTrace>;
  }> {
    const t0 = Date.now();
    const pdf = await loadPdfFromBuffer(buffer);
    const { pages: nativePages } = await extractNativePdfLines(pdf);

    const pages: RawPage[] = [];
    const blocks: RawBlock[] = [];
    let order = 0;

    for (const pg of nativePages) {
      const pageNum = pg.page;
      const lines = (pg.lines || []) as NativeLine[];
      const maxY = lines.reduce((m, l) => Math.max(m, l.y || 0), 0);
      const maxW = lines.reduce((m, l) => Math.max(m, (l.x || 0) + (l.width || 0)), 0);

      pages.push({
        page_number: pageNum,
        width: Math.max(595, maxW + 40),
        height: Math.max(842, maxY + 40),
        rotation: 0,
        has_native_text: pg.usable !== false,
        has_images: false,
      });

      for (const [idx, ln] of lines.entries()) {
        const text = String(ln.text || '').trim();
        if (!text) continue;
        blocks.push({
          block_id: `b_p${pageNum}_${idx}`,
          page_number: pageNum,
          text,
          bbox: {
            x: Number(ln.x) || 0,
            y: Number(ln.y) || 0,
            w: Number(ln.width) || Math.max(24, text.length * 6),
            h: Number(ln.height) || 14,
          },
          source: 'native_text',
          line_index: idx,
          reading_order: order++,
          column_id: 'main',
        });
      }
    }

    const fullText = blocks.map((b) => b.text).join('\n');

    return {
      result: {
        pages,
        blocks,
        profile: { ...profile, pages: pages.length || 1, ocr_required: fullText.replace(/\s/g, '').length < 120 },
      },
      trace: stageTrace('native_extraction_done', blocks.length ? 'ok' : 'degraded', t0, {
        pages: pages.length,
        blocks: blocks.length,
        chars: fullText.length,
      }),
    };
  }
}
