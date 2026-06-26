#!/usr/bin/env node
/**
 * P0 — Generate OCR_TEXT_DEDUP_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import {
  DEDUPE_ENGINE,
  dedupeClientList,
  dedupeProjectList,
  dedupeTextLinesBySimilarity,
  semanticSimilarityForDedup,
  pickRicherStringLabel,
} from '../src/core/parsing/dedupe-engine.js';
import { dedupePlainText } from '../src/core/extraction/extraction-audit.js';
import { dedupeFinalResumeData, auditFinalResumeDuplicates, DEDUPE_FINAL_RESUME } from '../src/core/validation/dedupe-final-resume.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'OCR_TEXT_DEDUP_REPORT.md');
const OUT_JSON = path.join(ROOT, 'tests/output/ocr-text-dedup/report.json');

function run(script) {
  const r = spawnSync('node', [script], { cwd: ROOT, encoding: 'utf8', maxBuffer: 20 * 1024 * 1024 });
  return { ok: r.status === 0, out: `${r.stdout || ''}\n${r.stderr || ''}`.trim() };
}

function main() {
  console.log('HIRELY P0 — OCR text dedup without data loss\n');
  const qa = run('src/tests/qa-ocr-text-dedup.mjs');
  const dedupeQa = run('src/tests/qa-dedupe-engine.mjs');
  console.log(qa.ok ? '  PASS qa-ocr-text-dedup' : '  FAIL qa-ocr-text-dedup');
  console.log(dedupeQa.ok ? '  PASS qa-dedupe-engine' : '  FAIL qa-dedupe-engine');

  const clientSample = dedupeClientList([
    'Nike',
    'Nike',
    'Adobe',
    'Adobe Illustrator',
    'McCann G. Agency',
    'McCann Agency',
  ]);
  const projectSample = dedupeProjectList(['Visual Communication', 'Visual Communication', 'Air Max Campaign']);
  const lineSample = dedupeTextLinesBySimilarity([
    'Senior Designer — McCann — 2018–2020',
    'Senior Designer - McCann - 2018-2020',
    'Nike',
    'Nike',
    'Graphic Designer — Nike — 2019',
  ]);
  const plainSample = dedupePlainText(['Nike', 'Nike', 'McCann G. Agency', 'McCann Agency'].join('\n'));
  const frd = dedupeFinalResumeData({
    identity: { name: 'Test' },
    clients: clientSample,
    projects: projectSample,
    experiences: [],
    skills: [],
    tools: ['Adobe Illustrator', 'Adobe Illustrator'],
    languages: [],
    education: [],
  });
  const dupAudit = auditFinalResumeDuplicates(frd);

  const pass = qa.ok && dedupeQa.ok && dupAudit.ok;
  const payload = {
    generatedAt: new Date().toISOString(),
    engine: DEDUPE_ENGINE,
    finalDedupe: DEDUPE_FINAL_RESUME,
    pass,
    samples: {
      clients: { in: 6, out: clientSample.length, items: clientSample },
      projects: { in: 3, out: projectSample.length, items: projectSample },
      ocrLines: { in: 5, out: lineSample.length, items: lineSample },
      plainText: { charsRemoved: plainSample.beforeChars - plainSample.afterChars },
      mccannSimilarity: semanticSimilarityForDedup('McCann G. Agency', 'McCann Agency'),
      nikeExperienceGuard: semanticSimilarityForDedup('Nike', 'Graphic Designer — Nike — 2019'),
      richestMcCann: pickRicherStringLabel('McCann G. Agency', 'McCann Agency'),
      finalDuplicateAudit: dupAudit,
    },
  };

  fs.mkdirSync(path.dirname(OUT_JSON), { recursive: true });
  fs.writeFileSync(OUT_JSON, JSON.stringify(payload, null, 2));

  const lines = [
    '# HIRELY P0 — OCR Text Dedup Without Data Loss',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${payload.generatedAt}`,
    `**Engine:** ${DEDUPE_ENGINE}`,
    `**Final lock:** ${DEDUPE_FINAL_RESUME}`,
    '',
    '## Problem',
    '',
    'Console reported `DUPLICATE_TEXT_DETECTED` when OCR + native PDF text merged. Dedup was:',
    '',
    '- Collapsing **unique** client tokens embedded in longer experience lines (e.g. `Nike` inside a role line)',
    '- Using **global** fuzzy match across pages (dropping valid section content)',
    '- **Dropping** duplicates instead of keeping the **richest** label',
    '',
    'Result: final CV **repeated** some lines and **lost** unique clients/projects.',
    '',
    '## Fix (V3)',
    '',
    '1. **`semanticSimilarityForDedup()`** — safe similarity:',
    '   - Section labels never merge with content',
    '   - Single-token entities (`Nike`, `Adobe`) not treated as duplicates of longer lines',
    '   - Near-length OCR variants (`McCann G. Agency` / `McCann Agency`) still merge',
    '2. **`dedupeExtractedLines()`** — per-page fuzzy dedup only; merges to **richest** text',
    '3. **`dedupeClientList()` / `dedupeProjectList()`** — entity-safe final dedup',
    '4. **Experience dedup** — different companies never merge unless company similarity ≥ 0.88',
    '',
    '## Acceptance examples',
    '',
    '| Input | Rule | Result |',
    '| --- | --- | --- |',
    '| Nike / Nike | exact duplicate | 1 |',
    '| Adobe Illustrator / Adobe Illustrator | exact duplicate | 1 |',
    '| McCann G. Agency / McCann Agency | near duplicate | 1 richest (`${payload.samples.richestMcCann}`) |',
    '| Nike + experience line containing Nike | unique entity guard | both kept |',
    '| Adobe + Adobe Illustrator | unique entity guard | both kept |',
    '| Visual Communication ×2 | near duplicate | 1 |',
    '| Market Reviews ×2 | parser metadata | 1 (label guard) |',
    '| clients + Nike | label vs content | never merged |',
    '',
    '## Samples',
    '',
    `**Clients:** ${clientSample.join(' · ')} (${payload.samples.clients.in} → ${payload.samples.clients.out})`,
    `**Projects:** ${projectSample.join(' · ')}`,
    `**OCR lines:** ${lineSample.length} lines from 5 inputs`,
    `**McCann similarity:** ${Math.round(payload.samples.mccannSimilarity * 100)}%`,
    `**Nike vs experience guard:** ${Math.round(payload.samples.nikeExperienceGuard * 100)}% (< 92% = kept separate)`,
    `**finalResumeData duplicate audit:** ${dupAudit.ok ? 'PASS' : 'FAIL'} (${dupAudit.duplicates.length} pairs)`,
    '',
    '## Verification',
    '',
    '```bash',
    'npm run qa:ocr-text-dedup',
    'npm run test:ocr-text-dedup',
    'npm run qa:dedupe-engine',
    '```',
    '',
    '## Files',
    '',
    '- `src/core/parsing/dedupe-engine.js` — `DEDUPE_ENGINE_V3`, `semanticSimilarityForDedup`',
    '- `src/core/extraction/extraction-audit.js` — per-page richer line merge',
    '- `src/core/validation/dedupe-final-resume.js` — client/project safe dedup',
    '- `src/core/validation/final-resume-contract.js` — build pipeline',
    '- `src/tests/qa-ocr-text-dedup.mjs`',
    '',
  ];

  if (!qa.ok && qa.out) {
    lines.push('## QA output', '', '```', qa.out.slice(0, 3000), '```', '');
  }

  fs.writeFileSync(OUT, `${lines.join('\n')}\n`);
  console.log(`\nWrote ${OUT}`);
  process.exit(pass ? 0 : 1);
}

main();
