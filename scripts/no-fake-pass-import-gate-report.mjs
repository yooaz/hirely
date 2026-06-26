#!/usr/bin/env node
/**
 * P0 — Generate NO_FAKE_PASS_IMPORT_GATE_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'NO_FAKE_PASS_IMPORT_GATE_REPORT.md');
const QA_JSON = path.join(ROOT, 'tests/output/no-fake-pass-import-gate/report.json');
const REALITY_JSON = path.join(ROOT, 'tests/output/import-reality-check/report.json');

function runQa(script) {
  const res = spawnSync('node', [script], {
    cwd: ROOT,
    encoding: 'utf8',
    maxBuffer: 80 * 1024 * 1024,
    timeout: 600000,
  });
  return {
    pass: res.status === 0,
    out: `${res.stdout || ''}\n${res.stderr || ''}`.trim().slice(-4000),
  };
}

const skipBrowser = process.env.HIRELY_SKIP_BROWSER_QA === '1';
const qaGate =
  process.env.HIRELY_SKIP_QA === '1' ? { pass: null, out: '' } : runQa('src/tests/qa-no-fake-pass-import-gate.mjs');
const qaReality =
  process.env.HIRELY_SKIP_QA === '1' || skipBrowser
    ? { pass: null, out: '' }
    : runQa('src/tests/qa-import-reality-check.mjs');

const report = fs.existsSync(QA_JSON) ? JSON.parse(fs.readFileSync(QA_JSON, 'utf8')) : null;
const reality = fs.existsSync(REALITY_JSON) ? JSON.parse(fs.readFileSync(REALITY_JSON, 'utf8')) : null;

const gatePass = report?.pass === true && (qaGate.pass === true || qaGate.pass === null);
const realityProductPass = reality?.productPassCount ?? reality?.cases?.filter((c) => c.productPass || c.pass)?.length ?? 0;
const realityTotal = reality?.cases?.length ?? 0;

const lines = [
  '# NO_FAKE_PASS_IMPORT_GATE_REPORT',
  '',
  `**Gate policy:** \`${report?.version || 'NO_FAKE_PASS_IMPORT_GATE_V2'}\``,
  `**Policy unit tests:** ${gatePass ? 'PASS' : 'FAIL'}`,
  `**Generated:** ${report?.generatedAt || new Date().toISOString()}`,
  `**Unit checks:** ${report ? `${report.checks.length - report.failed}/${report.checks.length}` : 'not run'}`,
  skipBrowser
    ? '**Browser reality QA:** skipped (`HIRELY_SKIP_BROWSER_QA=1`)'
    : `**Browser reality QA:** ${qaReality.pass === true ? 'PASS' : qaReality.pass === false ? 'FAIL' : 'not run'}`,
  realityTotal
    ? `**Product PASS (browser):** ${realityProductPass}/${realityTotal} cases`
    : '',
  '',
  '## Problem',
  '',
  'QA reports showed **PASS** while users saw broken imports: thin text marked ready, paste fallback counted as success, placeholder CV shells, fake identity fields.',
  '',
  '## Principle',
  '',
  '| Concept | Meaning |',
  '|---------|---------|',
  '| **Terminal safe** | No crash, no stuck loader |',
  '| **Acceptable outcome** | Honest status incl. `IMPORT_NEEDS_PASTE` |',
  '| **Product PASS** | Real editable CV — all criteria below |',
  '',
  '`IMPORT_NEEDS_PASTE` is **acceptable** but **never** a successful import.',
  '',
  '## Product PASS requires (all)',
  '',
  '| # | Criterion | Code check |',
  '|---|-----------|------------|',
  '| 1 | `selectedTextLength >= 300` | `hasMeaningfulExtractedText()` |',
  '| 2 | Identity **or** experience **or** education | `hasIdentityExperienceOrEducation()` |',
  '| 3 | Preview has meaningful CV content (≥100 chars + structure) | `previewHasMeaningfulContent()` |',
  '| 4 | No fake name | `isAcceptableDisplayName()` |',
  '| 5 | No fake phone | `isAcceptableDisplayPhone()` |',
  '| 6 | No empty CV shell | `isEmptyCv()` |',
  '| 7 | No stuck loader | `evaluateTerminalSafety()` |',
  '',
  '## Status matrix',
  '',
  '| Status | Terminal safe | Acceptable | Product PASS |',
  '|--------|---------------|------------|--------------|',
  '| `IMPORT_READY` | ✓ | ✓ | Only if all 7 criteria |',
  '| `IMPORT_PARTIAL` | ✓ | ✓ | Only if all 7 criteria |',
  '| `IMPORT_NEEDS_PASTE` | ✓ | ✓ | **Never** |',
  '| `IMPORT_UNSUPPORTED` | ✓ | ✓ | **Never** |',
  '| `IMPORT_FAILED` | ✓ | ✓ | **Never** |',
  '| `IMPORT_STUCK` | ✗ | ✗ | **Never** |',
  '',
  '## Forbidden fake passes (fixed)',
  '',
  '| Pattern | Gate reason |',
  '|---------|-------------|',
  '| `IMPORT_READY` + 45 chars selected text | `selected_text_under_300` |',
  '| Live preview + `>= 20` chars inferred as READY | removed — needs 300 for READY |',
  '| Scanned PDF paste fallback marked PASS | `paste_fallback_not_success` |',
  '| Company name as identity | `fake_name` |',
  '| Corrupted phone on preview | `fake_phone` |',
  '| Header-only shell, 0 sections | `empty_cv` / `placeholder_only_cv` |',
  '',
  '## Implementation',
  '',
  '| Artifact | Role |',
  '|----------|------|',
  '| `tests/lib/no-fake-pass-import-policy.mjs` | Canonical `evaluateImportProductPass()` V2 |',
  '| `tests/lib/real-world-import-truth-eval.mjs` | Truth status + thin-text wrong-status guard |',
  '| `src/tests/qa-no-fake-pass-import-gate.mjs` | Policy unit regression (29 checks) |',
  '| `src/tests/qa-import-reality-check.mjs` | Browser smoke — separates acceptable vs product PASS |',
  '',
  '## Sample policy outcomes',
  '',
  report?.samples
    ? [
        `- **Good import:** pass=${report.samples.good.pass} reasons=${JSON.stringify(report.samples.good.reasons)}`,
        `- **NEEDS_PASTE:** pass=${report.samples.needsPaste.pass} acceptable=${report.samples.needsPaste.acceptable}`,
        `- **Fake name:** pass=${report.samples.fakeName.pass} reasons=${JSON.stringify(report.samples.fakeName.reasons)}`,
      ].join('\n')
    : '- *(run `npm run no-fake-pass-import-gate-report`)*',
  '',
  '## Verification',
  '',
  '```bash',
  'npm run qa:no-fake-pass-import-gate',
  'npm run no-fake-pass-import-gate-report',
  'npm run qa:import-reality-check   # browser — optional',
  '```',
  '',
  '## Related',
  '',
  '- `NO_FAKE_PASS_IMPORT_POLICY.md` — full policy reference',
  '- `REAL_CV_IMPORT_ROOT_FIX_REPORT.md` — extraction 300-char gate',
  '- `NO_FAKE_DATA_POLICY_REPORT.md` — fake identity field rules',
  '',
];

fs.writeFileSync(OUT, lines.join('\n'));
console.log(`Wrote ${OUT}`);
process.exit(gatePass ? 0 : 1);
