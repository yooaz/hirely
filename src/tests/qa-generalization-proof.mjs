#!/usr/bin/env node
/**
 * P0 — Generalization proof: 10 non-Yoaz CVs through production import + render.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';
import { resumeDataToCvData } from '../core/resume-data.js';
import { loadHirelyTemplates } from './lib/pdf-hardening-suite.mjs';
import {
  GENERALIZATION_PROOF_ENGINE,
  loadGeneralizationCorpus,
} from '../../tests/lib/generalization-proof-corpus.mjs';
import {
  evaluateGeneralizationCv,
  aggregateGeneralizationProof,
} from '../../tests/lib/generalization-proof-eval.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/generalization-proof');
const REPORT_JSON = path.join(OUT_DIR, 'report.json');

const FORBIDDEN_PRODUCTION_RULES = [
  { id: 'yoaz_identity', re: /\b(Yohann|Yoaz|Azancot)\b/i },
  { id: 'lisaa_hardcode', re: /\blisaa\b.*2011/i },
  { id: 'creapole_hardcode', re: /cr[ée]apole.*2008/i },
  { id: 'mccann_agency_rewrite', re: /McCann G\. Agency/ },
  { id: 'freelance_date_rewrite', re: /dates\s*=\s*['"]2011–2022['"]/ },
  { id: 'mccann_date_rewrite', re: /dates\s*=\s*['"]2011–2014['"]/ },
  { id: 'nike_projects_default', re: /['"]Nike projects['"]/ },
  { id: 'project_anchor_injection', re: /PROJECT_ANCHOR_TARGETS\.find/ },
];

function isCommentOnlyLine(line) {
  const t = String(line || '').trim();
  return !t || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

function auditProductionMarkers() {
  const coreDir = path.join(ROOT, 'src/core');
  const hits = [];
  for (const rule of FORBIDDEN_PRODUCTION_RULES) {
    const files = [];
    walk(coreDir, (file) => {
      if (!file.endsWith('.js')) return;
      const rel = path.relative(ROOT, file);
      const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
      const matchingLines = lines.filter((line) => !isCommentOnlyLine(line) && rule.re.test(line));
      if (matchingLines.length) files.push(rel);
    });
    if (files.length) hits.push({ marker: rule.id, files });
  }
  return hits;
}

function walk(dir, fn) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, fn);
    else fn(p);
  }
}

fs.mkdirSync(OUT_DIR, { recursive: true });

const corpus = loadGeneralizationCorpus(ROOT);
const T = loadHirelyTemplates();
const rows = [];

for (const fixture of corpus) {
  const row = {
    id: fixture.id,
    label: fixture.label,
    templateId: fixture.templateId,
    expected: fixture.expected,
    pass: false,
    failures: [],
    metrics: {},
    error: null,
  };

  try {
    const importResult = await runHirelyImportFromText(fixture.text, {
      source: `generalization-proof:${fixture.id}`,
      extractionMethod: 'paste',
      file: {
        name: fixture.fileName,
        type: 'text/plain',
        size: fixture.text.length,
      },
    });

    const rd = sanitizeResumeForDisplay(importResult?.resumeData || {});
    const cv = resumeDataToCvData(rd);
    const renderHtml = String(T.render(cv, fixture.templateId) || '');

    const evalResult = evaluateGeneralizationCv({
      importResult,
      resumeData: rd,
      renderHtml,
      expected: fixture.expected,
    });

    row.pass = evalResult.pass;
    row.failures = evalResult.failures;
    row.metrics = evalResult.metrics;
    row.importResult = {
      importStatus: importResult?.importStatus,
      errors: (importResult?.errors || []).slice(0, 3),
    };
  } catch (err) {
    row.error = String(err?.message || err);
    row.failures = ['crash'];
  }

  rows.push(row);
  const mark = row.pass ? 'PASS' : 'FAIL';
  console.log(`${mark} ${fixture.id} — ${row.failures.join(', ') || 'ok'}`);
}

const summary = aggregateGeneralizationProof(rows);
const productionAudit = auditProductionMarkers();

const report = {
  version: GENERALIZATION_PROOF_ENGINE,
  generatedAt: new Date().toISOString(),
  pass: summary.pass && productionAudit.length === 0,
  summary,
  productionAudit,
  results: rows,
};

fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));

console.log(
  `\n═══ Generalization Proof: ${summary.passCount}/${summary.count} (${summary.passRate}%) ` +
    `${report.pass ? 'PASS' : 'FAIL'} ═══`
);

if (productionAudit.length) {
  console.error('Production marker audit failures:');
  for (const hit of productionAudit) {
    console.error(`  ${hit.marker}: ${hit.files.join(', ')}`);
  }
}

process.exit(report.pass ? 0 : 1);
