import type { LogicalBlock } from '../../types/blocks.types.js';
import type { CertificationItem } from '../../types/cv.types.js';

export class CertificationsParserService {
  parse(_blocks: LogicalBlock[]): { items: CertificationItem[]; confidence: number } {
    return { items: [], confidence: 0.2 };
  }
}

