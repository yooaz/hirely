#!/usr/bin/env node
/**
 * Trust Layer Report — privacy, badges, confidence, success indicators gate.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_MD = path.join(ROOT, 'TRUST_LAYER_REPORT.md');
const INDEX = path.join(ROOT, 'index.html');
const TRUST_JS = path.join(ROOT, 'src/ui/product/hirely-trust-layer.js');
const TRUST_CSS = path.join(ROOT, 'src/ui/product/hirely-trust-layer.css');
const UX_CSS = path.join(ROOT, 'src/ui/product/ux-simplification.css');

const indexHtml = fs.readFileSync(INDEX, 'utf8');
const trustJs = fs.existsSync(TRUST_JS) ? fs.readFileSync(TRUST_JS, 'utf8') : '';
const trustCss = fs.existsSync(TRUST_CSS) ? fs.readFileSync(TRUST_CSS, 'utf8') : '';
const uxCss = fs.existsSync(UX_CSS) ? fs.readFileSync(UX_CSS, 'utf8') : '';

const checks = [];

function add(id, ok, detail = '') {
  checks.push({ id, ok, detail });
}

add('file:hirely-trust-layer-js', fs.existsSync(TRUST_JS));
add('file:hirely-trust-layer-css', fs.existsSync(TRUST_CSS));
add('index:links-trust-css', /hirely-trust-layer\.css/.test(indexHtml));
add('index:loads-trust-js', /hirely-trust-layer\.js/.test(indexHtml));
add('api:HirelyTrustLayer', /HirelyTrustLayer/.test(trustJs));
add('ui:privacy-statement', /trustPrivacyStatement/.test(indexHtml) && /hirelyTrustPrivacy/.test(trustCss));
add('ui:ats-badge', /trustBadgeAts/.test(indexHtml) && /hirelyTrustBadge--ats/.test(trustCss));
add('ui:recruiter-badge', /trustBadgeRecruiter/.test(indexHtml) && /hirelyTrustBadge--recruiter/.test(trustCss));
add('ui:extraction-confidence', /trustConfidenceLabel/.test(indexHtml) && /hirelyTrustConfidence/.test(trustCss));
add('ui:success-indicators', /hirelyTrustIndicators/.test(trustCss) && /buildTrustIndicators/.test(indexHtml));
add('host:hirelyTrustHero', /id="hirelyTrustHero"/.test(indexHtml));
add('host:hirelyTrustImport', /id="hirelyTrustImport"/.test(indexHtml));
add('host:hirelyTrustAnalyze', /id="hirelyTrustAnalyze"/.test(indexHtml));
add('host:trustStrip-workspace', /id="trustStrip"/.test(indexHtml));
add('fn:renderHirelyTrustLayer', /function renderHirelyTrustLayer/.test(indexHtml));
add('wire:renderAll', /renderHirelyTrustLayer/.test(indexHtml));
add('prod:trust-not-hidden-ux', !/#trustStrip/.test(uxCss) || !uxCss.includes('#trustStrip'));
add('prod:tplAts-visible', /\.tplAts/.test(trustCss) && trustCss.includes('display: inline-block'));
add('i18n:fr-privacy', /trustPrivacyStatement:/.test(indexHtml));
add('i18n:en-privacy', /trustPrivacyStatement:'Your file/.test(indexHtml) || /trustPrivacyStatement: 'Your file/.test(indexHtml));

const pass = checks.filter((c) => c.ok).length;
const total = checks.length;
const status = pass === total ? 'PASS' : 'FAIL';

const pillars = [
  {
    pillar: 'File privacy',
    user: 'Know their CV is not stored on servers',
    ui: '`hirelyTrustPrivacy` + lock icon on hero, import, analyze',
    i18n: 'trustPrivacyStatement',
  },
  {
    pillar: 'ATS compatible',
    user: 'PDF will pass applicant tracking systems',
    ui: '`hirelyTrustBadge--ats` on all trust surfaces; template cards show `.tplAts`',
    i18n: 'trustBadgeAts',
  },
  {
    pillar: 'Recruiter approved',
    user: 'Profile meets recruiter-quality bar',
    ui: 'Badge when score ≥ 65 or high extraction confidence',
    i18n: 'trustBadgeRecruiter / trustBadgeRecruiterPending',
  },
  {
    pillar: 'Extraction confidence',
    user: 'See how reliably we read their file',
    ui: '`<meter>` + % after import (import, analyze, template steps)',
    i18n: 'trustConfidenceLabel',
  },
  {
    pillar: 'Success indicators',
    user: 'Concrete checklist of what was detected',
    ui: 'Contact, experience, education, skills rows with ✓ / ! / ·',
    i18n: 'trustIndicatorsLabel + trustContact* keys',
  },
];

const surfaces = [
  { id: 'hirelyTrustHero', when: 'Landing — before upload', shows: 'Privacy + ATS + recruiter promise' },
  { id: 'hirelyTrustImport', when: 'Step 1 — upload / loading', shows: 'Privacy, badges, confidence when ready' },
  { id: 'hirelyTrustAnalyze', when: 'Step 2 — analyze sidebar', shows: 'Full trust card with confidence + indicators' },
  { id: 'trustStrip', when: 'Steps 3–4 — template & download', shows: 'Confidence + indicators above template gallery' },
];

const md = `# Trust Layer Report

**Generated:** ${new Date().toISOString()}
**Goal:** User trusts the platform **immediately** (privacy, ATS, recruiter quality, extraction, success checks)
**Gate status:** **${status}** (${pass}/${total} checks)

## Trust pillars

| Pillar | User need | Implementation | i18n key |
| --- | --- | --- | --- |
${pillars.map((p) => `| ${p.pillar} | ${p.user} | ${p.ui} | \`${p.i18n}\` |`).join('\n')}

## Surfaces (production)

| Host | When visible | Content |
| --- | --- | --- |
${surfaces.map((s) => `| \`#${s.id}\` | ${s.when} | ${s.shows} |`).join('\n')}

## Static checks

| Check | Status | Detail |
| --- | --- | --- |
${checks.map((c) => `| ${c.id} | ${c.ok ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`).join('\n')}

## Files

| File | Role |
| --- | --- |
| \`src/ui/product/hirely-trust-layer.js\` | Render + mount trust UI |
| \`src/ui/product/hirely-trust-layer.css\` | Badges, privacy, confidence meter, indicators |
| \`index.html\` | Hosts, \`renderHirelyTrustLayer()\`, i18n, wiring |
| \`scripts/trust-layer-report.mjs\` | This report |

## Verification

\`\`\`bash
npm run trust-layer-report
\`\`\`

Manual trust test:

1. Open app (no upload) — hero shows **privacy statement** + **ATS compatible** badge.
2. Upload a text PDF — import panel shows **extraction confidence** % and **success indicators** (contact, experience).
3. Analyze step — sidebar trust card repeats confidence + checklist.
4. Template step — trust strip above gallery; template cards show **ATS** label.

## Success criteria

| Criterion | Target |
| --- | --- |
| Privacy visible before upload | Yes (hero) |
| ATS signal | Badge + per-template label |
| Recruiter signal | Badge when score ≥ 65 |
| Extraction confidence | Shown after successful import |
| Success indicators | ≥ 3 checks (CV read, contact, experience) |
| Gate checks | ${total}/${total} PASS |
`;

fs.writeFileSync(OUT_MD, md);
console.log(`Trust layer report: ${status} (${pass}/${total}) → ${OUT_MD}`);
