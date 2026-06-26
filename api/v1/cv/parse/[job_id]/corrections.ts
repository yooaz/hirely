import type { IncomingMessage, ServerResponse } from 'node:http';
import { ParseController } from '../../../../../src/api/parse.controller.js';
import { DocumentStorage } from '../../../../../src/storage/document-storage.js';
import { ParseResultRepository } from '../../../../../src/storage/parse-result.repository.js';
import { ParseJobWorker } from '../../../../../src/jobs/parse-job.worker.js';
import { ParseJobQueue } from '../../../../../src/jobs/parse-job.queue.js';

function getDeps() {
  const g = globalThis as any;
  if (g.__hirelyCvParseDeps) return g.__hirelyCvParseDeps;
  const documentStorage = new DocumentStorage();
  const resultRepository = new ParseResultRepository();
  const worker = new ParseJobWorker({ documentStorage, resultRepository });
  const queue = new ParseJobQueue(worker);
  const controller = new ParseController({ documentStorage, resultRepository, queue });
  g.__hirelyCvParseDeps = { documentStorage, resultRepository, worker, queue, controller };
  return g.__hirelyCvParseDeps;
}

export default async function handler(req: IncomingMessage, res: ServerResponse) {
  const url = String(req.url || '');
  const parts = url.split('/').filter(Boolean);
  const job_idFromUrl = parts[parts.length - 2] || '';
  const { controller } = getDeps();
  return controller.handleCorrections(req, res, job_idFromUrl);
}

export const config = {
  api: { bodyParser: false },
};

