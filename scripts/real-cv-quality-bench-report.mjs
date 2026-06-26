#!/usr/bin/env node
/**
 * H15 — Real CV quality benchmark report.
 */
import { spawnSync } from 'child_process';
import { writeFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const outPath = join(root, 'REAL_CV_QUALITY_BENCH_REPORT.md');
const jsonPath = join(root, 'tests/output/h15-real-cv-bench/report.json');

function run(cmd, args) {
  const r = spawnSync(cmd, args, { cwd: root, encoding: 'utf8' });
  return { code: r.status ?? 1, out: `${r.stdout || ''}${r.stderr || ''}`.trim() };
}

const bench = run('node', ['src/tests/qa-real-cv-quality-bench.mjs']);
const pass = bench.code === 0;

let report = null;
try {
  report = JSON.parse(
    spawnSync('cat', [jsonPath], { cwd: root, encoding: 'utf8' }).stdout || '{}'
  );
} catch {
  report = null;
}

const s = report?.summary || {};
const rows = report?.results || [];

const tableRows = rows
  .map(
    (r) =>
      `| ${r.id} | ${r.category} | ${r.nameAccuracy}% | ${r.contactAccuracy}% | ${r.experienceAccuracy}% | ${r.educationAccuracy}% | ${r.skillsAccuracy}% | ${r.garbageLeakage} | ${r.manualReviewCount} | ${r.cleanCvPreview ? 'yes' : 'no'} |`
  )
  .join('\n');

const categoryRows = Object.entries(s.byCategory || {})
  .map(([cat, v]) => `| ${cat} | ${v.count} | ${v.nameHits}/${v.count} names | ${v.cleanPreview}/${v.count} clean | ${v.garbage} garbage |`)
  .join('\n');

const md = `# Real CV Quality Benchmark Report (H15)

**Verdict:** ${pass ? 'PASS' : 'FAIL'}

## Goal

Realistic 20-CV quality bench measuring extraction accuracy and CV preview cleanliness across document types and career profiles.

## Catalog

\`tests/lib/h15-real-cv-bench-catalog.mjs\` — 20 cases:

| Category | Cases |
|----------|-------|
| clean-pdf | native PDF text + DOCX export |
| scanned-pdf | scanned OCR + developer OCR sim |
| image-cv | sparse image layout + designer OCR sim |
| two-column | PDF two-column + sales paste |
| portfolio | creative + Yoaz designer portfolios |
| student | student + academic |
| developer | clean + OCR sim |
| marketing | clean + OCR sim |
| freelance | corpus freelancer + designer freelance |
| executive | clean + OCR sim |

## Metrics (per case)

| Metric | Description |
|--------|-------------|
| Name accuracy | Strict match vs fixture header name |
| Contact accuracy | Email + phone match vs fixture contact line |
| Experience accuracy | Section recall vs ground truth |
| Education accuracy | Section recall vs ground truth |
| Skills accuracy | Section recall vs ground truth |
| Garbage leakage | Critical parser/OCR garbage in \`finalResumeData\` |
| Manual review count | Pending items in review queue (À valider) |
| Clean CV preview | No gated low-confidence text + zero critical garbage |

## PASS thresholds

| Gate | Threshold | Result |
|------|-----------|--------|
| Name accuracy | ≥ ${s.goals?.nameAccuracy ?? 90}% | **${s.nameAccuracy ?? '—'}%** |
| Contact accuracy | ≥ ${s.goals?.contactAccuracy ?? 95}% | **${s.contactAccuracy ?? '—'}%** |
| Critical garbage | = 0 | **${s.criticalGarbageTotal ?? '—'}** |
| Clean CV preview | 20/20 | **${s.cleanPreviewCount ?? '—'}/${report?.count ?? 20}** |

Review items are allowed; CV preview must stay clean.

## Aggregate scores

| Dimension | Score |
|-----------|-------|
| Experience accuracy (avg) | ${s.experienceAccuracy ?? '—'}% |
| Education accuracy (avg) | ${s.educationAccuracy ?? '—'}% |
| Skills accuracy (avg) | ${s.skillsAccuracy ?? '—'}% |
| Languages accuracy (avg) | ${s.languagesAccuracy ?? '—'}% |
| Manual review (avg / total) | ${s.manualReviewAvg ?? '—'} / ${s.manualReviewTotal ?? '—'} |

## By category

| Category | Cases | Name hits | Clean preview | Garbage |
|----------|-------|-----------|---------------|---------|
${categoryRows || '| — | — | — | — | — |'}

## Per-case results

| ID | Category | Name | Contact | Exp | Edu | Skills | Garbage | Review | Clean |
|----|----------|------|---------|-----|-----|--------|---------|--------|-------|
${tableRows || '| — | — | — | — | — | — | — | — | — | — |'}

## QA output

\`\`\`
${bench.out.split('\n').slice(-25).join('\n')}
\`\`\`

## Acceptance checklist

- [${bench.code === 0 ? 'x' : ' '}] 20 realistic CV cases executed
- [${(s.nameAccuracy ?? 0) >= 90 ? 'x' : ' '}] Name accuracy ≥ 90%
- [${(s.contactAccuracy ?? 0) >= 95 ? 'x' : ' '}] Contact accuracy ≥ 95%
- [${(s.criticalGarbageTotal ?? 1) === 0 ? 'x' : ' '}] Zero critical garbage leakage
- [${(s.cleanPreviewCount ?? 0) === 20 ? 'x' : ' '}] Clean CV preview on all cases
- [ ] Review count tracked (informational — ${s.manualReviewTotal ?? '—'} pending total)

---

*Generated ${new Date().toISOString()}*
`;

writeFileSync(outPath, md);
console.log(`Wrote ${outPath}`);
console.log(pass ? 'PASS real-cv-quality-bench-report' : 'FAIL real-cv-quality-bench-report');
process.exit(pass ? 0 : 1);
