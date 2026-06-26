import type { LayoutAnalysis } from '../../types/layout.types.js';
import type { NormalizedBlock } from '../../types/blocks.types.js';
import type { RawBlock } from '../../types/extraction.types.js';
import { computeBlockSignals } from '../_internal/block-signals.js';
import { tokenize } from '../_internal/utils.js';
import { normalizeLineText } from '../_internal/ocr-noise.js';

function assignColumnId(block: RawBlock, layout: LayoutAnalysis): NormalizedBlock['column_id'] {
  if (!layout.columns?.length) return block.column_id;
  const cx = block.bbox.x + block.bbox.w / 2;
  const found = layout.columns.find((c) => {
    const x = c.bbox.x;
    const x2 = c.bbox.x + c.bbox.w;
    return cx >= x && cx <= x2;
  });
  return found?.column_id || block.column_id;
}

function computeReadingOrder(a: RawBlock, b: RawBlock): number {
  // smaller page first, then top-down y
  if ((a.page_number || 1) !== (b.page_number || 1)) return (a.page_number || 1) - (b.page_number || 1);
  return (a.bbox?.y || 0) - (b.bbox?.y || 0);
}

export class TextNormalizerService {
  normalize(rawBlocks: RawBlock[], layout: LayoutAnalysis): NormalizedBlock[] {
    const blocks = [...(rawBlocks || [])].filter((b) => String(b.text || '').trim().length > 0);

    // If reading_order missing, compute stable sort order and then stamp it.
    const hasReadingOrder = blocks.every((b) => Number.isFinite(b.reading_order));
    const ordered = hasReadingOrder ? blocks : [...blocks].sort(computeReadingOrder);

    const stamped = hasReadingOrder
      ? ordered
      : ordered.map((b, idx) => ({
          ...b,
          reading_order: idx,
        }));

    return stamped.map((b) => {
      const rawText = String(b.text || '');
      const normalized = normalizeLineText(rawText);
      const tokens = tokenize(normalized);
      const signals = computeBlockSignals(normalized, {
        isBold: b.is_bold,
        fontSize: b.font_size,
      });

      return {
        block_id: b.block_id,
        raw_text: rawText,
        normalized_text: normalized,
        tokens,
        bbox: b.bbox,
        page_number: b.page_number || 1,
        column_id: assignColumnId(b, layout),
        reading_order: b.reading_order || 0,
        signals,
      };
    });
  }
}

