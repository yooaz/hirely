import { randomUUID } from 'node:crypto';
import type { DocumentInput, DocumentPayload, IngestedDocument, SourceType } from '../../types/document.types.js';

const MIME_MAP: Record<string, SourceType> = {
  'application/pdf': 'pdf',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document': 'docx',
  'image/png': 'image',
  'image/jpeg': 'image',
  'image/jpg': 'image',
  'image/webp': 'image',
  'text/plain': 'text',
};

export class DocumentIngestionService {
  ingest(params: {
    buffer?: Buffer | Uint8Array;
    text?: string;
    filename?: string;
    mime_type?: string;
    language_hint?: 'fr' | 'en';
    user_id?: string;
  }): IngestedDocument {
    const filename = params.filename || (params.text ? 'pasted.txt' : 'upload.bin');
    const mime = params.mime_type || (params.text ? 'text/plain' : 'application/octet-stream');
    const source_type = MIME_MAP[mime] || (params.text ? 'text' : 'pdf');

    const input: DocumentInput = {
      document_id: randomUUID(),
      source_type,
      filename,
      mime_type: mime,
      language_hint: params.language_hint,
      user_id: params.user_id,
      uploaded_at: new Date().toISOString(),
    };

    const payload: IngestedDocument = {
      input,
      buffer: params.buffer,
      text: params.text,
    };

    return payload;
  }

  toPayload(doc: IngestedDocument): DocumentPayload {
    return { input: doc.input, buffer: doc.buffer, text: doc.text };
  }
}
