#!/usr/bin/env node
/**
 * Generate CV_EXTRACTION_REPORT.md from Extraction Engine V2 benchmark.
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'CV_EXTRACTION_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/extraction-engine-v2/report.json');

function runQa() {
  const res = spawnSync('node', ['src/tests/qa-extraction-engine-v2.mjs'], {
    cwd: ROOT,
    encoding: 'utf8',
    timeout: 300000,
  });
  return {
    pass: res.status === 0,
    out: `${res.stdout || ''}\n${res.stderr || ''}`.trim().slice(-4000),
  };
}

const qa = process.env.HIRELY_SKIP_QA === '1' ? { pass: null } : runQa();
const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;
const s = report?.summary || {};
const pass = report?.pass === true && (qa.pass === true || qa.pass === null);
const checksTotal = report?.checks?.length ?? report?.summary?.total ?? '—';

const sectionRows = Object.entries(s.sectionConfidence || {})
  .sort((a, b) => (b[1].avg || 0) - (a[1].avg || 0))
  .map(
    ([key, data]) =>
      `| ${key} | ${data.avg ?? '—'}% | ${data.flagged ?? 0} | ${data.samples ?? 0} |`
  )
  .join('\n');

const fixtureRows = (report?.fixtures || [])
  .filter((f) => !f.skipped && !f.error)
  .map(
    (f) =>
      `| ${f.id} | ${f.outcome} | ${f.overallConfidence ?? '—'}% | ${f.flaggedFields ?? 0} | ${f.experienceCount ?? 0} | ${f.sectionsFound ?? 0} |`
  )
  .join('\n');

const lines = [
  '# CV_EXTRACTION_REPORT',
  '',
  `**Status:** ${pass ? 'PASS' : 'NEEDS ATTENTION'}`,
  `**Engine:** \`${report?.version || 'EXTRACTION_ENGINE_V2'}\``,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  `**Review threshold:** **70%** — any field below must enter \`reviewQueue\``,
  '',
  '## Executive summary',
  '',
  '| Metric | Value |',
  '|--------|------:|',
  `| Fixtures tested | ${s.total ?? '—'} |`,
  `| **Success rate** | **${s.successRate ?? '—'}%** |`,
  `| Partial (flagged fields) | ${s.partialRate ?? '—'}% |`,
  `| **Failure rate** | **${s.failureRate ?? '—'}%** |`,
  `| QA checks | ${report?.summary?.pass ?? '—'}/${checksTotal} |`,
  '',
  '## Pipeline (V2)',
  '',
  '```mermaid',
  'flowchart TD',
  '  A[PDF / DOCX / TXT / Image] --> B[OCR detection]',
  '  B --> C[Text normalization]',
  '  C --> D[Section detection]',
  '  D --> E[Entity extraction]',
  '  E --> F[Skills / Languages guard]',
  '  F --> G[Confidence scoring per field]',
  '  G --> H{Field >= 70%?}',
  '  H -->|Yes| I[Structured CV JSON]',
  '  H -->|No| J[reviewQueue flag]',
  '  J --> I',
  '```',
  '',
  '## Detected entities',
  '',
  '| Category | Fields |',
  '|----------|--------|',
  '| Identity | name, title, location, email, phone, website, LinkedIn |',
  '| Career | experience (role, company, dates, bullets) |',
  '| Education | schools, degrees, dates |',
  '| Skills | skills, tools (software guard) |',
  '| Languages | language + proficiency (strict extractor) |',
  '| Other | certifications, projects, achievements, clients |',
  '',
  '## Confidence by section',
  '',
  '| Section | Avg confidence | Flagged items | Samples |',
  '|---------|---------------:|--------------:|--------:|',
  sectionRows || '| — | — | — | — |',
  '',
  '## Fixture results',
  '',
  '| Fixture | Outcome | Overall conf. | Flagged | Experience rows | Sections |',
  '|---------|---------|--------------:|--------:|----------------:|---------:|',
  fixtureRows || '| — | — | — | — | — | — |',
  '',
  '## Modules',
  '',
  '| File | Role |',
  '|------|------|',
  '| `src/core/extraction/extraction-engine-v2.js` | V2 orchestrator |',
  '| `src/core/extraction/field-confidence-v2.js` | Per-field scoring + 70% gate |',
  '| `src/core/extraction/skills-languages-guard.js` | Skills ↔ languages separation |',
  '| `src/core/parsing/ocr-postprocess.js` | Text normalization / OCR repair |',
  '| `src/core/parsing/section-engine-v2.js` | Section detection |',
  '| `src/core/parsing/identity-extraction.js` | Identity entities |',
  '| `src/core/pipeline/production-pipeline.js` | Production parse + V2 post-process |',
  '',
  '## Known failure modes',
  '',
  '| Issue | Mitigation |',
  '|-------|------------|',
  '| Wrong sections | `section-engine-v2` + semantic inference |',
  '| Broken words | `postProcessOcrText` + creative entity guard |',
  '| Missing experiences | experience recovery + anchor extract |',
  '| Incorrect dates | `repairOcrYearTokens` + date parsers |',
  '| Skills mixed with languages | `skills-languages-guard.js` |',
  '| Low-confidence fields | `field-confidence-v2` → reviewQueue |',
  '',
  '## Review flags (honest gaps)',
  '',
  'Fields below **70%** are pushed to `reviewQueue` and never auto-rendered in preview.',
  '',
  '| Section | Avg confidence | Still flagged across corpus |',
  '|---------|---------------:|----------------------------:|',
  ...(Object.entries(s.sectionConfidence || {})
    .filter(([, data]) => (data.flagged || 0) > 0)
    .sort((a, b) => (b[1].flagged || 0) - (a[1].flagged || 0))
    .map(([key, data]) => `| ${key} | ${data.avg ?? '—'}% | ${data.flagged ?? 0} |`) || ['| — | — | — |']),
  '',
  '**Weakest area:** `name` extraction on OCR/scanned fixtures — names often need manual review even when experience/education parse correctly.',
  '',
  '## Regenerate',
  '',
  '```bash',
  'node src/tests/qa-extraction-engine-v2.mjs',
  'node scripts/cv-extraction-report.mjs',
  '# or',
  'npm run cv-extraction:report',
  '```',
  '',
];

if (qa.out && !pass) {
  lines.push('## QA tail (debug)', '', '```', qa.out.slice(-1500), '```', '');
}

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(pass ? 0 : 1);
