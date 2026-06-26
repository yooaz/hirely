import type { DocumentPayload, DocumentProfile } from '../../types/document.types.js';
import type { ExtractionResult } from '../../types/extraction.types.js';
import type { StageTrace } from '../../types/trace.types.js';
import { DocumentClassifierService } from '../ingestion/document-classifier.service.js';
import { DocxExtractorService } from './docx-extractor.service.js';
import { NativePdfExtractorService } from './native-pdf-extractor.service.js';
import { OcrExtractorService } from './ocr-extractor.service.js';
import { TextExtractorService } from './text-extractor.service.js';

export interface RoutedExtraction {
  result: ExtractionResult;
  traces: StageTrace[];
  profile: DocumentProfile;
}

export class ExtractionRouterService {
  private classifier = new DocumentClassifierService();
  private nativePdf = new NativePdfExtractorService();
  private docx = new DocxExtractorService();
  private text = new TextExtractorService();
  private ocr = new OcrExtractorService();

  async extract(payload: DocumentPayload, profile: DocumentProfile): Promise<RoutedExtraction> {
    const traces: StageTrace[] = [];
    const { input } = payload;

    if (input.source_type === 'text' && payload.text) {
      const { result, trace } = this.text.extract(payload.text, profile);
      traces.push(trace);
      return { result, traces, profile: result.profile };
    }

    if (!payload.buffer) {
      throw new Error('MISSING_DOCUMENT_BUFFER');
    }

    const normBuffer: Buffer | Uint8Array =
      payload.buffer instanceof ArrayBuffer ? new Uint8Array(payload.buffer) : (payload.buffer as any);

    if (input.source_type === 'docx') {
      const { result, trace } = await this.docx.extract(normBuffer, profile);
      traces.push(trace);
      const refined = this.classifier.refineAfterExtraction(
        result.profile,
        result.blocks.map((b) => b.text).join('\n'),
        result.pages.length
      );
      return { result: { ...result, profile: refined }, traces, profile: refined };
    }

    if (input.source_type === 'pdf') {
      const native = await this.nativePdf.extract(normBuffer, profile);
      traces.push(native.trace);
      const fullText = native.result.blocks.map((b) => b.text).join('\n');
      let refined = this.classifier.refineAfterExtraction(
        native.result.profile,
        fullText,
        native.result.pages.length
      );

      if (refined.ocr_required && refined.document_kind !== 'pdf_native') {
        const ocrAttempt = await this.ocr.extract(normBuffer, refined);
        traces.push(ocrAttempt.trace);
        if (ocrAttempt.result.blocks.length) {
          return { result: ocrAttempt.result, traces, profile: ocrAttempt.result.profile };
        }
        return { result: native.result, traces, profile: refined };
      }

      return { result: { ...native.result, profile: refined }, traces, profile: refined };
    }

    if (input.source_type === 'image') {
      const ocrRes = await this.ocr.extract(normBuffer, profile);
      traces.push(ocrRes.trace);
      return { result: ocrRes.result, traces, profile: ocrRes.result.profile };
    }

    throw new Error(`UNSUPPORTED_SOURCE_TYPE:${input.source_type}`);
  }
}
