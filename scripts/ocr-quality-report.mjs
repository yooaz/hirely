#!/usr/bin/env node
/**
 * OCR_QUALITY_REPORT — measure OCR text quality (no OCR changes).
 * Uses imported PDF OCR output from tests/output/ocr-quality-yoaz/report.json
 */
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

import { scoreOcrQuality, hasReversedCvHeadings, evaluateOcrParserGate } from '../src/core/extraction/ocr-quality-score.js';
import { analyzeLineCorruption, isLineCorrupted } from '../src/core/parsing/corruption-detector.js';
import { isGarbageLine } from '../src/data/dictionaries/garbagePatterns.js';
import { isObviousStrictGarbage, isImpossibleOcrTokenString } from '../src/core/parsing/clean.js';
import { resolveOcrQualityStatus } from '../src/core/extraction/ocr-quality-status.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dir, '..');
const REPORT_JSON = join(ROOT, 'tests/output/ocr-quality-yoaz/report.json');
const OUT_MD = join(ROOT, 'OCR_QUALITY_REPORT.md');

const KNOWN_BAD_FRAGMENTS = ['ION3IIHIAXI', 'NOILY3NQ3', 'YOLVEISNTN', 'BUIPEOY', 'ILLUSTHATCH'];
const CV_WORDS = [
  'experience', 'expérience', 'education', 'formation', 'profile', 'profil', 'skills',
  'compétences', 'competences', 'contact', 'work', 'freelancer', 'freelance', 'designer',
  'illustrator', 'graphic', 'summary', 'languages', 'langues', 'interest', 'interests',
];
const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const YEAR_RE = /^(19|20)\d{2}$/;
const DIGIT_CONFUSED_YEAR_RE = /^20[A-Z]$/i;

function normalizeForMatch(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');
}

function tokenize(text) {
  return String(text || '')
    .split(/\s+/)
    .map((t) => t.replace(/^[^A-Za-zÀ-ÿ0-9]+|[^A-Za-zÀ-ÿ0-9@.+_-]+$/g, ''))
    .filter((t) => t.length >= 2);
}

function vowelRatio(word) {
  const letters = String(word || '').replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (!letters.length) return 0;
  const vowels = (letters.match(/[aeiouyAEIOUYàâéèêëïîôùûüœ]/g) || []).length;
  return vowels / letters.length;
}

function looksReversedOrGibberishWord(word) {
  const w = String(word || '').trim();
  if (w.length < 4) return false;
  const norm = normalizeForMatch(w);
  if (CV_WORDS.includes(norm)) return false;
  if (EMAIL_RE.test(w) || PHONE_RE.test(w) || YEAR_RE.test(w)) return false;
  if (/^\d{6,}$/.test(w)) return false;
  const upper = w.toUpperCase();
  if (KNOWN_BAD_FRAGMENTS.some((b) => upper.includes(b))) return true;
  if (DIGIT_CONFUSED_YEAR_RE.test(w)) return false;
  if (/[0-9]/.test(w) && /[A-Z]{2,}/.test(w) && w.length >= 5) return true;
  if (/^[A-Z0-9]{6,}$/.test(w) && /[A-Z]/.test(w) && !/^(LISAA|INDESIGN|PHOTOSHOP|ILLUSTRATOR)$/i.test(w)) {
    return true;
  }
  const letters = w.replace(/[^A-Za-zÀ-ÿ]/g, '');
  if (letters.length >= 5 && vowelRatio(letters) < 0.12) return true;
  if (letters.length >= 6 && /^[A-ZÀ-Ÿ]+$/.test(letters) && vowelRatio(letters) < 0.22) return true;
  return false;
}

function isPlausibleWord(word) {
  const w = normalizeForMatch(word);
  if (!w || w.length < 2) return false;
  if (EMAIL_RE.test(word) || PHONE_RE.test(word)) return true;
  if (/^(19|20)\d{2}$/.test(w)) return true;
  if (looksReversedOrGibberishWord(word)) return false;
  if (w.length <= 2 && /^[a-z]{1,2}$/.test(w)) return true;
  if (vowelRatio(w) >= 0.22) return true;
  if (w.length >= 4 && /[bcdfghjklmnpqrstvwxyz]{1,}[aeiouy][bcdfghjklmnpqrstvwxyz]*/i.test(w)) return true;
  return w.length >= 3 && w.length <= 24;
}

function isDigitConfusedToken(token) {
  const w = String(token || '');
  return /[0-9]/.test(w) && /[A-Za-z]{2,}/.test(w) && !YEAR_RE.test(w);
}

function isLikelyMisreadToken(token) {
  const norm = normalizeForMatch(token);
  if (norm.length < 4) return false;
  const nearCvTypos = ['gradric', 'cadillec', 'mustrator', 'incesion', 'scowboscc', 'illusthatch'];
  if (nearCvTypos.some((t) => norm.includes(t))) return true;
  if (DIGIT_CONFUSED_YEAR_RE.test(token)) return true;
  return false;
}

function classifyToken(token, lineCorrupted) {
  if (looksReversedOrGibberishWord(token)) return 'reversed';
  if (isObviousStrictGarbage(token) || isImpossibleOcrTokenString(token)) return 'garbage';
  if (isLikelyMisreadToken(token) || isDigitConfusedToken(token)) return 'corrupted';
  if (lineCorrupted && !isPlausibleWord(token)) return 'corrupted';
  if (!isPlausibleWord(token)) return 'corrupted';
  return 'readable';
}

/**
 * Character-weighted mutually-exclusive buckets.
 * @param {string} text
 */
function measureOcrTextBreakdown(text) {
  const lines = String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);

  const buckets = { readable: 0, corrupted: 0, reversed: 0, garbage: 0 };
  const examples = { readable: [], corrupted: [], reversed: [], garbage: [] };
  const lineAudit = [];

  for (const line of lines) {
    if (isGarbageLine(line) || line.length < 3) {
      buckets.garbage += line.length;
      if (examples.garbage.length < 8) examples.garbage.push(line);
      lineAudit.push({ line, bucket: 'garbage', reason: 'garbage line' });
      continue;
    }

    const corruption = analyzeLineCorruption(line);
    const tokens = tokenize(line);
    if (!tokens.length) {
      buckets.garbage += line.length;
      if (examples.garbage.length < 8) examples.garbage.push(line);
      lineAudit.push({ line, bucket: 'garbage', reason: 'no tokens' });
      continue;
    }

    const lineBuckets = { readable: 0, corrupted: 0, reversed: 0, garbage: 0 };
    for (const tok of tokens) {
      const bucket = classifyToken(tok, corruption.corrupted);
      lineBuckets[bucket] += tok.length;
      if (examples[bucket].length < 12 && !examples[bucket].includes(tok)) {
        examples[bucket].push(tok);
      }
    }

    const tokChars = Object.values(lineBuckets).reduce((a, b) => a + b, 0);
    const extra = Math.max(0, line.length - tokChars);
    if (extra > 0 && tokChars > 0) {
      for (const k of Object.keys(lineBuckets)) {
        lineBuckets[k] += Math.round((lineBuckets[k] / tokChars) * extra);
      }
    }

    for (const k of Object.keys(buckets)) buckets[k] += lineBuckets[k];

    const dominant = Object.entries(lineBuckets).sort((a, b) => b[1] - a[1])[0];
    lineAudit.push({
      line,
      bucket: dominant[0],
      reason: corruption.corrupted ? corruption.reasons.join('; ') || 'corruption score' : 'token mix',
      corruptionScore: corruption.score,
    });
  }

  const total = Object.values(buckets).reduce((a, b) => a + b, 0) || 1;
  const pct = (n) => Math.round((n / total) * 1000) / 10;

  return {
    buckets,
    totalChars: total,
    percentages: {
      readable: pct(buckets.readable),
      corrupted: pct(buckets.corrupted),
      reversed: pct(buckets.reversed),
      garbage: pct(buckets.garbage),
    },
    examples,
    lineAudit,
    lineCount: lines.length,
  };
}

function loadSource() {
  if (!existsSync(REPORT_JSON)) {
    throw new Error(`Missing OCR capture: ${REPORT_JSON}. Run npm run test:ocr-quality first.`);
  }
  const report = JSON.parse(readFileSync(REPORT_JSON, 'utf8'));
  return {
    pdf: report.pdf || 'unknown',
    at: report.at || null,
    ocrText: report.ocrText || '',
    gateScore: report.gateScore ?? null,
    chosenRotation: report.chosenRotation ?? null,
    garbageRatioFromRotation: report.rotationTrials?.[0]?.garbageRatio ?? null,
  };
}

function buildMarkdown(source, scored, gate, breakdown, status) {
  const score = scored.qualityScore;
  const grade =
    score >= 85 ? 'Excellent' : score >= 70 ? 'Good' : score >= 55 ? 'Fair' : score >= 42 ? 'Poor' : 'Failed';

  const lines = [
    '# OCR Quality Report',
    '',
    'Measurement-only audit of OCR output from the imported PDF. **No OCR pipeline changes.**',
    '',
    '## Source',
    '',
    `| Field | Value |`,
    `|-------|-------|`,
    `| PDF | \`${source.pdf}\` |`,
    `| Captured at | ${source.at || 'n/a'} |`,
    `| OCR text length | ${source.ocrText.length} chars |`,
    `| Lines | ${breakdown.lineCount} |`,
    `| Chosen rotation | ${source.chosenRotation ?? 'n/a'}° |`,
    `| Parser gate | ${gate.pass ? 'PASS' : 'FAIL'} |`,
    `| OCR status | ${status} |`,
    '',
    '## Overall score',
    '',
    `### **${score} / 100** (${grade})`,
    '',
    'Score from `scoreOcrQuality()` — same metric used by OCR rotation selection and parser gate.',
    '',
    '## Text composition (character-weighted)',
    '',
    'Mutually exclusive buckets; inter-token whitespace attributed proportionally per line.',
    '',
    `| Category | Characters | % of OCR text |`,
    `|----------|------------|---------------|`,
    `| Readable | ${breakdown.buckets.readable} | **${breakdown.percentages.readable}%** |`,
    `| Corrupted | ${breakdown.buckets.corrupted} | **${breakdown.percentages.corrupted}%** |`,
    `| Reversed / gibberish | ${breakdown.buckets.reversed} | **${breakdown.percentages.reversed}%** |`,
    `| OCR garbage | ${breakdown.buckets.garbage} | **${breakdown.percentages.garbage}%** |`,
    `| **Total measured** | ${breakdown.totalChars} | 100% |`,
    '',
    '### Detection rules',
    '',
    '- **Readable** — plausible dictionary/CV tokens (vowel ratio, CV keywords, email, phone, years).',
    '- **Corrupted** — failed plausibility or line corruption score ≥ 40 (`corruption-detector.js`).',
    '- **Reversed / gibberish** — consonant-heavy tokens, digit-confused tokens, known bad fragments.',
    '- **OCR garbage** — `isGarbageLine()` (symbol runs, broken words, junk fragments, noise lines).',
    '',
    '## Engine ratios (token / line level)',
    '',
    `| Metric | Value |`,
    `|--------|-------|`,
    `| Plausible word ratio | ${Math.round(scored.plausibleWordRatio * 1000) / 10}% |`,
    `| Reversed word ratio | ${Math.round(scored.reversedWordRatio * 1000) / 10}% |`,
    `| Garbage line ratio | ${Math.round(scored.garbageRatio * 1000) / 10}% |`,
    `| Reversed CV headings | ${hasReversedCvHeadings(source.ocrText) ? 'yes' : 'no'} |`,
    '',
    '## Score signals',
    '',
    scored.reasons.length
      ? scored.reasons.map((r) => `- ${r}`).join('\n')
      : '- (none)',
    '',
    '## Sample tokens by category',
    '',
  ];

  for (const cat of ['readable', 'corrupted', 'reversed', 'garbage']) {
    const samples = breakdown.examples[cat];
    lines.push(`### ${cat}`);
    lines.push(samples.length ? samples.map((s) => `- \`${s}\``).join('\n') : '- (none)');
    lines.push('');
  }

  lines.push('## Worst lines (by corruption score)');
  lines.push('');
  const worst = [...breakdown.lineAudit]
    .filter((l) => l.corruptionScore > 0 || l.bucket !== 'readable')
    .sort((a, b) => (b.corruptionScore || 0) - (a.corruptionScore || 0))
    .slice(0, 12);

  if (worst.length) {
    lines.push('| Line | Bucket | Corruption | Note |');
    lines.push('|------|--------|------------|------|');
    for (const w of worst) {
      const safe = w.line.replace(/\|/g, '\\|').slice(0, 72);
      lines.push(`| \`${safe}\` | ${w.bucket} | ${w.corruptionScore ?? 0} | ${w.reason?.slice(0, 48) || ''} |`);
    }
  } else {
    lines.push('No high-corruption lines flagged.');
  }

  lines.push('');
  lines.push('## OCR text excerpt');
  lines.push('');
  lines.push('```');
  lines.push(source.ocrText.slice(0, 900) + (source.ocrText.length > 900 ? '\n…' : ''));
  lines.push('```');
  lines.push('');
  lines.push('---');
  lines.push(`*Generated by \`scripts/ocr-quality-report.mjs\` — ${new Date().toISOString()}*`);

  return lines.join('\n');
}

function main() {
  const source = loadSource();
  const text = source.ocrText;
  if (!text || text.length < 20) {
    throw new Error('OCR text missing or too short in report.json');
  }

  const scored = scoreOcrQuality({ text });
  const gate = evaluateOcrParserGate(text);
  const breakdown = measureOcrTextBreakdown(text);
  const status = resolveOcrQualityStatus({ text, gatePass: gate.pass, chosenRotation: source.chosenRotation });

  const md = buildMarkdown(source, scored, gate, breakdown, status);
  writeFileSync(OUT_MD, md, 'utf8');

  console.log('OCR_QUALITY_REPORT.md written');
  console.log(`Score: ${scored.qualityScore}/100`);
  console.log(
    `Composition: readable ${breakdown.percentages.readable}% | corrupted ${breakdown.percentages.corrupted}% | reversed ${breakdown.percentages.reversed}% | garbage ${breakdown.percentages.garbage}%`
  );
}

main();
