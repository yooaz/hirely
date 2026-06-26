import type { LogicalBlock } from '../../types/blocks.types.js';
import type { LanguageSkill } from '../../types/cv.types.js';
import { uniqueStrings } from '../_internal/utils.js';

function blockSourceIds(block: LogicalBlock): string[] {
  return uniqueStrings((block.lines || []).map((ln) => ln.block_id));
}

export class LanguagesParserService {
  parse(blocks: LogicalBlock[]): { languages: LanguageSkill[]; confidence: number } {
    const ordered = [...(blocks || [])].sort((a, b) => a.reading_order - b.reading_order);
    const nonEmpty = ordered.filter((b) => String(b.text || '').trim().length > 0);
    if (!nonEmpty.length) return { languages: [], confidence: 0.3 };

    const out: LanguageSkill[] = [];
    for (const b of nonEmpty) {
      const t = String(b.text || '').trim();
      if (!t) continue;
      const parts = t.split(/[:\-–—]/).map((p) => p.trim()).filter(Boolean);
      if (parts.length < 1) continue;
      const language = parts[0] || t;
      const levelRaw = parts[1] || '';
      if (!language) continue;
      const levelLower = levelRaw.toLowerCase();
      const level =
        levelLower.includes('native') || levelLower.includes('natif')
          ? 'native'
          : (levelRaw as LanguageSkill['level']);
      out.push({
        language,
        level: level || undefined,
      });
    }

    return { languages: out.slice(0, 10), confidence: out.length ? 0.55 : 0.25 };
  }
}
