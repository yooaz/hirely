import type { IncomingMessage, ServerResponse } from 'node:http';
import { DocumentIngestionService } from '../services/ingestion/document-ingestion.service.js';
import { ParseResultRepository } from '../storage/parse-result.repository.js';
import { DocumentStorage } from '../storage/document-storage.js';
import { ParseJobQueue } from '../jobs/parse-job.queue.js';
import { newId, setByPath } from '../services/_internal/utils.js';

import type { DocumentPayload } from '../types/document.types.js';
import type { CorrectionPayload, FieldUpdate } from '../types/review.types.js';

function json(res: ServerResponse, body: unknown, status = 200) {
  res.statusCode = status;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.end(JSON.stringify(body));
}

async function readBody(req: IncomingMessage): Promise<Buffer> {
  const chunks: Buffer[] = [];
  for await (const c of req) chunks.push(Buffer.isBuffer(c) ? c : Buffer.from(c));
  return Buffer.concat(chunks);
}

function parseMultipart(buffer: Buffer, boundary: string) {
  const parts: Array<{ name: string; filename?: string; data: Buffer }> = [];
  const b = `--${boundary}`;
  const sections = buffer.toString('binary').split(b).slice(1, -1);

  for (const section of sections) {
    const idx = section.indexOf('\r\n\r\n');
    if (idx < 0) continue;
    const head = section.slice(0, idx);
    const body = section.slice(idx + 4).replace(/\r\n--$/, '').replace(/\r\n$/, '');
    const nameMatch = /name="([^"]+)"/.exec(head);
    const fileMatch = /filename="([^"]+)"/.exec(head);
    parts.push({
      name: nameMatch?.[1] || 'file',
      filename: fileMatch?.[1],
      data: Buffer.from(body, 'binary'),
    });
  }
  return parts;
}

export class ParseController {
  private ingestion = new DocumentIngestionService();

  constructor(private deps: {
    documentStorage: DocumentStorage;
    resultRepository: ParseResultRepository;
    queue: ParseJobQueue;
  }) {}

  async handleCreateParse(req: IncomingMessage, res: ServerResponse) {
    if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);

    try {
      const ct = String(req.headers['content-type'] || '');
      const bodyBuf = await readBody(req);

      let fileBuf: Buffer | null = null;
      let filename: string | null = null;
      let mime_type: string | null = null;
      let text: string | null = null;
      let language_hint: 'fr' | 'en' | undefined;
      let user_id: string | undefined;

      if (ct.includes('application/json')) {
        const raw = bodyBuf.toString('utf8');
        const body = JSON.parse(raw || '{}');
        if (body?.text) text = String(body.text);
        language_hint = body?.language_hint || undefined;
        user_id = body?.user_id || undefined;
        if (body?.fileBase64) {
          filename = body?.filename || 'upload.bin';
          mime_type = body?.mime_type || 'application/octet-stream';
          fileBuf = Buffer.from(String(body.fileBase64).replace(/^data:[^;]+;base64,/, ''), 'base64');
        }
      } else if (ct.includes('multipart/form-data')) {
        const boundary = /boundary=(.+)$/i.exec(ct)?.[1]?.trim();
        if (!boundary) throw new Error('MISSING_MULTIPART_BOUNDARY');
        const parts = parseMultipart(bodyBuf, boundary);
        const file = parts.find((p) => p.name === 'file' || p.filename);
        fileBuf = file?.data || null;
        filename = file?.filename || 'upload.bin';
        // We don't get mime_type from multipart parser (phase1). We'll infer by filename.
        mime_type = (filename || '').toLowerCase().endsWith('.docx')
          ? 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'
          : (filename || '').toLowerCase().match(/\\.(png|jpe?g|webp)$/)
            ? `image/${(filename || '').toLowerCase().match(/\\.(png|jpe?g|webp)$/)![1]}`
            : 'application/pdf';

        // Optional fields are not parsed in this minimal multipart parser.
      } else {
        // Fallback: treat as raw text upload.
        const raw = bodyBuf.toString('utf8');
        if (raw.trim().length >= 10) text = raw;
      }

      const payload: DocumentPayload = this.ingestion.ingest({
        buffer: fileBuf || undefined,
        text: text || undefined,
        filename: filename || undefined,
        mime_type: mime_type || undefined,
        language_hint: language_hint,
        user_id,
      }) as any;

      const job_id = newId('job');
      this.deps.resultRepository.create(job_id);
      this.deps.resultRepository.updateStatus(job_id, 'processing');

      this.deps.documentStorage.put(job_id, payload);
      this.deps.queue.enqueue(job_id);

      return json(res, { job_id, status: 'processing' });
    } catch (e: any) {
      return json(res, { error: e?.message || 'parse_create_failed' }, 500);
    }
  }

  async handleGetParse(req: IncomingMessage, res: ServerResponse, job_id: string) {
    if (req.method !== 'GET') return json(res, { error: 'Method not allowed' }, 405);
    const rec = this.deps.resultRepository.get(job_id);
    if (!rec) return json(res, { error: 'job not found' }, 404);

    return json(res, {
      job_id,
      status: rec.status,
      result: rec.result,
      error: rec.error,
    });
  }

  async handleCorrections(
    req: IncomingMessage,
    res: ServerResponse,
    job_id: string
  ) {
    if (req.method !== 'POST') return json(res, { error: 'Method not allowed' }, 405);
    const rec = this.deps.resultRepository.get(job_id);
    if (!rec?.result) return json(res, { error: 'job not found or not ready' }, 404);

    try {
      const bodyBuf = await readBody(req);
      const body = JSON.parse(bodyBuf.toString('utf8') || '{}');
      const correction = body as CorrectionPayload;

      // Apply corrections deterministically on canonical CV.
      const cv = structuredClone(rec.result.cv);
      for (const upd of correction.field_updates as FieldUpdate[]) {
        setByPath(cv as any, String(upd.path || ''), upd.value);
      }

      const updatedResult = {
        ...rec.result,
        cv,
      };
      this.deps.resultRepository.setDone(job_id, updatedResult);
      return json(res, {
        job_id,
        status: 'done',
        cv,
        confidence: rec.result?.confidence,
        review_hints: rec.result?.review_hints || [],
      });
    } catch (e: any) {
      return json(res, { error: e?.message || 'corrections_failed' }, 500);
    }
  }
}

