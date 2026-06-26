#!/usr/bin/env node
/**
 * Generates FUNCTIONAL_APP_RECOVERY_REPORT.md — P0 functional recovery acceptance.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { spawnSync } from 'child_process';
import { assessCoreModule } from '../src/core/boot/boot-contract.mjs';
import {
  auditFakeExperience,
  FAKE_EXPERIENCE_GATE_V1,
} from '../src/core/validation/fake-experience-gate.js';
import { applyIdentityConfirmLabels } from '../src/core/validation/yoaz-bias-guard.js';
import { identityLockDisplayValue } from '../src/core/validation/identity-lock.js';
import { isFinalCvPlaceholder } from '../src/core/validation/final-cv-placeholder-guard.js';
import { IMPORT_STATE } from '../src/core/import/import-state.js';
import { buildImportFallbackMeta, resolveImportFallbackReason } from '../src/core/import/import-fallback-ux.js';
import { buildOcrParserBlockedResult } from '../src/core/import/ocr-parser-gate.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_MD = path.join(ROOT, 'FUNCTIONAL_APP_RECOVERY_REPORT.md');
const INDEX_HTML = path.join(ROOT, 'index.html');

function run(cmd, args = []) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 40 * 1024 * 1024 });
  return { ok: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const html = fs.readFileSync(INDEX_HTML, 'utf8');

const bootMod = await import('../src/core/index.js');
const bootAssessment = assessCoreModule(bootMod);

const staticChecks = [
  { id: 'CORE_BOOT_OK marker', pass: /hirelyBootMarker\('CORE_BOOT_OK'\)/.test(html) },
  { id: 'IMPORT_UI_READY marker', pass: /IMPORT_UI_READY/.test(html) },
  { id: 'core-boot-loader tiered gate', pass: /coreImportFunctionsReady/.test(html) },
  { id: 'paste fallback lock', pass: /_importFallbackUiLock=true/.test(html) },
  { id: 'showImportPasteFallback', pass: /function showImportPasteFallback/.test(html) },
  { id: 'ensureImportNeedsPasteVisible', pass: /function ensureImportNeedsPasteVisible/.test(html) },
  { id: 'isFinalResumeValid gating', pass: /function isFinalResumeValid/.test(html) },
  { id: 'export requires valid contract', pass: /isExportReady\(\)[\s\S]*?isFinalResumeValid/.test(html) },
  { id: 'downloadPDF blocks unsafe data', pass: /async function downloadPDF[\s\S]*?_importFallbackUiLock/.test(html) },
  { id: 'setDocStep blocks style/export when invalid', pass: /setDocStep[\s\S]*?isFinalResumeValid/.test(html) },
  { id: 'no resumeData fallback in renderCVInner', pass: !/renderCVInner[\s\S]{0,800}state\.resumeData/.test(html) },
  { id: 'feature warnings only when unavailable', pass: /showHirelyFeatureWarnings\(status\.unavailable/.test(html) },
  { id: 'i18n extractionQuality_emailOk', pass: /extractionQuality_emailOk/.test(html) },
  { id: 'i18n extractionQuality_phoneOk', pass: /extractionQuality_phoneOk/.test(html) },
  { id: 'boot identity export name', pass: /extractLockedIdentity/.test(html) },
  { id: 'boot ocr export name', pass: /runOcrOnCanvas/.test(html) },
];

const fakeCases = [
  { id: 'guessed-present', exp: { role: 'Designer', company: 'Internship', dates: '2010–Present' }, reject: true },
  { id: 'section-label-profil', exp: { role: 'Profil!', company: 'X', dates: '2011–2023' }, reject: true },
  { id: 'real-freelance', exp: { role: 'Freelance Illustrator', company: 'Independent', dates: '2011–2022' }, reject: false },
];
const fakeResults = fakeCases.map((c) => {
  const audit = auditFakeExperience(c.exp);
  const pass = audit.fake === c.reject;
  return { ...c, fake: audit.fake, reason: audit.reason, pass };
});

const identityName = applyIdentityConfirmLabels({ name: 'Identity needs review', email: 'a@b.com' });
const lockDisplay = identityLockDisplayValue('Maybe Co', 40, false);
const placeholderBlocks = isFinalCvPlaceholder('Identity needs review');

const ocrPasteMeta = buildImportFallbackMeta({
  status: IMPORT_STATE.IMPORT_NEEDS_PASTE,
  ocrFailure: true,
  file: { name: 'scan.pdf', type: 'application/pdf' },
});
const ocrBlocked = buildOcrParserBlockedResult(
  { pass: false, message: 'OCR_QUALITY_FAIL' },
  { rawText: 'partial scan text', cleanedText: 'partial scan text' }
);
const ocrReason = resolveImportFallbackReason(IMPORT_STATE.IMPORT_NEEDS_PASTE, { ocrFailure: true });

const qaScripts = [
  'scripts/test-core-boot.mjs',
  'src/tests/qa-no-fake-data-policy.mjs',
  'src/tests/qa-import-fallback-ux-lock.mjs',
  'src/tests/qa-identity-lock.mjs',
];
const qa = {};
for (const script of qaScripts) {
  qa[script] = run('node', [script]);
}

const acceptance = {
  CORE_BOOT_OK: bootAssessment.importOk && bootAssessment.unavailable.length === 0,
  IMPORT_UI_READY: staticChecks.find((c) => c.id === 'IMPORT_UI_READY marker')?.pass && qa['scripts/test-core-boot.mjs']?.ok,
  no_feature_banner_clean_boot: bootAssessment.unavailable.length === 0 && !bootAssessment.degraded,
  no_fake_cv_preview: fakeResults.every((f) => f.pass) && identityName.name === '' && placeholderBlocks,
  paste_fallback_works:
    staticChecks.find((c) => c.id === 'paste fallback lock')?.pass &&
    ocrPasteMeta.lead &&
    /scann|illisible/i.test(ocrReason) &&
    ocrBlocked.importState === IMPORT_STATE.IMPORT_NEEDS_PASTE &&
    ocrBlocked.resumeData == null &&
    qa['src/tests/qa-import-fallback-ux-lock.mjs']?.ok,
  export_disabled_unsafe:
    staticChecks.find((c) => c.id === 'export requires valid contract')?.pass &&
    staticChecks.find((c) => c.id === 'downloadPDF blocks unsafe data')?.pass,
};

const md = `# Functional App Recovery Report (P0)

**Generated:** ${new Date().toISOString()}
**Policy:** Wrong data forbidden · Missing data acceptable · Engine fail → paste fallback · Never render fake preview

## Acceptance summary

| Criterion | Status |
| --- | --- |
| CORE_BOOT_OK | ${acceptance.CORE_BOOT_OK ? '**PASS**' : 'FAIL'} |
| IMPORT_UI_READY | ${acceptance.IMPORT_UI_READY ? '**PASS**' : 'FAIL'} |
| No Feature unavailable banner on clean boot | ${acceptance.no_feature_banner_clean_boot ? '**PASS**' : 'FAIL'} |
| No fake CV preview | ${acceptance.no_fake_cv_preview ? '**PASS**' : 'FAIL'} |
| Paste fallback works (OCR fail → IMPORT_NEEDS_PASTE) | ${acceptance.paste_fallback_works ? '**PASS**' : 'FAIL'} |
| Export disabled when data unsafe | ${acceptance.export_disabled_unsafe ? '**PASS**' : 'FAIL'} |

## Boot assessment

| Field | Value |
| --- | --- |
| Tier | ${bootAssessment.tier} |
| Import OK | ${bootAssessment.importOk} |
| Degraded | ${bootAssessment.degraded} |
| Unavailable | ${bootAssessment.unavailable.length ? bootAssessment.unavailable.join(', ') : 'none'} |
| Missing optional | ${bootAssessment.missingOptional?.length ? bootAssessment.missingOptional.join(', ') : 'none'} |

## Task coverage

| # | Task | Implementation |
| --- | --- | --- |
| 1 | CORE_BOOT — optional modules cannot break app | Tiered \`boot-contract.mjs\`; fatal only \`import_core\`; degraded only when \`unavailable.length > 0\` |
| 2 | OCR fail → IMPORT_NEEDS_PASTE | \`real-cv-import-root.js\`, \`ocr-parser-gate.js\`, \`canonical-import.js\` |
| 3 | Identity fail — no invented contact | \`identity-lock.js\`, \`yoaz-bias-guard.js\`, empty display on low confidence |
| 4 | Block template/export until clean \`finalResumeData\` | \`isWorkspaceReady()\`, \`isFinalResumeValid()\`, \`isExportReady()\`, \`setDocStep\` gates |
| 5 | Remove fake experiences/dates/Present | \`fake-experience-gate.js\` (\`${FAKE_EXPERIENCE_GATE_V1}\`), stricter parsers |
| 6 | Remove raw i18n keys | \`extractionQuality_emailOk\` / \`phoneOk\` in FR+EN |

## Static UI gates

| Check | Status |
| --- | --- |
${staticChecks.map((c) => `| ${c.id} | ${c.pass ? 'PASS' : 'FAIL'} |`).join('\n')}

## Fake data gate

| Case | Expect | Result | Reason | Status |
| --- | --- | --- | --- | --- |
${fakeResults.map((f) => `| ${f.id} | ${f.reject ? 'reject' : 'keep'} | ${f.fake ? 'reject' : 'keep'} | ${f.reason || '—'} | ${f.pass ? 'PASS' : 'FAIL'} |`).join('\n')}

## Identity strictness

| Check | Result |
| --- | --- |
| No review label as name | ${identityName.name === '' ? 'PASS' : `FAIL (${identityName.name})`} |
| Low-confidence lock display empty | ${lockDisplay === '' ? 'PASS' : `FAIL (${lockDisplay})`} |
| Placeholder guard | ${placeholderBlocks ? 'PASS' : 'FAIL'} |

## OCR → paste metadata

| Field | Value |
| --- | --- |
| \`buildOcrParserBlockedResult.importState\` | ${ocrBlocked.importState} |
| \`resumeData\` after OCR block | ${ocrBlocked.resumeData == null ? 'null (no fake CV)' : 'LEAK'} |
| OCR failure user reason | ${ocrReason.slice(0, 80)} |
| User lead | ${ocrPasteMeta.lead?.slice(0, 60)}… |

## QA scripts

| Script | Result |
| --- | --- |
${Object.entries(qa)
  .map(([k, v]) => `| \`${k}\` | ${v.ok ? 'PASS' : 'FAIL'} |`)
  .join('\n')}

## Verification

\`\`\`bash
npm run functional-app-recovery-report
node scripts/test-core-boot.mjs
npm run qa:import-fallback-ux-lock
npm run qa:no-fake-data-policy
npm run stop-fake-cv-report
\`\`\`

## Recovery principles (locked)

1. **Wrong data is forbidden** — gates reject invented rows, guessed Present, review labels in CV fields.
2. **Missing data is acceptable** — empty name/email/phone beats wrong values.
3. **Engine fail → paste** — \`_importFallbackUiLock\` hides templates/preview; user pastes text.
4. **Never render fake preview** — \`renderCVInner\` uses \`getFinalCvData()\` only when contract valid.
5. **Export last** — \`isExportReady()\` requires valid contract + no fallback lock + review readiness.
`;

fs.writeFileSync(OUT_MD, md);
console.log(`Wrote ${OUT_MD}`);

const allPass =
  Object.values(acceptance).every(Boolean) &&
  staticChecks.every((c) => c.pass) &&
  fakeResults.every((f) => f.pass) &&
  Object.values(qa).every((q) => q.ok);

process.exit(allPass ? 0 : 1);
