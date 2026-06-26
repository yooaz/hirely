import type { LogicalBlock } from '../../types/blocks.types.js';
import type { ProjectItem } from '../../types/cv.types.js';

export class ProjectsParserService {
  parse(_blocks: LogicalBlock[]): { items: ProjectItem[]; confidence: number } {
    return { items: [], confidence: 0.2 };
  }
}

