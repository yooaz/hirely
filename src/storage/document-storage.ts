import type { DocumentPayload } from '../types/document.types.js';

type DocStore = Map<string, DocumentPayload>;

function getStore(): DocStore {
  const g = globalThis as any;
  if (!g.__hirelyCvParseDocs) g.__hirelyCvParseDocs = new Map<string, DocumentPayload>();
  return g.__hirelyCvParseDocs as DocStore;
}

export class DocumentStorage {
  put(job_id: string, payload: DocumentPayload): void {
    getStore().set(job_id, payload);
  }

  get(job_id: string): DocumentPayload | undefined {
    return getStore().get(job_id);
  }

  delete(job_id: string): void {
    getStore().delete(job_id);
  }
}

