import type { LogicalBlock } from '../../types/blocks.types.js';
import type { ContactInfo } from '../../types/cv.types.js';
import { EMAIL_PATTERN, PHONE_PATTERN } from '../_internal/block-signals.js';
import { uniqueStrings, tokenize } from '../_internal/utils.js';

function uniq<T>(arr: T[]): T[] {
  return [...new Set(arr)];
}

function blockSourceIds(block: LogicalBlock): string[] {
  const ids: string[] = [];
  for (const ln of block.lines || []) ids.push(ln.block_id);
  return uniq(ids);
}

function isUrl(s: string) {
  return /\bhttps?:\/\/\S+/i.test(s) || /\bwww\.\S+/i.test(s) || /linkedin\.com|github\.com/i.test(s);
}

function normalizePhone(raw: string): string {
  return String(raw || '')
    .replace(/[^\d+]/g, '')
    .replace(/^\+?/, (m) => (m === '' ? '+' : '+'));
}

function extractUrls(text: string): string[] {
  const out: string[] = [];
  const m = String(text || '').match(/\bhttps?:\/\/[^\s)]+/gi);
  if (m) out.push(...m);
  if (/linkedin\.com/i.test(text)) out.push(...(text.match(/linkedin\.com\/[^\s)]+/gi) || []));
  if (/github\.com/i.test(text)) out.push(...(text.match(/github\.com\/[^\s)]+/gi) || []));
  return out;
}

function looksLikePersonName(s: string): boolean {
  const t = String(s || '').trim();
  if (!t) return false;
  if (EMAIL_PATTERN.test(t) || PHONE_PATTERN.test(t) || isUrl(t)) return false;
  if (/\b(education|experience|skills|certifications|projects)\b/i.test(t)) return false;
  if (t.length > 48) return false;
  const tokens = tokenize(t);
  if (tokens.length < 2 || tokens.length > 5) return false;
  // Basic capitalization check.
  return tokens.every((w) => /^[A-ZÀ-Ÿ][A-Za-zÀ-ÿ'-]+$/.test(w) || /^[A-ZÀ-Ÿ]\.$/.test(w));
}

export class ContactParserService {
  parse(blocks: LogicalBlock[]): ContactInfo {
    const ordered = [...(blocks || [])].sort((a, b) => a.reading_order - b.reading_order);
    const allText = ordered.map((b) => b.text).join('\n');

    const emails = uniq(
      ordered
        .flatMap((b) => String(b.text || '').match(EMAIL_PATTERN) || [])
        .map((e) => String(e).trim())
    );

    const phones = uniq(
      ordered
        .flatMap((b) => String(b.text || '').match(PHONE_PATTERN) || [])
        .map((p) => normalizePhone(p))
        .filter((p) => p.length >= 8)
    );

    const urls = uniq(extractUrls(allText));
    const linkedin = urls.find((u) => /linkedin\.com/i.test(u)) || '';
    const github = urls.find((u) => /github\.com/i.test(u)) || '';
    const website = urls.find((u) => !/linkedin\.com|github\.com/i.test(u)) || '';

    let full_name = '';
    let title = '';
    for (const b of ordered) {
      if (!full_name && looksLikePersonName(b.text)) {
        full_name = b.text.trim();
        continue;
      }
      if (full_name && !title) {
        const t = String(b.text || '').trim();
        if (t && t.length <= 40 && !isUrl(t) && !EMAIL_PATTERN.test(t) && !PHONE_PATTERN.test(t)) {
          title = t;
          if (title) break;
        }
      }
    }

    // Location: a short line containing country/city-ish patterns.
    const locationCandidate = ordered
      .map((b) => b.text.trim())
      .filter(Boolean)
      .find((t) => {
        if (!t) return false;
        if (EMAIL_PATTERN.test(t) || PHONE_PATTERN.test(t) || isUrl(t)) return false;
        if (looksLikePersonName(t)) return false;
        // Many CVs use "City, Country"
        return /(France|Belgium|Germany|Spain|Italy|Netherlands|Paris|London|Berlin|Madrid|Rome|Amsterdam|Lyon|Marseille|Nice|Barcelona|Munich)/i.test(
          t
        );
      });

    const location = locationCandidate || '';

    const source_block_ids = uniq(
      ordered
        .filter((b) => EMAIL_PATTERN.test(b.text) || PHONE_PATTERN.test(b.text) || isUrl(b.text) || looksLikePersonName(b.text) || b.text === locationCandidate)
        .flatMap((b) => blockSourceIds(b))
    );

    return {
      full_name,
      title,
      emails,
      phones,
      location,
      linkedin,
      website,
      github,
      source_block_ids,
      confidence: Math.min(
        1,
        (full_name ? 0.35 : 0) +
          (emails.length ? 0.35 : 0) +
          (phones.length ? 0.2 : 0) +
          (title ? 0.1 : 0)
      ),
    };
  }
}

