#!/usr/bin/env node
/**
 * P0 — No parser section labels in CV body content.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { applyFinalResumeDataCleanup } from '../core/validation/final-resume-data-cleanup.js';
import { resumeDataToCvData } from '../core/resume-data.js';
import { auditResumeDataForInventedContent } from '../core/display/undetected-label.js';
import {
  isSectionLabelLeakage,
  auditSectionLabelLeakage,
  stripSectionLabelLeakage,
  sanitizeFinalCvLabelsBeforeCommit,
  FORBIDDEN_CV_CONTENT_LABELS,
  SECTION_LABEL_LEAKAGE_GUARD,
} from '../core/validation/section-label-leakage-guard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/section-label-leakage/report.json');

const FIXTURES = [
  { id: 'creative-cv', file: 'tests/fixtures/creative-cv/fixture.txt' },
  { id: 'yoaz-cv', file: 'tests/fixtures/yoaz-cv/fixture.txt' },
  { id: 'creative-experience-rich', file: 'tests/fixtures/creative-experience-rich.txt' },
  { id: 'designer-cv-rich', file: 'tests/fixtures/designer-cv-rich.txt' },
];

const FORBIDDEN = [...FORBIDDEN_CV_CONTENT_LABELS, 'Market Reviews'];

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

function collectContentLines(fr = {}) {
  const lines = [];
  if (fr.summary) lines.push(fr.summary);
  for (const field of ['education', 'skills', 'tools', 'languages', 'clients', 'projects', 'suggestions']) {
    lines.push(...(fr[field] || []));
  }
  for (const exp of fr.experiences || []) {
    lines.push(exp.role, exp.company, exp.description, ...(exp.bullets || []));
  }
  return lines.map((x) => String(x || '').trim()).filter(Boolean);
}

ok(SECTION_LABEL_LEAKAGE_GUARD === 'SECTION_LABEL_LEAKAGE_GUARD_V2', 'guard version');
for (const label of FORBIDDEN) ok(isSectionLabelLeakage(label), `detects ${label}`);
ok(!isSectionLabelLeakage('Nike'), 'allows real client Nike');
ok(!isSectionLabelLeakage('Adobe Illustrator'), 'allows real tool');

const cleaned = sanitizeFinalCvLabelsBeforeCommit(
  applyFinalResumeDataCleanup({
    identity: { name: 'Jane Doe', title: 'Designer' },
    summary: 'summary',
    skills: ['Illustration', 'skills', 'Packaging'],
    tools: ['Photoshop', 'tools'],
    clients: ['Nike', 'clients', 'Market Reviews'],
    languages: ['French — native', 'languages'],
    education: ['LISAA — Web Design — 2011', 'education'],
    projects: ['Portfolio', 'projects'],
    experiences: [
      { role: 'Designer', company: 'McCann', bullets: ['Campaign work', 'experiences'] },
      { role: 'experiences', company: 'clients', bullets: [] },
    ],
    suggestions: ['formation'],
  })
);

ok(cleaned.summary === '', 'strips summary label from summary field');
ok(!cleaned.skills.includes('skills'), 'strips skills label from skills');
ok(!cleaned.tools.includes('tools'), 'strips tools label from tools');
ok(!cleaned.clients.includes('clients'), 'strips clients label from clients');
ok(!cleaned.clients.includes('Market Reviews'), 'strips Market Reviews metadata');
ok(auditSectionLabelLeakage(cleaned).violations.length === 0, 'cleanup leaves no label violations');

const audits = [];

for (const fixture of FIXTURES) {
  const raw = fs.readFileSync(path.join(ROOT, fixture.file), 'utf8');
  const imported = await runHirelyImportFromText(raw, {
    source: fixture.id,
    extractionMethod: 'paste',
  });
  const sanitized = sanitizeResumeForDisplay(imported.resumeData || {});
  const built = buildFinalResumeData(sanitized, { silent: true });
  const fr = built.finalResumeData || {};
  const cv = built.cvData || resumeDataToCvData(fr, { skipNormalize: true });

  const audit = auditSectionLabelLeakage(fr);
  const invented = auditResumeDataForInventedContent(fr);
  const labelHits = collectContentLines(fr).filter((line) => isSectionLabelLeakage(line));

  const cvFlat = [
    cv.summary,
    ...(cv.skills || []),
    ...(cv.tools || []),
    ...(cv.clients || []),
    ...(cv.education || []),
    ...(cv.languages || []),
    ...(cv.experience || []).flatMap((e) =>
      typeof e === 'string' ? [e] : [e?.role, e?.company, ...(e?.bullets || [])]
    ),
  ]
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .filter((line) => isSectionLabelLeakage(line));

  ok(audit.violations.length === 0, `${fixture.id} finalResumeData label-free (${audit.violations.map((v) => v.text).join('; ') || 'clean'})`);
  ok(labelHits.length === 0, `${fixture.id} no forbidden label lines (${labelHits.join('; ') || 'clean'})`);
  ok(cvFlat.length === 0, `${fixture.id} cvData/pdf path label-free (${cvFlat.join('; ') || 'clean'})`);
  ok(!invented.some((v) => /^(experiences?|clients?|summary|tools?|skills?)$/i.test(v)), `${fixture.id} invented audit clean`);

  audits.push({
    id: fixture.id,
    violations: audit.violations,
    labelHits,
    cvFlat,
    skills: (fr.skills || []).length,
    clients: (fr.clients || []).length,
  });
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify({ generatedAt: new Date().toISOString(), audits, pass: failed === 0 }, null, 2)
);

console.log(failed ? '\nFAIL section-label-leakage' : '\nPASS section-label-leakage');
process.exit(failed ? 1 : 0);
