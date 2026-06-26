import type { DocumentProfile } from '../../types/document.types.js';
import type { ExtractionResult } from '../../types/extraction.types.js';
import { stageTrace } from '../_internal/utils.js';

/**
 * Phase 2 — OCR for scanned PDF / images.
 * V1 returns empty blocks + degraded trace; review hints recommend paste/OCR UI path.
 */
export class OcrExtractorService {
  async extract(
    _buffer: Buffer | Uint8Array,
    profile: DocumentProfile
  ): Promise<{ result: ExtractionResult; trace: ReturnType<typeof stageTrace> }> {
    const t0 = Date.now();
    return {
      result: {
        pages: [{
          page_number: 1,
          width: 595,
          height: 842,
          rotation: 0,
          has_native_text: false,
          has_images: true,
        }],
        blocks: [],
        profile: { ...profile, ocr_required: true },
      },
      trace: stageTrace(
        'ocr_done',
        'degraded',
        t0,
        { blocks: 0 },
        ['OCR_BACKEND_PHASE2_NOT_WIRED'],
        'Use browser OCR pipeline or paste fallback until Phase 2 worker is enabled'
      ),
    };
  }
}
