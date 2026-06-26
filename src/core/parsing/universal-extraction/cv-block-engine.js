/**
 * CV_BLOCK_ENGINE — structural block detection before classification.
 * Uses position, spacing, capitalization, bullet density, date density — not keywords only.
 */
import { normalizeOcrLineInput } from '../block-builder-v1.js';
import { fuzzySectionKey } from '../section-fuzzy.js';
import { isSectionHeaderLine } from '../rich-parser.js';
import { detectDatesInText } from './date-detector.js';
import { detectCompanyInLine } from './company-detector.js';
import { detectRoleInLine } from './role-detector.js';
import { CV_BLOCK_ENGINE, CV_BLOCK_TYPES } from './types.js';
import { hirelyDebugLog } from '../../runtime/hirely-debug.js';

const BULLET_RE = /^[-•*●▪◦]\s+/;
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const URL_RE = /https?:\/\/|www\.|linkedin\.com/i;

function normLines(input) {
  const rows = normalizeOcrLineInput(input);
  return rows.map((r) => String(r.text || '').trim()).filter(Boolean);
}

/**
 * @param {string[]} lines
 * @param {number} idx
 */
function computeLineSignals(lines, idx) {
  const line = lines[idx] || '';
  const prev = lines[idx - 1] || '';
  const next = lines[idx + 1] || '';
  const blankBefore = idx === 0 || !prev;
  const blankAfter = !next;

  const window = lines.slice(Math.max(0, idx - 2), Math.min(lines.length, idx + 3));
  const bulletCount = window.filter((l) => BULLET_RE.test(l)).length;
  const dateCount = window.filter((l) => detectDatesInText(l).confidence >= 0.6).length;
  const capsWords = line.split(/\s+/).filter((w) => /^[A-ZÀ-Ö]/.test(w)).length;
  const wordCount = line.split(/\s+/).filter(Boolean).length || 1;

  return {
    lineIndex: idx,
    position: idx / Math.max(1, lines.length - 1),
    topThird: idx < lines.length * 0.28,
    spacingBefore: blankBefore ? 1 : 0,
    spacingAfter: blankAfter ? 1 : 0,
    capitalizationRatio: capsWords / wordCount,
    bulletDensity: bulletCount / window.length,
    dateDensity: dateCount / window.length,
    isBullet: BULLET_RE.test(line),
    isShort: line.length < 48,
    isHeader: Boolean(fuzzySectionKey(line) || isSectionHeaderLine(line)),
    hasEmail: EMAIL_RE.test(line),
    hasPhone: PHONE_RE.test(line),
    hasUrl: URL_RE.test(line),
    dates: detectDatesInText(line),
  };
}

function scoreBlockType(signals, text) {
  const t = String(text || '').trim();
  const scores = Object.fromEntries(Object.values(CV_BLOCK_TYPES).map((k) => [k, 0]));

  if (signals.hasEmail || signals.hasPhone || signals.hasUrl) {
    scores[CV_BLOCK_TYPES.CONTACT] += 0.45;
    scores[CV_BLOCK_TYPES.IDENTITY] += 0.2;
  }

  if (signals.topThird && signals.isShort && signals.capitalizationRatio > 0.4 && !signals.dates.startDate) {
    scores[CV_BLOCK_TYPES.IDENTITY] += 0.35;
  }

  if (signals.dates.confidence >= 0.6 || signals.dateDensity >= 0.34) {
    scores[CV_BLOCK_TYPES.EXPERIENCE] += 0.55;
  }

  if (signals.isBullet || signals.bulletDensity >= 0.4) {
    scores[CV_BLOCK_TYPES.EXPERIENCE] += 0.25;
    scores[CV_BLOCK_TYPES.PROJECTS] += 0.1;
  }

  const role = detectRoleInLine(t);
  const company = detectCompanyInLine(t, { hasDate: Boolean(signals.dates.startDate), hasRole: Boolean(role.role) });
  if (role.confidence >= 0.6) scores[CV_BLOCK_TYPES.EXPERIENCE] += 0.35;
  if (company.confidence >= 0.55) scores[CV_BLOCK_TYPES.EXPERIENCE] += 0.2;

  if (/\b(bachelor|master|mba|phd|degree|bsc|msc|university|école|school|college|diploma)\b/i.test(t)) {
    scores[CV_BLOCK_TYPES.EDUCATION] += 0.5;
  }

  if (/\b(certified|certification|certificate|licence|license|pmp|aws)\b/i.test(t)) {
    scores[CV_BLOCK_TYPES.CERTIFICATIONS] += 0.45;
  }

  const commas = (t.match(/,/g) || []).length;
  if (commas >= 2 && t.length < 180) {
    scores[CV_BLOCK_TYPES.SKILLS] += 0.2;
    scores[CV_BLOCK_TYPES.TOOLS] += 0.2;
    scores[CV_BLOCK_TYPES.CLIENTS] += 0.15;
    scores[CV_BLOCK_TYPES.LANGUAGES] += 0.1;
  }

  if (/\b(native|fluent|bilingual|professional|C1|C2|B1|B2)\b/i.test(t) && commas <= 1) {
    scores[CV_BLOCK_TYPES.LANGUAGES] += 0.45;
  }

  if (signals.isHeader) {
    const hint = fuzzySectionKey(t);
    const map = {
      summary: CV_BLOCK_TYPES.SUMMARY,
      profile: CV_BLOCK_TYPES.SUMMARY,
      experience: CV_BLOCK_TYPES.EXPERIENCE,
      education: CV_BLOCK_TYPES.EDUCATION,
      skills: CV_BLOCK_TYPES.SKILLS,
      tools: CV_BLOCK_TYPES.TOOLS,
      languages: CV_BLOCK_TYPES.LANGUAGES,
      clients: CV_BLOCK_TYPES.CLIENTS,
      projects: CV_BLOCK_TYPES.PROJECTS,
      certifications: CV_BLOCK_TYPES.CERTIFICATIONS,
    };
    if (hint && map[hint]) scores[map[hint]] += 0.85;
  }

  if (signals.topThird && t.length > 60 && t.length < 420 && !signals.dates.startDate && !role.role) {
    scores[CV_BLOCK_TYPES.SUMMARY] += 0.25;
  }

  let best = CV_BLOCK_TYPES.UNKNOWN;
  let bestScore = 0;
  for (const [type, score] of Object.entries(scores)) {
    if (score > bestScore) {
      bestScore = score;
      best = type;
    }
  }

  return {
    type: best,
    confidence: Math.min(0.98, bestScore),
    scores,
    role,
    company,
  };
}

function groupLinesToBlocks(lines) {
  const blocks = [];
  let bucket = [];
  let bucketStart = 0;
  let sectionHint = null;

  const flush = (endIdx) => {
    if (!bucket.length) return;
    const text = bucket.join('\n');
    const signals = bucket.map((_, i) => computeLineSignals(lines, bucketStart + i));
    const agg = {
      bulletDensity: signals.reduce((s, x) => s + x.bulletDensity, 0) / signals.length,
      dateDensity: signals.reduce((s, x) => s + x.dateDensity, 0) / signals.length,
      capitalizationRatio:
        signals.reduce((s, x) => s + x.capitalizationRatio, 0) / signals.length,
      dates: detectDatesInText(text),
      topThird: bucketStart < lines.length * 0.28,
      isHeader: false,
      isBullet: BULLET_RE.test(bucket[0]),
      hasEmail: signals.some((x) => x.hasEmail),
      hasPhone: signals.some((x) => x.hasPhone),
      hasUrl: signals.some((x) => x.hasUrl),
    };
    const classified = scoreBlockType(agg, text);
    blocks.push({
      id: `ub-${bucketStart}`,
      type: classified.type,
      confidence: classified.confidence,
      text,
      lines: [...bucket],
      startLine: bucketStart,
      endLine: endIdx,
      sectionHint,
      signals: agg,
      role: classified.role,
      company: classified.company,
      scores: classified.scores,
    });
    bucket = [];
  };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const header = fuzzySectionKey(line) || (isSectionHeaderLine(line) ? line : null);
    if (header) {
      flush(i - 1);
      sectionHint = fuzzySectionKey(line) || header;
      bucket = [line];
      bucketStart = i;
      flush(i);
      continue;
    }

    const sig = computeLineSignals(lines, i);
    if (sig.dates.confidence >= 0.6 && bucket.length && !sig.isBullet) {
      flush(i - 1);
      bucket = [line];
      bucketStart = i;
      let j = i;
      while (j + 1 < lines.length && j - i < 5) {
        const nxt = lines[j + 1];
        const nSig = computeLineSignals(lines, j + 1);
        if (nSig.isHeader || nSig.dates.confidence >= 0.6) break;
        if (BULLET_RE.test(nxt) || detectRoleInLine(nxt).confidence >= 0.55) {
          bucket.push(nxt);
          j++;
          continue;
        }
        if (nxt.length < 100) {
          bucket.push(nxt);
          j++;
          continue;
        }
        break;
      }
      i = j;
      flush(i);
      continue;
    }

    if (!bucket.length) {
      bucket = [line];
      bucketStart = i;
    } else {
      bucket.push(line);
    }
  }
  flush(lines.length - 1);
  return blocks;
}

/**
 * @param {string|string[]|object[]} input
 * @param {object} [opts]
 */
export function runCvBlockEngine(input, opts = {}) {
  const lines = normLines(input);
  const blocks = groupLinesToBlocks(lines);

  const documentBlocks = (opts.documentBlocks || []).map((b, i) => {
    const text = String(b?.text || b?.content || '').trim();
    const match = blocks.find((ub) => ub.text === text || ub.lines?.[0] === text.split('\n')[0]);
    return {
      ...b,
      universalType: match?.type || CV_BLOCK_TYPES.UNKNOWN,
      universalConfidence: match?.confidence || 0,
      universalSignals: match?.signals || null,
    };
  });

  const typeCounts = {};
  for (const b of blocks) typeCounts[b.type] = (typeCounts[b.type] || 0) + 1;

  hirelyDebugLog('CV_BLOCK_ENGINE', {
    engine: CV_BLOCK_ENGINE,
    lineCount: lines.length,
    blockCount: blocks.length,
    typeCounts,
  });

  return {
    engine: CV_BLOCK_ENGINE,
    lines,
    blocks,
    documentBlocks: documentBlocks.length ? documentBlocks : blocks.map((b) => ({
      id: b.id,
      text: b.text,
      type: 'unknown',
      universalType: b.type,
      universalConfidence: b.confidence,
      lines: b.lines,
    })),
    stats: { lineCount: lines.length, blockCount: blocks.length, typeCounts },
  };
}
