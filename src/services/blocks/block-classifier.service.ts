import type { LogicalBlockType, NormalizedBlock, SectionId } from '../../types/blocks.types.js';
import { computeBlockSignals } from '../_internal/block-signals.js';

export class BlockClassifierService {
  classify(line: NormalizedBlock): { type: LogicalBlockType; confidence: number } {
    const t = String(line.normalized_text || '').trim();
    const s = line.signals || computeBlockSignals(t, { fontSize: line.bbox?.h });

    if (s.looks_like_email || s.looks_like_phone) {
      return { type: 'contact', confidence: 0.86 };
    }

    if (s.looks_like_url) {
      return { type: 'contact', confidence: 0.72 };
    }

    if (s.looks_like_heading) {
      return { type: 'heading', confidence: 0.78 };
    }

    // Keep default unknown; section segmentation will do the rest.
    return { type: 'unknown', confidence: 0.42 };
  }
}

