#!/usr/bin/env node
/**
 * Generates STOP_FAKE_CV_GENERATION_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync, spawnSync } from 'child_process';
import { assessCoreModule } from '../src/core/boot/boot-contract.mjs';
import {
  auditFakeExperience,
  enforceFakeExperienceGate,
  FAKE_EXPERIENCE_GATE_V1,
} from '../src/core/validation/fake-experience-gate.js';
import { applyIdentityConfirmLabels } from '../src/core/validation/yoaz-bias-guard.js';
import { identityLockDisplayValue } from '../src/core/validation/identity-lock.js';
import { isFinalCvPlaceholder } from '../src/core/validation/final-cv-placeholder-guard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_MD = path.join(ROOT, 'STOP_FAKE_CV_GENERATION_REPORT.md');

function run(cmd, args = []) {
  const res = spawnSync(cmd, args, { cwd: ROOT, encoding: 'utf8', maxBuffer: 40 * 1024 * 1024 });
  return { ok: res.status === 0, out: `${res.stdout || ''}\n${res.stderr || ''}`.trim() };
}

const bootMod = await import('../src/core/index.js');
const bootAssessment = assessCoreModule(bootMod);

const unitCases = [
  {
    id: 'fake-internship-present',
    exp: { role: 'Designer', company: 'Internship', dates: '2010–Present', endDate: 'Present' },
    expectFake: true,
  },
  {
    id: 'fake-profil',
    exp: { role: 'Profil!', company: 'X', dates: '2011–2023' },
    expectFake: true,
  },
  {
    id: 'fake-brace-internship',
    exp: { role: '{Internship}', company: 'Nike', dates: '2018' },
    expectFake: true,
  },
  {
    id: 'valid-freelance',
    exp: {
      role: 'Freelance Illustrator',
      company: 'Independent',
      dates: '2011–2022',
      startDate: '2011',
      endDate: '2022',
    },
    expectFake: false,
  },
];

const unitResults = unitCases.map((c) => {
  const audit = auditFakeExperience(c.exp);
  return { ...c, fake: audit.fake, reason: audit.reason, pass: audit.fake === c.expectFake };
});

const identityName = applyIdentityConfirmLabels({ name: 'Identity needs review', email: 'a@b.com' });
const lockDisplay = identityLockDisplayValue('Maybe Co', 40, false);
const placeholderBlocksReview = isFinalCvPlaceholder('Identity needs review');

const qaScripts = [
  'src/tests/qa-no-fake-data-policy.mjs',
  'src/tests/qa-import-fallback-ux-lock.mjs',
  'scripts/test-core-boot.mjs',
];

const qa = {};
for (const script of qaScripts) {
  const rel = script.replace(`${ROOT}/`, '');
  qa[rel] = run('node', [rel]);
}

const md = `# Stop Fake CV Generation Report (P0)

**Generated:** ${new Date().toISOString()}
**Gate:** \`${FAKE_EXPERIENCE_GATE_V1}\`

## Acceptance

| Rule | Status |
| --- | --- |
| No false \`Feature unavailable\` on clean boot | ${bootAssessment.unavailable.length === 0 ? '**PASS**' : `FAIL (${bootAssessment.unavailable.join(', ')})`} |
| OCR/identity failure → paste fallback only | UI gated via \`_importFallbackUiLock\` + \`ensureImportReviewVisible\` requires \`isFinalResumeValid()\` |
| No fake Present / Profil / Internship rows | \`fake-experience-gate.js\` + stricter \`parseInternshipLine\` |
| No \`Identity needs review\` as CV name | identity lock returns empty; placeholder guard blocks label |
| No raw i18n keys (email/phone) | \`extractionQuality_emailOk\` / \`phoneOk\` added FR+EN |
| Templates/export only after clean \`finalResumeData\` | \`isWorkspaceReady()\` + \`renderTemplates()\` require valid contract |

## Boot assessment

| Tier | ${bootAssessment.tier} |
| Degraded | ${bootAssessment.degraded} |
| Unavailable features | ${bootAssessment.unavailable.length ? bootAssessment.unavailable.join(', ') : 'none'} |

## Unit — fake experience gate

| Case | Expected | Result | Reason | Status |
| --- | --- | --- | --- | --- |
${unitResults.map((u) => `| ${u.id} | ${u.expectFake ? 'reject' : 'keep'} | ${u.fake ? 'reject' : 'keep'} | ${u.reason || '—'} | ${u.pass ? 'PASS' : 'FAIL'} |`).join('\n')}

Unit: **${unitResults.filter((u) => u.pass).length}/${unitResults.length}** pass

## Identity strictness

| Check | Result |
| --- | --- |
| \`applyIdentityConfirmLabels\` clears review label name | ${identityName.name === '' ? 'PASS (empty)' : `FAIL (${identityName.name})`} |
| \`identityLockDisplayValue\` low confidence | ${lockDisplay === '' ? 'PASS (empty)' : `FAIL (${lockDisplay})`} |
| Placeholder guard blocks review label | ${placeholderBlocksReview ? 'PASS' : 'FAIL'} |

## Code changes

| Module | Change |
| --- | --- |
| \`boot-contract.mjs\` + \`core/index.js\` | Align boot exports (\`extractLockedIdentity\`, \`runOcrOnCanvas\`, etc.) |
| \`fake-experience-gate.js\` | Reject generic roles, guessed Present, section labels, invented rows |
| \`classification-fixes.js\` | No guessed dates in internship/dash parsers |
| \`final-resume-contract.js\` | Wire fake experience gate before commit |
| \`identity-lock.js\` / \`yoaz-bias-guard.js\` | Never emit review label into CV identity |
| \`final-cv-placeholder-guard.js\` | Forbid \`Identity needs review\` in preview |
| \`index.html\` | Paste-only on fallback; templates/preview/export require \`isFinalResumeValid()\` |
| \`extraction-quality-step.js\` + I18N | Email/phone labels; uncertain identity set |

## QA scripts

| Script | Result |
| --- | --- |
${Object.entries(qa)
  .map(([k, v]) => `| \`${k}\` | ${v.ok ? 'PASS' : 'FAIL'} |`)
  .join('\n')}

## Verification

\`\`\`bash
npm run stop-fake-cv-report
node scripts/test-core-boot.mjs
npm run qa:no-fake-data-policy
npm run qa:import-fallback-ux-lock
\`\`\`
`;

fs.writeFileSync(OUT_MD, md);
console.log(`Wrote ${OUT_MD}`);

const allPass =
  bootAssessment.unavailable.length === 0 &&
  unitResults.every((u) => u.pass) &&
  identityName.name === '' &&
  lockDisplay === '' &&
  placeholderBlocksReview;

process.exit(allPass && Object.values(qa).every((q) => q.ok) ? 0 : 1);
