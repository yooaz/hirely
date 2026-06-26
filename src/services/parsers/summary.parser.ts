import type { LogicalBlock } from '../../types/blocks.types.js';
import { uniqueStrings } from '../_internal/utils.js';

function blockSourceIds(block: LogicalBlock): string[] {
  const ids: string[] = [];
  for (const ln of block.lines || []) ids.push(ln.block_id);
  return uniqueStrings(ids);
}

function cleanBullets(s: string): string {
  return String(s || '').replace(/^[\s]*[-•●▪◦*]\s+/g, '').trim();
}

export class SummaryParserService {
  parse(blocks: LogicalBlock[]): { summary: string; source_block_ids: string[]; confidence: number } {
    const ordered = [...(blocks || [])].sort((a, b) => a.reading_order - b.reading_order);
    const lines = ordered.map((b) => cleanBullets(b.text)).filter(Boolean);

    // Summary tends to be 2-8 lines of narrative, not bullets.
    const summaryLines = lines.slice(0, 8);
    const summary = summaryLines.join(' ');

    const source_block_ids = uniqueStrings(ordered.flatMap(blockSourceIds));
    const confidence = summary.length >= 60 ? 0.8 : summary.length >= 25 ? 0.6 : 0.35;

    return { summary, source_block_ids, confidence };
  }
}

