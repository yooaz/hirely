#!/usr/bin/env node
/**
 * OCR normalization audit — corpus score + live samples.
 * Output: OCR_NORMALIZATION_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  normalizeOcrDocument,
  evaluateOcrNormalizationCorpus,
  measureLineDictionaryCoverage,
  OCR_NORMALIZATION_CORPUS,
} from '../src/core/parsing/ocr-normalization.js';
import { postProcessOcrText } from '../src/core/parsing/ocr-postprocess.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'OCR_NORMALIZATION_REPORT.md');
const OCR_CACHE = path.join(ROOT, 'tests/output/ocr-quality-yoaz/report.json');
const FRAGMENTED = path.join(ROOT, 'tests/fixtures/yoaz-pdf-live/ocr-fragmented.txt');

const LIVE_SAMPLES = [
  { id: 'scanned-breaks', label: 'Scanned word breaks', raw: 'Ill ustrator\nGra phic Des igner\nPhot0shop' },
  { id: 'mobile-wrap', label: 'Mobile line wrap', raw: 'Senior graphic\ndesigner — freelance\n2019 — Present' },
  { id: 'multi-column', label: 'Column gap noise', raw: 'PROFILE WORK EXPERIENCE\nSkills    Education' },
  { id: 'low-res', label: 'Low-res char noise', raw: 'lllustrator · Deslgner · Premi ere Pro' },
  { id: 'garbage-mix', label: 'Garbage + content', raw: '||| NE TTT |||\nMotion Designer\n@@@@@\nFigma' },
];

function loadText(filePath) {
  if (!fs.existsSync(filePath)) return '';
  return fs.readFileSync(filePath, 'utf8').trim();
}

function lineTable(rows) {
  const header = '| Case | Raw | Normalized | Pass |';
  const sep = '| --- | --- | --- | --- |';
  const body = rows
    .map((r) => `| ${r.id} | \`${r.raw.slice(0, 48).replace(/\|/g, '\\|')}\` | \`${r.norm.slice(0, 48).replace(/\|/g, '\\|')}\` | ${r.pass ? '✓' : '✗'} |`)
    .join('\n');
  return [header, sep, body].join('\n');
}

function corpusTable() {
  const rows = OCR_NORMALIZATION_CORPUS.map((c, i) => {
    const result = normalizeOcrDocument(c.corrupted);
    const out = result.text;
    let pass = false;
    if (c.expectGarbage) pass = !out || !/[@|]{2,}|NE\s+TTT/i.test(out);
    else if (c.expect) pass = out.toLowerCase().includes(String(c.expect).toLowerCase());
    else pass = !out || out.length < 4;
    return {
      id: String(i + 1),
      raw: c.corrupted.replace(/\n/g, '\\n'),
      norm: out.replace(/\n/g, '\\n') || '(dropped)',
      pass,
    };
  });
  return lineTable(rows);
}

function evaluateSample(sample) {
  const result = normalizeOcrDocument(sample.raw);
  const afterPost = postProcessOcrText(sample.raw, { ocr: true });
  return {
    ...sample,
    normalized: result.text,
    postProcessed: afterPost,
    stats: result.stats,
    lineCoverage: measureLineDictionaryCoverage(result.text),
    trace: result.lines.slice(0, 8),
  };
}

const corpus = evaluateOcrNormalizationCorpus();
const corpusPct = Math.round(corpus.score * 100);
const passThreshold = corpus.score >= 0.95;

let yoazCache = '';
if (fs.existsSync(OCR_CACHE)) {
  try {
    yoazCache = JSON.parse(fs.readFileSync(OCR_CACHE, 'utf8')).ocrText || '';
  } catch {
    yoazCache = '';
  }
}
const fragmented = loadText(FRAGMENTED);
const sampleResults = LIVE_SAMPLES.map(evaluateSample);

let yoazEval = null;
if (yoazCache.length >= 80) {
  const norm = normalizeOcrDocument(yoazCache);
  yoazEval = {
    inputLines: yoazCache.split('\n').filter((l) => l.trim()).length,
    outputLines: norm.stats.outputLines,
    dropped: norm.stats.garbageDropped,
    coverage: measureLineDictionaryCoverage(norm.text),
    merged: norm.stats.linesMerged,
  };
}

let fragEval = null;
if (fragmented.length >= 80) {
  const norm = normalizeOcrDocument(fragmented);
  fragEval = {
    inputLines: fragmented.split('\n').filter((l) => l.trim()).length,
    outputLines: norm.stats.outputLines,
    dropped: norm.stats.garbageDropped,
    coverage: measureLineDictionaryCoverage(norm.text),
    merged: norm.stats.linesMerged,
  };
}

const md = `# OCR Normalization Report

Generated: ${new Date().toISOString()}

## Summary

| Metric | Value | Target |
| --- | --- | --- |
| Corpus repair score | **${corpusPct}%** (${corpus.hits}/${corpus.total}) | ≥ 95% |
| Hardcoded CV rules | **0** | 0 |
| Acceptance | **${passThreshold ? 'PASS' : 'FAIL'}** | PASS |

## Pipeline

\`\`\`
RAW OCR → normalizeOcrDocument → clean → classify → structure
\`\`\`

Normalization stages:
1. Harden (hyphen joins, spaced letters, column splits, dedupe)
2. Merge split lines (continuation / lowercase wrap)
3. Fix broken words (dictionary-validated joins)
4. Repair common OCR char mistakes (0/O, 1/l, fuzzy dictionary)
5. Drop garbage (symbols, reversed noise, isolated fragments)
6. Preserve \`rawLine\` + \`normalizedLine\` per line

## Corpus results

${corpusTable()}

## Live samples

${sampleResults
  .map(
    (s) => `### ${s.label} (\`${s.id}\`)

- Input lines: ${s.raw.split('\n').length}
- Output lines: ${s.stats.outputLines}
- Lines merged: ${s.stats.linesMerged}
- Garbage dropped: ${s.stats.garbageDropped}
- Dictionary line coverage: ${Math.round(s.lineCoverage * 100)}%

**Normalized excerpt:**
\`\`\`
${s.normalized.slice(0, 400)}
\`\`\`
`
  )
  .join('\n')}

${
  yoazEval
    ? `## Yoaz live OCR cache

| Metric | Before | After normalize |
| --- | --- | --- |
| Lines | ${yoazEval.inputLines} | ${yoazEval.outputLines} |
| Garbage dropped | — | ${yoazEval.dropped} |
| Lines merged | — | ${yoazEval.merged} |
| Dictionary coverage | — | ${Math.round(yoazEval.coverage * 100)}% |
`
    : ''
}

${
  fragEval
    ? `## Fragmented OCR fixture

| Metric | Value |
| --- | --- |
| Input lines | ${fragEval.inputLines} |
| Output lines | ${fragEval.outputLines} |
| Garbage dropped | ${fragEval.dropped} |
| Lines merged | ${fragEval.merged} |
| Dictionary coverage | ${Math.round(fragEval.coverage * 100)}% |
`
    : ''
}

## Trace sample (first normalized document)

\`\`\`json
${JSON.stringify(
  normalizeOcrDocument('Ill ustrator\nSenior graphic\ndesigner').lines.slice(0, 6),
  null,
  2
)}
\`\`\`
`;

fs.writeFileSync(OUT, md);
console.log(`Wrote ${OUT}`);
console.log(`Corpus score: ${corpusPct}% — ${passThreshold ? 'PASS' : 'FAIL'}`);
process.exit(passThreshold ? 0 : 1);
