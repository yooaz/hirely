import type { LogicalBlock } from '../../types/blocks.types.js';
import type { ExperienceItem } from '../../types/cv.types.js';
import { newId, uniqueStrings } from '../_internal/utils.js';
import { parseDateRange } from '../_internal/date-patterns.js';

const BULLET_RE = /^[\s]*[-•●▪◦*]\s+/;

function cleanBullet(s: string): string {
  return String(s || '').replace(BULLET_RE, '').trim();
}

function isHeadingLike(block: LogicalBlock): boolean {
  const t = String(block.text || '');
  return block.type === 'heading' || t.length <= 40 && /^[A-ZÀ-Ÿ]/.test(t);
}

function isDateAnchor(block: LogicalBlock): boolean {
  return Boolean(parseDateRange(block.text || ''));
}

function blockSourceIds(block: LogicalBlock): string[] {
  return uniqueStrings((block.lines || []).flatMap((ln) => [ln.block_id]));
}

function durationMonths(start: string, end: string, isCurrent: boolean): number | null {
  if (isCurrent) return null;
  const sy = start.match(/^\d{4}$/);
  const ey = end.match(/^\d{4}$/);
  if (!sy || !ey) return null;
  const diff = Number(ey[0]) - Number(sy[0]);
  if (!Number.isFinite(diff)) return null;
  return Math.max(0, diff * 12);
}

export class ExperienceParserService {
  parse(blocks: LogicalBlock[]): { items: ExperienceItem[]; confidence: number } {
    const ordered = [...(blocks || [])].sort((a, b) => a.reading_order - b.reading_order);
    const items: ExperienceItem[] = [];

    let current: {
      role: string;
      company: string;
      location: string;
      start_date: string;
      end_date: string;
      is_current: boolean;
      description: string[];
      achievements: string[];
      skills: string[];
      confidenceSeedBlocks: LogicalBlock[];
    } | null = null;

    const flush = () => {
      if (!current) return;
      const source_block_ids = uniqueStrings(
        current.confidenceSeedBlocks.flatMap((b) => blockSourceIds(b))
      );

      const hasDesc = current.description.length > 0;
      const hasRole = Boolean(current.role);
      const hasCompany = Boolean(current.company);
      const hasDates = Boolean(current.start_date) && (Boolean(current.end_date) || current.is_current);

      const confidence =
        (hasDates ? 0.35 : 0) + (hasRole ? 0.2 : 0) + (hasCompany ? 0.2 : 0) + (hasDesc ? 0.25 : 0);

      items.push({
        id: newId('exp'),
        job_title: current.role,
        company: current.company,
        ...(current.location ? { location: current.location } : {}),
        ...(current.start_date ? { start_date: current.start_date } : {}),
        ...(current.end_date ? { end_date: current.end_date } : {}),
        is_current: current.is_current,
        duration_months: durationMonths(current.start_date, current.end_date, current.is_current),
        description: current.description,
        achievements: current.achievements,
        skills: current.skills,
        confidence: Math.min(1, confidence),
        source_block_ids,
      });
      current = null;
    };

    const findRoleCompany = (idx: number) => {
      const lookBehind = ordered.slice(Math.max(0, idx - 4), idx);
      const roleCand =
        lookBehind.find((b) => b.lines?.[0]?.signals?.looks_like_job_title) ||
        lookBehind.find((b) => String(b.text || '').length <= 60 && !isDateAnchor(b) && !BULLET_RE.test(b.text));
      const companyCand =
        lookBehind.find((b) => b.lines?.[0]?.signals?.looks_like_company) ||
        lookBehind.find((b) => /(Inc\.?|Ltd\.?|GmbH|SAS|SA|Corp\.?)/i.test(b.text || '') && !isDateAnchor(b));

      // Try also forward (some CVs put company/role after the date line)
      const lookAhead = ordered.slice(idx + 1, Math.min(ordered.length, idx + 4));
      const roleForward = lookAhead.find((b) => b.lines?.[0]?.signals?.looks_like_job_title);
      const companyForward = lookAhead.find((b) => b.lines?.[0]?.signals?.looks_like_company);

      return {
        role: (roleCand?.text || roleForward?.text || '').trim(),
        company: (companyCand?.text || companyForward?.text || '').trim(),
      };
    };

    for (let i = 0; i < ordered.length; i++) {
      const b = ordered[i]!;

      if (isDateAnchor(b)) {
        flush();
        const pr = parseDateRange(b.text || '')!;
        const { role, company } = findRoleCompany(i);
        current = {
          role: role || '',
          company: company || '',
          location: '',
          start_date: pr.start_date || '',
          end_date: pr.is_current ? (pr.end_date || 'present') : pr.end_date || '',
          is_current: pr.is_current,
          description: [],
          achievements: [],
          skills: [],
          confidenceSeedBlocks: [b],
        };
        continue;
      }

      if (!current) continue;

      const t = String(b.text || '').trim();
      if (!t) continue;

      // Stop description growth on likely next anchors/headers.
      if (b.type === 'heading' && !BULLET_RE.test(t)) continue;

      // Bullets are the most likely description content.
      if (BULLET_RE.test(t) || b.lines?.[0]?.signals?.looks_like_bullet) {
        const line = cleanBullet(t);
        if (line) current.description.push(line);
        if (line) current.achievements.push(line);
        current.confidenceSeedBlocks.push(b);
        continue;
      }

      // Non-bullet short narrative lines after the anchor also count as description.
      if (!isHeadingLike(b) && t.length <= 160) {
        current.description.push(t);
        current.confidenceSeedBlocks.push(b);
      }
    }

    flush();

    const confidence = items.length ? Math.max(...items.map((x) => x.confidence)) : 0.25;
    return { items, confidence };
  }
}

