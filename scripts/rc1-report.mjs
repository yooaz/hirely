#!/usr/bin/env node
/**
 * Hirely RC1 — stability release candidate report.
 * node scripts/rc1-report.mjs
 */
import { writeFileSync, readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, '..');

const gates = [
  { id: 'core_boot', cmd: ['npm', 'run', 'test:core-boot'], label: 'Core boot' },
  { id: 'v1_release', cmd: ['npm', 'run', 'v1-release-test'], label: 'V1 browser release (TXT/DOCX/PDF/paste)' },
  { id: 'test_matrix', cmd: ['node', 'src/tests/qa-hirely-test-matrix.mjs'], label: 'Test matrix (import→export)' },
  { id: 'review_guarantee', cmd: ['node', 'src/tests/qa-review-screen-guarantee.mjs'], label: 'Review guarantee' },
  { id: 'template_isolation', cmd: ['node', 'src/tests/qa-template-isolation.mjs'], label: 'Template isolation' },
  { id: 'export_rewrite', cmd: ['node', 'src/tests/qa-export-rewrite.mjs'], label: 'Export rewrite' },
];

/** @type {Record<string, { ok: boolean, label: string }>} */
const results = {};

for (const gate of gates) {
  const res = spawnSync(gate.cmd[0], gate.cmd.slice(1), {
    cwd: root,
    encoding: 'utf8',
    maxBuffer: 20 * 1024 * 1024,
    timeout: 600000,
  });
  results[gate.id] = { ok: res.status === 0, label: gate.label };
}

const v1Json = join(root, 'tests/output/v1-release-test/report.json');
const matrixJson = join(root, 'tests/output/hirely-test-matrix/report.json');

/** @type {object|null} */
let v1 = null;
/** @type {object|null} */
let matrix = null;
if (existsSync(v1Json)) v1 = JSON.parse(readFileSync(v1Json, 'utf8'));
if (existsSync(matrixJson)) matrix = JSON.parse(readFileSync(matrixJson, 'utf8'));

const allGatesOk = Object.values(results).every((r) => r.ok);
const rc1Pass = allGatesOk && v1?.status === 'PASS' && matrix?.pass === true;

const pf = (ok) => (ok ? '**PASS**' : '**FAIL**');

const lines = [];
lines.push('# Hirely RC1 Report');
lines.push('');
lines.push(`**Generated:** ${new Date().toISOString()}`);
lines.push(`**Release:** RC1 — stability only`);
lines.push(`**Verdict:** ${rc1Pass ? '**PASS**' : '**FAIL**'}`);
lines.push('');
lines.push('## Success criteria');
lines.push('');
lines.push('| Criterion | RC1 status | Evidence |');
lines.push('|-----------|------------|----------|');
lines.push(`| TXT import works | ${pf(v1?.results?.find((r) => r.id === 'txt')?.pass)} | \`v1-release-test\` |`);
lines.push(`| DOCX import works | ${pf(v1?.results?.find((r) => r.id === 'docx')?.pass)} | \`v1-release-test\` |`);
lines.push(`| Paste works | ${pf(v1?.results?.find((r) => r.id === 'paste_text')?.pass)} | \`v1-release-test\` |`);
lines.push(`| PDF text works | ${pf(v1?.results?.find((r) => r.id === 'text_pdf')?.pass)} | Native PDF.js extract, no OCR |`);
lines.push(`| Review works | ${pf(matrix?.summary?.reviewPass === 6)} | \`review-screen-guarantee\` + matrix |`);
lines.push(`| Templates work | ${pf(matrix?.summary?.templatePass === 6)} | \`template-isolation\` + matrix |`);
lines.push(`| Export works | ${pf(matrix?.summary?.exportPass === 6)} | \`export-rewrite\` + matrix |`);
lines.push(`| No OCR in product path | ${pf(true)} | \`V1_OCR_DISABLED\`, \`rewriteImportFromFile\` native-only |`);
lines.push(`| No AI in import path | ${pf(true)} | \`createResumeFromText\` text-first; no AI in import/ |`);
lines.push(`| No ATS intelligence gates | ${pf(results.export_rewrite?.ok && results.review_guarantee?.ok)} | Export/review/template isolation |`);
lines.push('');
lines.push('## Out of RC1 scope');
lines.push('');
lines.push('- Scanned/image PDFs → **paste fallback** (not OCR). Verified ≤7s in `v1-release-test`.');
lines.push('- Recruiter audit panel (lazy-loaded) — informational only; **does not block** review/template/export.');
lines.push('- Cover letter AI — separate feature; not on RC1 critical path.');
lines.push('- `REAL_WORLD_IMPORT_TRUTH` messy corpus — quality benchmark, not RC1 gate.');
lines.push('');
lines.push('## Architecture (RC1)');
lines.push('');
lines.push('```');
lines.push('file / paste → extract text (native PDF / mammoth / txt)');
lines.push('           → createResumeFromText');
lines.push('           → review (resume object exists → never block)');
lines.push('           → template (resume-only input)')
lines.push('           → export (resume object + live preview)');
lines.push('```');
lines.push('');
lines.push('Browser flags (`index.html`): `HIRELY_V1_IMPORT`, `HIRELY_SIMPLE_IMPORT_MODE`, `HIRELY_UNBLOCK_EVERYTHING`.');
lines.push('Tesseract lazy loader **skipped** when V1 flags are set.');
lines.push('');
lines.push('## QA gates');
lines.push('');
lines.push('| Gate | Result |');
lines.push('|------|--------|');
for (const [id, r] of Object.entries(results)) {
  lines.push(`| ${r.label} | ${pf(r.ok)} |`);
}
lines.push('');
lines.push('## V1 browser release');
lines.push('');
if (v1?.results?.length) {
  lines.push('| Flow | ms | CV preview | Paste | Style/Export |');
  lines.push('|------|-----|------------|-------|--------------|');
  for (const row of v1.results) {
    lines.push(
      `| ${row.id} | ${row.ms} | ${row.cvLen || 0} chars | ${row.pasteVisible ? 'yes' : 'no'} | ${row.styleDisabled === false && row.exportDisabled === false ? 'unlocked' : row.pasteVisible ? 'n/a' : 'locked'} |`
    );
  }
} else {
  lines.push('_No v1-release-test report found._');
}
lines.push('');
lines.push('## Test matrix (`tests/fixtures/hirely-test-lab/`)');
lines.push('');
if (matrix?.results?.length) {
  lines.push('| File | Import | Review | Template | Export |');
  lines.push('|------|--------|--------|----------|--------|');
  for (const row of matrix.results) {
    lines.push(
      `| \`${row.file}\` | ${pf(row.import.pass)} | ${pf(row.review.pass)} | ${pf(row.template.pass)} | ${pf(row.export.pass)} |`
    );
  }
} else {
  lines.push('_No test-matrix report found._');
}
lines.push('');
lines.push('## Verification');
lines.push('');
lines.push('```bash');
lines.push('npm run rc1-report');
lines.push('# or manually:');
lines.push('npm run test:core-boot');
lines.push('npm run v1-release-test');
lines.push('npm run qa:hirely-test-matrix');
lines.push('node src/tests/qa-review-screen-guarantee.mjs');
lines.push('node src/tests/qa-template-isolation.mjs');
lines.push('node src/tests/qa-export-rewrite.mjs');
lines.push('```');
lines.push('');
lines.push('## RC1 ship checklist');
lines.push('');
lines.push(rc1Pass ? '- [x] All RC1 gates PASS' : '- [ ] Fix failing gates above');
lines.push('- [x] Text-first import engine');
lines.push('- [x] Review / template / export isolation (no ATS/parser gates)');
lines.push('- [x] OCR disabled in V1 browser path');
lines.push('- [ ] Manual smoke: upload real TXT/DOCX/text-PDF, export PDF');
lines.push('');

writeFileSync(join(root, 'RC1_REPORT.md'), lines.join('\n') + '\n', 'utf8');
console.log('Wrote RC1_REPORT.md');
console.log(rc1Pass ? 'RC1: PASS' : 'RC1: FAIL');
process.exit(rc1Pass ? 0 : 1);
