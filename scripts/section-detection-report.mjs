#!/usr/bin/env node
/**
 * H4 section detection audit — alias matrix + fixture coverage.
 * node scripts/section-detection-report.mjs
 * Output: SECTION_DETECTION_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  SECTION_DETECTION_V1,
  scoreSectionHeader,
  detectSectionsWithConfidence,
  H4_SECTION_KEYS,
  H4_SECTION_LABELS,
  getSectionAliases,
} from '../src/core/parsing/section-detection.js';
import { splitBySectionHeaders } from '../src/core/parsing/section-mapper.js';
import { STRESS_FIXTURES, resolveFixtureText } from '../tests/lib/stress-catalog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'SECTION_DETECTION_REPORT.md');

const OCR_CACHE = path.join(ROOT, 'tests/output/ocr-quality-yoaz/report.json');

function loadOcrCacheText() {
  if (!fs.existsSync(OCR_CACHE)) return '';
  try {
    const t = JSON.parse(fs.readFileSync(OCR_CACHE, 'utf8')).ocrText;
    return t && t.length >= 80 ? t : '';
  } catch {
    return '';
  }
}

function aliasMatrixRows() {
  const rows = [];
  for (const [key, labels] of Object.entries(H4_SECTION_LABELS)) {
    for (const label of labels) {
      const scored = scoreSectionHeader(label);
      rows.push({
        label,
        expected: key,
        detected: scored?.key || '—',
        confidence: scored?.confidence ?? 0,
        matchType: scored?.matchType || 'none',
        pass: scored?.key === key && (scored?.confidence ?? 0) >= 85,
      });
    }
  }
  return rows;
}

function fixtureHeaderScan(id, text) {
  const { headers, sectionConfidence, sections } = detectSectionsWithConfidence(text);
  const detectedKeys = H4_SECTION_KEYS.filter((k) => (sections[k] || []).length > 0 || sectionConfidence[k]);
  return {
    id,
    headerCount: headers.length,
    detectedKeys,
    sectionConfidence,
    headers: headers.map((h) => ({
      line: h.line,
      key: h.key,
      confidence: h.confidence,
      matchType: h.matchType,
    })),
  };
}

function mdTable(headers, rows) {
  const sep = headers.map(() => '---');
  const body = rows.map((r) => headers.map((h) => String(r[h] ?? '').replace(/\|/g, '\\|')).join(' | '));
  return [`| ${headers.join(' | ')} |`, `| ${sep.join(' | ')} |`, ...body.map((r) => `| ${r} |`)].join('\n');
}

function main() {
  const matrix = aliasMatrixRows();
  const matrixPass = matrix.filter((r) => r.pass).length;
  const matrixTotal = matrix.length;

  const fixtureResults = [];
  for (const fx of STRESS_FIXTURES) {
    let text = '';
    try {
      const resolved = resolveFixtureText(ROOT, fx);
      text = resolved?.rawText || '';
    } catch {
      continue;
    }
    if (!text || text.length < 40) continue;
    fixtureResults.push(fixtureHeaderScan(fx.id, text));
  }

  const ocrText = loadOcrCacheText();
  if (ocrText) fixtureResults.push(fixtureHeaderScan('yoaz-pdf-live-ocr', ocrText));

  const negativeCases = [
    'Software Engineer — Google — 2020–Present',
    'MBA, Harvard Business School — 2018',
    'Python, JavaScript, SQL, Agile methodologies',
  ].map((line) => {
    const scored = scoreSectionHeader(line);
    return { line, detected: scored?.key || 'rejected', confidence: scored?.confidence ?? 0 };
  });

  const aliases = getSectionAliases();
  const aliasDoc = H4_SECTION_KEYS.map((k) => `- **${k}**: ${(aliases[k] || []).join(', ')}`).join('\n');

  const lines = [
    '# SECTION_DETECTION_REPORT',
    '',
    `Generated: ${new Date().toISOString().slice(0, 10)}`,
    `Engine: \`${SECTION_DETECTION_V1}\``,
    '',
    '## Summary',
    '',
    `- Alias matrix: **${matrixPass}/${matrixTotal}** headers detected with confidence ≥ 85`,
    `- Stress fixtures scanned: **${fixtureResults.length}**`,
    `- Canonical sections: ${H4_SECTION_KEYS.join(', ')}`,
    '',
    '## Confidence model',
    '',
    '| Match type | Score |',
    '| --- | ---: |',
    '| Exact alias | 96 |',
    '| Prefix/suffix alias | 88 |',
    '| Inline header (`Header:`) exact | 94 |',
    '| Inline header prefix | 90 |',
    '| Contact / location specials | 92 / 90 |',
    '| Content row (dates, em-dash, long line) | rejected (0) |',
    '',
    'Per-section confidence on a document is the **max** header score for that section.',
    '',
    '## Supported aliases (H4)',
    '',
    aliasDoc,
    '',
    '## Alias matrix',
    '',
    mdTable(
      ['Label', 'Expected', 'Detected', 'Confidence', 'Match', 'Pass'],
      matrix.map((r) => ({
        Label: r.label,
        Expected: r.expected,
        Detected: r.detected,
        Confidence: r.confidence,
        Match: r.matchType,
        Pass: r.pass ? '✓' : '✗',
      }))
    ),
    '',
    '## Negative cases (must not match)',
    '',
    mdTable(
      ['Line', 'Result', 'Confidence'],
      negativeCases.map((r) => ({ Line: r.line, Result: r.detected, Confidence: r.confidence }))
    ),
    '',
    '## Fixture header detection',
    '',
  ];

  for (const fx of fixtureResults) {
    lines.push(`### ${fx.id}`);
    lines.push('');
    lines.push(`- Headers found: ${fx.headerCount}`);
    lines.push(`- H4 sections with content/confidence: ${fx.detectedKeys.join(', ') || '—'}`);
    const confBits = H4_SECTION_KEYS.filter((k) => fx.sectionConfidence[k])
      .map((k) => `${k}:${fx.sectionConfidence[k]}%`)
      .join(', ');
    lines.push(`- Section confidence: ${confBits || '—'}`);
    if (fx.headers.length) {
      lines.push('');
      lines.push(
        mdTable(
          ['Header line', 'Key', 'Confidence', 'Match'],
          fx.headers.map((h) => ({
            'Header line': h.line,
            Key: h.key,
            Confidence: h.confidence,
            Match: h.matchType,
          }))
        )
      );
    }
    lines.push('');
  }

  lines.push('## Integration');
  lines.push('');
  lines.push('- `scoreSectionHeader()` — single-line header scoring');
  lines.push('- `detectSectionsWithConfidence()` — full text split + confidence map');
  lines.push('- `splitBySectionHeaders()` — attaches `sectionConfidence` and `_sectionHeaders`');
  lines.push('- `detectHeaderBasedSectionBlocks()` — V2 blocks use scored `detectedConfidence`');
  lines.push('');
  lines.push('## Verification');
  lines.push('');
  lines.push('```bash');
  lines.push('node src/tests/section-detection-test.mjs');
  lines.push('npm run stress:sections');
  lines.push('```');
  lines.push('');

  fs.writeFileSync(OUT_PATH, `${lines.join('\n')}\n`);
  console.log(`Wrote ${OUT_PATH}`);
  console.log(`Alias matrix: ${matrixPass}/${matrixTotal}`);
}

main();
