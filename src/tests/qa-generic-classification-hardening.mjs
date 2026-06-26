#!/usr/bin/env node
/**
 * H13 — Generic classification hardening (no candidate-specific production strings).
 */
import { readFileSync, readdirSync, statSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { isValidIdentityName } from '../core/parsing/identity-extraction.js';
import {
  parseUrlMergedExperienceLine,
  parseFreelanceCareerLine,
} from '../core/parsing/classification-fixes.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';
import { emailLocalPartNameHint, qualifiesUrlMergedExperienceLine } from '../core/parsing/ocr-classification-rules.js';
import { runProductionExtractionPipeline } from '../core/pipeline/production-pipeline.js';
import { productionToHirelyImportResult } from '../core/pipeline/hirely-import.js';
import { extractPlainTextEnterprise } from '../core/extraction/enterprise-engine.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '../..');
const coreRoot = join(root, 'src/core');

/** Candidate-specific literals — allowed in tests only, never in src/core. */
const FORBIDDEN_IN_CORE = [
  /\bYohann\b/i,
  /\bYoaz\b/i,
  /\bAzancot\b/i,
  /\bcomagi\b/i,
  /Adress\s+Mustrations/i,
  /Expertise\s+Specialized/i,
  /Tumblr\.Comagi/i,
];

/** Fixture-only OCR samples (not used in production). */
const YOAZ_URL_MERGED =
  '++ Yoaz.Tumblr.Comagi - Yohann AZANCOT - 2011-2023';
const GENERIC_DESIGNER_URL_MERGED =
  '++ studio.behance.net/work - Marie DUBOIS - 2016-2024';
const GENERIC_FAKE_CV = {
  identity: {
    name: 'Adress Mustrations',
    title: 'Expertise Specialized',
    email: 'marie.design@example.com',
    phone: '+33601020304',
  },
  experiences: [{ role: GENERIC_DESIGNER_URL_MERGED, company: '', dates: '', bullets: [] }],
  education: ['École des Arts — Visual Communication — 2014-2017'],
  skills: ['Logo Design'],
  tools: ['Adobe Illustrator'],
  clients: [],
  unsorted: [],
  meta: {
    rawText: `${GENERIC_DESIGNER_URL_MERGED}\nMarie Dubois\nGraphic Designer`,
    cleanedText: GENERIC_DESIGNER_URL_MERGED,
  },
};

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

function walk(dir, out = []) {
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    const st = statSync(p);
    if (st.isDirectory()) walk(p, out);
    else if (/\.(js|mjs)$/.test(name)) out.push(p);
  }
  return out;
}

for (const file of walk(coreRoot)) {
  const text = readFileSync(file, 'utf8');
  for (const re of FORBIDDEN_IN_CORE) {
    if (re.test(text)) {
      ok(false, `forbidden ${re} in ${file.replace(root + '/', '')}`);
    }
  }
}
ok(true, 'src/core has no candidate-specific literals');

ok(!isValidIdentityName('Adress Mustrations'), 'reject OCR category name');
ok(!isValidIdentityName('Expertise Specialized'), 'reject expertise phrase as name');
ok(!isValidIdentityName('Portfolio Behance'), 'reject social/portfolio tokens in name');

ok(qualifiesUrlMergedExperienceLine(YOAZ_URL_MERGED), 'yoaz fixture qualifies via generic URL rule');
ok(qualifiesUrlMergedExperienceLine(GENERIC_DESIGNER_URL_MERGED), 'generic designer URL line qualifies');

const yoazMerged = parseUrlMergedExperienceLine(YOAZ_URL_MERGED);
ok(yoazMerged?.recoveredName === 'Yohann Azancot', `yoaz merged name=${yoazMerged?.recoveredName}`);
ok(/freelance/i.test(yoazMerged?.role || ''), `yoaz merged role=${yoazMerged?.role}`);

const designerMerged = parseUrlMergedExperienceLine(GENERIC_DESIGNER_URL_MERGED);
ok(designerMerged?.recoveredName === 'Marie Dubois', `designer merged name=${designerMerged?.recoveredName}`);
ok(designerMerged?.startDate === '2016', `designer start=${designerMerged?.startDate}`);

const sanitizedFake = sanitizeResumeForDisplay(GENERIC_FAKE_CV);
ok(
  /marie\s+dubois/i.test(sanitizedFake.identity?.name || ''),
  `fake CV name=${sanitizedFake.identity?.name}`
);
ok(
  (sanitizedFake.experiences || []).some((e) => /freelance/i.test(e.role) && e.startDate === '2016'),
  `fake CV experiences=${JSON.stringify(sanitizedFake.experiences?.map((e) => e.role))}`
);

ok(emailLocalPartNameHint('marie.design@example.com') === 'marie', 'email hint extracts name token');
ok(emailLocalPartNameHint('contact@agency.com') === '', 'generic email local rejected');

const careerLine =
  '30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, packaging.';
ok(parseFreelanceCareerLine(careerLine)?.company === 'Independent / Freelance', 'freelance career still parses');

const ocrReportPath = join(root, 'tests/output/ocr-quality-yoaz/report.json');
if (requireOcrReport()) {
  const ocrText = JSON.parse(readFileSync(ocrReportPath, 'utf8')).ocrText;
  const ent = extractPlainTextEnterprise(ocrText, 'ocr');
  const pipe = await runProductionExtractionPipeline(ocrText, {
    rawText: ocrText,
    extractionMethod: 'ocr',
    enterpriseExtraction: ent,
  });
  const imp = productionToHirelyImportResult(pipe, null);
  ok((imp.resumeData?.experiences || []).length >= 1, `yoaz pipeline experiences=${imp.resumeData?.experiences?.length}`);
  ok(
    !(imp.resumeData?.identity?.name || '').toLowerCase().includes('adress'),
    `yoaz pipeline name not garbage: ${imp.resumeData?.identity?.name}`
  );
} else {
  console.log('SKIP yoaz OCR pipeline — report.json missing');
}

function requireOcrReport() {
  try {
    readFileSync(ocrReportPath, 'utf8');
    return true;
  } catch {
    return false;
  }
}

process.exit(failed ? 1 : 0);
