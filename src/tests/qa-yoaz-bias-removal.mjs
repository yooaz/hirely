#!/usr/bin/env node
/**
 * P0 — Yoaz bias removal: production scan + non-Yoaz import proof.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  YOAZ_BIAS_GUARD_V1,
  YOAZ_PRODUCTION_FORBIDDEN_LITERALS,
  applyYoazBiasGuard,
  valueMatchesYoazMarker,
} from '../core/validation/yoaz-bias-guard.js';
import {
  NAME_CONFIRM_LABEL,
  EMAIL_CONFIRM_LABEL,
  PHONE_CONFIRM_LABEL,
} from '../core/display/undetected-label.js';
import {
  NAME_UNCERTAIN_LABEL,
  EMAIL_UNCERTAIN_LABEL,
  PHONE_UNCERTAIN_LABEL,
} from '../core/parsing/parser-recovery.js';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { loadGeneralizationCorpus } from '../../tests/lib/generalization-proof-corpus.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/yoaz-bias-removal');
const REPORT_JSON = path.join(OUT_DIR, 'report.json');

const YOAZ_OUTPUT_RE = /\b(yohann|yoaz|azancot|yoazg@hotmail|yoaz@hotmail|studio\s+yoaz|38\s+impressions)\b/i;

let failed = 0;
const checks = [];

function record(id, pass, detail = '') {
  checks.push({ id, pass, detail });
  if (!pass) {
    failed++;
    console.error(`FAIL ${id}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`PASS ${id}`);
  }
}

function isCommentOnlyLine(line) {
  const t = String(line || '').trim();
  return !t || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

const PRODUCTION_SCAN_ALLOWLIST = new Set([
  'src/core/validation/yoaz-bias-guard.js',
  'src/core/display/undetected-label.js',
]);

function walkFiles(filePath, files, literal) {
  if (!fs.existsSync(filePath)) return;
  const stat = fs.statSync(filePath);
  if (stat.isDirectory()) {
    for (const entry of fs.readdirSync(filePath)) {
      walkFiles(path.join(filePath, entry), files, literal);
    }
    return;
  }
  if (!/\.(js|mjs|html)$/.test(filePath)) return;
  const rel = path.relative(ROOT, filePath);
  if (PRODUCTION_SCAN_ALLOWLIST.has(rel)) return;
  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/);
  const matching = lines.filter((line) => !isCommentOnlyLine(line) && line.includes(literal));
  if (matching.length) files.push(rel);
}

function auditProductionForYoazBias(root) {
  const hits = [];
  const scanRoots = [
    path.join(root, 'src/core'),
    path.join(root, 'src/ui'),
    path.join(root, 'index.html'),
  ];
  for (const literal of YOAZ_PRODUCTION_FORBIDDEN_LITERALS) {
    const files = [];
    for (const scanRoot of scanRoots) {
      walkFiles(scanRoot, files, literal);
    }
    if (files.length) hits.push({ literal, files: [...new Set(files)] });
  }
  return hits;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

record('guard_version', YOAZ_BIAS_GUARD_V1 === 'YOAZ_BIAS_GUARD_V1');
record('name_confirm_label', NAME_UNCERTAIN_LABEL === NAME_CONFIRM_LABEL);
record('email_confirm_label', EMAIL_UNCERTAIN_LABEL === EMAIL_CONFIRM_LABEL);
record('phone_confirm_label', PHONE_UNCERTAIN_LABEL === PHONE_CONFIRM_LABEL);

const leaked = applyYoazBiasGuard(
  {
    identity: {
      name: 'Yohann Azancot',
      email: 'yoazg@hotmail.fr',
      phone: '+33649434839',
    },
    clients: ['Studio Yoaz'],
    experiences: [{ role: 'Director', company: '38 Impressions', bullets: [] }],
    education: [],
    meta: { rawText: 'Marie Dupont\nmarie@example.com' },
  },
  { rawText: 'Marie Dupont\nmarie@example.com' }
);
record(
  'guard_strips_yoaz_without_source',
  leaked.violations.length >= 3 &&
    leaked.resumeData.identity.name === NAME_CONFIRM_LABEL &&
    leaked.resumeData.identity.email === EMAIL_CONFIRM_LABEL
);
record('guard_keeps_yoaz_when_in_source', (() => {
  const src = 'Yohann Azancot\nyoazg@hotmail.fr\nGraphic Designer';
  const kept = applyYoazBiasGuard(
    { identity: { name: 'Yohann Azancot', email: 'yoazg@hotmail.fr' }, meta: { rawText: src } },
    { rawText: src }
  );
  return kept.resumeData.identity.name === 'Yohann Azancot' && kept.violations.length === 0;
})());

const productionAudit = auditProductionForYoazBias(ROOT);
record('production_code_clean', productionAudit.length === 0, JSON.stringify(productionAudit));

const GENERIC_CV = `Sophie Martin
Product Manager
sophie.martin@example.com · +33 6 11 22 33 44 · Lyon

Experience
Product Manager — SaaS Co — 2020 – Present
- Roadmap and delivery for B2B platform

Education
MBA — Business School — 2018

Skills
Agile, SQL, Roadmapping
`;

const genericImport = await runHirelyImportFromText(GENERIC_CV, {
  source: 'yoaz-bias:generic',
  extractionMethod: 'paste',
});
const genericRd = sanitizeResumeForDisplay(genericImport?.resumeData || {});
const genericFinal = buildFinalResumeData(genericRd, { silent: true });
const genericBlob = JSON.stringify(genericFinal?.finalResumeData || genericRd);
record(
  'generic_cv_no_yoaz_leak',
  !YOAZ_OUTPUT_RE.test(genericBlob),
  genericBlob.slice(0, 200)
);
record(
  'generic_cv_confirm_labels_when_missing',
  !valueMatchesYoazMarker(genericRd?.identity?.name || '') &&
    (genericRd?.identity?.name === NAME_CONFIRM_LABEL ||
      !YOAZ_OUTPUT_RE.test(String(genericRd?.identity?.name || '')))
);

const corpus = loadGeneralizationCorpus(ROOT);
let corpusPass = 0;
const corpusRows = [];
for (const fixture of corpus.slice(0, 5)) {
  const row = { id: fixture.id, pass: false, yoazLeak: false };
  try {
    const importResult = await runHirelyImportFromText(fixture.text, {
      source: `yoaz-bias:${fixture.id}`,
      extractionMethod: 'paste',
    });
    const rd = sanitizeResumeForDisplay(importResult?.resumeData || {});
    const blob = JSON.stringify(rd);
    row.yoazLeak = YOAZ_OUTPUT_RE.test(blob);
    row.pass = !row.yoazLeak;
    if (row.pass) corpusPass++;
  } catch (err) {
    row.error = String(err?.message || err);
  }
  corpusRows.push(row);
}
record('corpus_no_yoaz_leak', corpusPass === corpusRows.length, `${corpusPass}/${corpusRows.length}`);

const report = {
  version: YOAZ_BIAS_GUARD_V1,
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  checks,
  productionAudit,
  corpusRows,
  confirmLabels: {
    name: NAME_CONFIRM_LABEL,
    email: EMAIL_CONFIRM_LABEL,
    phone: PHONE_CONFIRM_LABEL,
  },
};

fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
console.log(`\n═══ Yoaz Bias Removal: ${report.pass ? 'PASS' : 'FAIL'} (${checks.filter((c) => c.pass).length}/${checks.length}) ═══`);
process.exit(report.pass ? 0 : 1);
