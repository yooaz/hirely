import type { DocumentPayload, DocumentProfile, DetectedLanguage } from '../../types/document.types.js';
import { stageTrace } from '../_internal/utils.js';

const NATIVE_MIN_CHARS = 120;

function detectLanguage(text: string, hint?: string): DetectedLanguage {
  if (hint === 'fr' || hint === 'en') return hint;
  const fr = (text.match(/\b(le|la|les|des|une|expérience|formation|compétences)\b/gi) || []).length;
  const en = (text.match(/\b(the|and|experience|education|skills)\b/gi) || []).length;
  if (fr > en + 2) return 'fr';
  if (en > fr + 2) return 'en';
  return 'unknown';
}

export class DocumentClassifierService {
  async classify(payload: DocumentPayload, probeText = ''): Promise<{ profile: DocumentProfile; trace: ReturnType<typeof stageTrace> }> {
    const t0 = Date.now();
    const { input } = payload;
    const text = probeText || payload.text || '';

    let profile: DocumentProfile;

    if (input.source_type === 'text') {
      profile = {
        document_kind: 'plain_text',
        pages: 1,
        layout_hint: 'single_column',
        language: detectLanguage(text, input.language_hint),
        ocr_required: false,
        confidence: 0.95,
      };
    } else if (input.source_type === 'docx') {
      profile = {
        document_kind: 'docx',
        pages: 1,
        layout_hint: 'single_column',
        language: detectLanguage(text, input.language_hint),
        ocr_required: false,
        confidence: 0.92,
      };
    } else if (input.source_type === 'image') {
      profile = {
        document_kind: 'image_scanned',
        pages: 1,
        layout_hint: 'unknown',
        language: detectLanguage(text, input.language_hint),
        ocr_required: true,
        confidence: 0.88,
      };
    } else {
      const nativeChars = text.replace(/\s/g, '').length;
      const isNative = nativeChars >= NATIVE_MIN_CHARS;
      profile = {
        document_kind: isNative ? 'pdf_native' : 'pdf_scanned',
        pages: Math.max(1, Math.ceil(nativeChars / 2500) || 1),
        layout_hint: 'unknown',
        language: detectLanguage(text, input.language_hint),
        ocr_required: !isNative,
        confidence: isNative ? 0.96 : 0.72,
      };
    }

    return {
      profile,
      trace: stageTrace('document_classified', 'ok', t0, {
        document_kind: profile.document_kind,
        pages: profile.pages,
        ocr_required: profile.ocr_required,
      }),
    };
  }

  refineAfterExtraction(
    profile: DocumentProfile,
    extractedText: string,
    pageCount: number
  ): DocumentProfile {
    const chars = extractedText.replace(/\s/g, '').length;
    if (profile.document_kind === 'pdf_native' && chars < NATIVE_MIN_CHARS) {
      return { ...profile, document_kind: 'pdf_scanned', ocr_required: true, pages: pageCount, confidence: 0.7 };
    }
    if (profile.document_kind === 'pdf_scanned' && chars >= NATIVE_MIN_CHARS) {
      return { ...profile, document_kind: 'pdf_native', ocr_required: false, pages: pageCount, confidence: 0.94 };
    }
    return { ...profile, pages: pageCount || profile.pages };
  }
}
