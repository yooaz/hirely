import type { CVCanonical } from '../types/cv.types.js';
import type { ConfidenceReport } from '../types/cv.types.js';
import type { ReviewHint, ValidationReport } from '../types/review.types.js';
import type { ParsingTrace } from '../types/cv.types.js';

export type ParseJobStatus = 'queued' | 'processing' | 'done' | 'failed';

export interface ParseJobError {
  code: string;
  message: string;
  trace?: ParsingTrace;
}

export interface ParseJobRecord {
  job_id: string;
  status: ParseJobStatus;
  created_at: string;
  updated_at: string;
  result?: {
    cv: CVCanonical;
    confidence: ConfidenceReport;
    review_hints: ReviewHint[];
    validation?: ValidationReport;
    trace: ParsingTrace;
  };
  error?: ParseJobError;
}

function getStore(): Map<string, ParseJobRecord> {
  const g = globalThis as any;
  if (!g.__hirelyCvParseResults) g.__hirelyCvParseResults = new Map<string, ParseJobRecord>();
  return g.__hirelyCvParseResults as Map<string, ParseJobRecord>;
}

export class ParseResultRepository {
  create(job_id: string): ParseJobRecord {
    const now = new Date().toISOString();
    const rec: ParseJobRecord = {
      job_id,
      status: 'queued',
      created_at: now,
      updated_at: now,
    };
    getStore().set(job_id, rec);
    return rec;
  }

  updateStatus(job_id: string, status: ParseJobStatus): void {
    const rec = getStore().get(job_id);
    if (!rec) return;
    rec.status = status;
    rec.updated_at = new Date().toISOString();
  }

  setDone(job_id: string, result: ParseJobRecord['result']): void {
    const rec = getStore().get(job_id);
    if (!rec) return;
    rec.status = 'done';
    rec.updated_at = new Date().toISOString();
    rec.result = result;
  }

  setFailed(job_id: string, error: ParseJobError): void {
    const rec = getStore().get(job_id);
    if (!rec) return;
    rec.status = 'failed';
    rec.updated_at = new Date().toISOString();
    rec.error = error;
  }

  get(job_id: string): ParseJobRecord | undefined {
    return getStore().get(job_id);
  }
}

