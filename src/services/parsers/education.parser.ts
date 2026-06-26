import type { LogicalBlock } from '../../types/blocks.types.js';
import type { EducationItem } from '../../types/cv.types.js';
import { newId, uniqueStrings } from '../_internal/utils.js';
import { parseDateRange } from '../_internal/date-patterns.js';

const DEGREE_RE =
  /\b(Master|M\.?Sc|MSc|MBA|Bachelor|B\.?Sc|BSc|PhD|Doctorat|Licence|Maîtrise|Master|Mastère|Dipl[oô]me|Université|University|Formation)\b/i;

const SCHOOL_LIKE_RE =
  /\b(University|Université|École|Ecole|Universität|College|Institut|School)\b/i;

function blockSourceIds(block: LogicalBlock): string[] {
  return uniqueStrings((block.lines || []).map((ln) => ln.block_id));
}

function isEducationAnchor(block: LogicalBlock): boolean {
  const t = String(block.text || '');
  return DEGREE_RE.test(t) || Boolean(parseDateRange(t));
}

function durationMonths(start: string, end: string): number | null {
  const sy = start.match(/^\d{4}$/);
  const ey = end.match(/^\d{4}$/);
  if (!sy || !ey) return null;
  return Math.max(0, (Number(ey[0]) - Number(sy[0])) * 12);
}

export class EducationParserService {
  parse(blocks: LogicalBlock[]): { items: EducationItem[]; confidence: number } {
    const ordered = [...(blocks || [])].sort((a, b) => a.reading_order - b.reading_order);
    const items: EducationItem[] = [];

    let current: {
      degree: string;
      school: string;
      location: string;
      start_date: string;
      end_date: string;
      grade: string;
      description: string[];
      confidenceSeedBlocks: LogicalBlock[];
    } | null = null;

    const flush = () => {
      if (!current) return;
      const source_block_ids = uniqueStrings(
        current.confidenceSeedBlocks.flatMap((b) => blockSourceIds(b))
      );

      const hasDegree = Boolean(current.degree);
      const hasSchool = Boolean(current.school);
      const hasDates = Boolean(current.start_date) || Boolean(current.end_date);
      const hasDesc = current.description.length > 0;
      const confidence = (hasDegree ? 0.35 : 0) + (hasSchool ? 0.3 : 0) + (hasDates ? 0.2 : 0) + (hasDesc ? 0.15 : 0);

      items.push({
        id: newId('edu'),
        degree: current.degree,
        school: current.school,
        ...(current.location ? { location: current.location } : {}),
        ...(current.start_date ? { start_date: current.start_date } : {}),
        ...(current.end_date ? { end_date: current.end_date } : {}),
        ...(current.grade ? { grade: current.grade } : {}),
        description: current.description,
        confidence: Math.min(1, confidence),
        source_block_ids,
      });
      current = null;
    };

    for (let i = 0; i < ordered.length; i++) {
      const b = ordered[i]!;
      const isAnchor = isEducationAnchor(b);
      if (isAnchor) {
        flush();
        const pr = parseDateRange(b.text || '');

        // Look behind/forward for school/degree.
        const lookBehind = ordered.slice(Math.max(0, i - 2), i);
        const degreeCand = lookBehind.find((x) => DEGREE_RE.test(x.text || '')) || b;
        const schoolCand =
          lookBehind.find((x) => SCHOOL_LIKE_RE.test(x.text || '')) ||
          ordered.slice(i + 1, i + 3).find((x) => SCHOOL_LIKE_RE.test(x.text || '')) ||
          b;

        current = {
          degree: String(degreeCand.text || '').trim().slice(0, 120),
          school: String(schoolCand.text || '').trim().slice(0, 140),
          location: '',
          start_date: pr?.start_date || '',
          end_date: pr ? (pr.is_current ? 'present' : pr.end_date || '') : '',
          grade: '',
          description: [],
          confidenceSeedBlocks: [b],
        };
        continue;
      }

      if (!current) continue;
      const t = String(b.text || '').trim();
      if (!t) continue;
      if (current.description.length < 6) {
        current.description.push(t);
        current.confidenceSeedBlocks.push(b);
      }
    }

    flush();
    const confidence = items.length ? Math.max(...items.map((x) => x.confidence)) : 0.25;
    return { items, confidence };
  }
}

