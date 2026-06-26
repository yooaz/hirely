import type { LogicalBlock, SectionBlocks, SectionId } from '../../types/blocks.types.js';
import type { LayoutAnalysis } from '../../types/layout.types.js';
import { matchSectionHeading } from '../_internal/section-headings.js';

function emptySections(): SectionBlocks {
  return {
    contact: [],
    summary: [],
    experience: [],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    projects: [],
    awards: [],
    publications: [],
    interests: [],
    other: [],
  };
}

function isContactLike(block: LogicalBlock): boolean {
  const t = String(block.text || '');
  return /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i.test(t) || /\+?\d[\d\s().-]{7,}/.test(t);
}

function isExperienceStart(block: LogicalBlock): boolean {
  const line = block.lines?.[0];
  if (!line) return false;
  const s = line.signals;
  const dateLike = Boolean(s?.looks_like_date);
  const titleLike = Boolean(s?.looks_like_job_title) || block.type === 'heading';
  return dateLike && titleLike;
}

export class SectionSegmenterService {
  segment(logical_blocks: LogicalBlock[], layout: LayoutAnalysis, language: string): SectionBlocks {
    const blocks = [...(logical_blocks || [])].sort((a, b) => a.reading_order - b.reading_order);
    const out = emptySections();

    const expIdx = blocks.findIndex(isExperienceStart);
    const experienceStart = expIdx >= 0 ? expIdx : blocks.length;

    let current: SectionId = 'contact';
    let seenAnyHeading = false;

    for (let i = 0; i < blocks.length; i++) {
      const b = blocks[i]!;
      const headingSection = matchSectionHeading(b.text);
      if (headingSection) {
        current = headingSection;
        seenAnyHeading = true;
        out[current].push(b);
        continue;
      }

      const inContactTop = i < experienceStart;

      if (inContactTop) {
        if (isContactLike(b) || b.type === 'contact') out.contact.push(b);
        else out.summary.push(b);
        continue;
      }

      // After experience starts: stick to detected headings; otherwise keep a heuristic.
      if (!seenAnyHeading) {
        out.other.push(b);
        continue;
      }

      // If current is still contact-ish, allow fallback.
      if (current === 'contact' && (b.type === 'contact' || isContactLike(b))) {
        out.contact.push(b);
        continue;
      }

      out[current].push(b);
    }

    // Never allow contact/summary to be completely empty on a text paste; keep at least top blocks.
    if (!out.contact.length && blocks.length) {
      const top = blocks.slice(0, Math.min(3, blocks.length));
      out.contact.push(...top.filter((x) => isContactLike(x) || x.type === 'contact'));
      if (!out.contact.length) out.contact.push(...top);
    }

    return out;
  }
}

