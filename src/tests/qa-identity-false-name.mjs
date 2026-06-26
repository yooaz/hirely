#!/usr/bin/env node
/**
 * P0 — Identity false-name guard (no company/agency as person name).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  isValidIdentityName,
  looksLikeCompanyOrAgencyName,
  nameCollidesWithEmployers,
  extractLockedIdentity,
  IDENTITY_CONFIDENCE_MIN,
} from '../core/parsing/identity-extraction.js';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';
import { scoreIdentityName } from '../core/validation/confidence-gate.js';
import { NAME_UNCERTAIN_LABEL } from '../core/parsing/parser-recovery.js';
import { loadHirelyTemplates } from './lib/pdf-hardening-suite.mjs';
import { resumeDataToCvData } from '../core/resume-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/identity-false-name');
const REPORT_JSON = path.join(OUT_DIR, 'report.json');

const REJECT_SAMPLES = [
  'Lontac Impressions',
  'JB Impressions',
  'Studio Azur',
  'McCann Agency',
  'Nike Client',
  'Freelance Portfolio',
  'Creative Company',
];

const ACCEPT_SAMPLES = ['Sophie Martin', 'Alex Chen', 'Yohann Azancot'];

const LONTAC_CV = [
  'Graphic Designer & Illustrator',
  'designer@email.com · +33 6 12 34 56 78 · Paris',
  '',
  'Summary',
  'Illustration and brand design for cultural clients.',
  '',
  'Experience',
  'Designer — Lontac Impressions — Paris — 2019 – Present',
  '- Created posters and visual identity systems.',
  '',
  'Education',
  'École Estienne — Graphic Design — 2014 – 2017',
].join('\n');

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

for (const sample of REJECT_SAMPLES) {
  record(
    `reject:${sample}`,
    !isValidIdentityName(sample) && looksLikeCompanyOrAgencyName(sample),
    `valid=${isValidIdentityName(sample)}`
  );
}

for (const sample of ACCEPT_SAMPLES) {
  record(
    `accept:${sample}`,
    isValidIdentityName(sample) && !looksLikeCompanyOrAgencyName(sample)
  );
}

record(
  'employer_collision',
  nameCollidesWithEmployers('Lontac Impressions', [
    { company: 'Lontac Impressions', role: 'Designer' },
  ])
);

record('confidence_min_85', IDENTITY_CONFIDENCE_MIN === 85);

const locked = extractLockedIdentity(LONTAC_CV.split(/\r?\n/), {
  contact: { email: 'designer@email.com', phone: '+33612345678' },
});
record(
  'locked_identity_no_company',
  !locked.name || !/lontac|impressions/i.test(locked.name),
  `name=${locked.name || '(empty)'}`
);
record(
  'locked_confidence_gate',
  !locked.name || locked.nameConfidence >= IDENTITY_CONFIDENCE_MIN,
  `confidence=${locked.nameConfidence}`
);

const imported = await runHirelyImportFromText(LONTAC_CV, {
  source: 'qa-identity-false-name',
  extractionMethod: 'paste',
});
const rd = sanitizeResumeForDisplay(imported?.resumeData || {});
const displayName = String(rd.identity?.name || '').trim();
record(
  'sanitize_no_company_name',
  !/lontac|impressions/i.test(displayName),
  `displayName=${displayName}`
);
record(
  'sanitize_uncertain_label',
  displayName === NAME_UNCERTAIN_LABEL || !displayName,
  `displayName=${displayName}`
);
record('score_company_zero', scoreIdentityName('Lontac Impressions') === 0);

const cvData = resumeDataToCvData(rd);
record(
  'cvdata_name_not_company',
  !/lontac|impressions/i.test(String(cvData?.name || '')),
  `cvName=${cvData?.name || '(empty)'}`
);
const T = loadHirelyTemplates();
const renderHtml = String(T.render(cvData, 'ats') || '');
const nameMatch = renderHtml.match(/class="cvName[^"]*"[^>]*>([^<]*)</i);
const renderedName = nameMatch ? nameMatch[1].trim() : '';
record(
  'render_cvname_not_company',
  !/lontac|impressions/i.test(renderedName),
  `renderedName=${renderedName || '(placeholder)'}`
);

fs.mkdirSync(OUT_DIR, { recursive: true });
const report = {
  version: 'IDENTITY_FALSE_NAME_FIX_V1',
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  summary: {
    total: checks.length,
    pass: checks.filter((c) => c.pass).length,
    fail: failed,
  },
  checks,
  lontacCase: {
    displayName,
    importStatus: imported?.importStatus,
    experienceCount: (rd.experiences || []).length,
    educationCount: (rd.education || []).length,
  },
};
fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));

console.log(`\n═══ Identity False Name: ${report.summary.pass}/${report.summary.total} PASS ═══`);
process.exit(failed ? 1 : 0);
