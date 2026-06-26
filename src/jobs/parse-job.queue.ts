import type { ParseResultRepository } from '../storage/parse-result.repository.js';
import type { DocumentStorage } from '../storage/document-storage.js';
import type { ParseJobWorker } from './parse-job.worker.js';

export class ParseJobQueue {
  private queue: string[] = [];
  private pumping = false;

  constructor(private worker: ParseJobWorker) {}

  enqueue(job_id: string) {
    this.queue.push(job_id);
    this.pump();
  }

  private async pump() {
    if (this.pumping) return;
    this.pumping = true;
    try {
      while (this.queue.length) {
        const jobId = this.queue.shift();
        if (!jobId) break;
        await this.worker.run(jobId);
      }
    } finally {
      this.pumping = false;
    }
  }
}

