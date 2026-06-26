#!/usr/bin/env node
/**
 * Acceptance — Yoaz OCR classification fix (parser only).
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { runProductionExtractionPipeline } from '../core/pipeline/production-pipeline.js';
import { productionToHirelyImportResult } from '../core/pipeline/hirely-import.js';
import { extractPlainTextEnterprise } from '../core/extraction/enterprise-engine.js';
import { coerceParserInputText } from '../core/pipeline/pipeline-contract.js';
import { classifyLineType } from '../core/parsing/block-line-classifier.js';
import {
  parseFreelanceCareerLine,
  parseUrlMergedExperienceLine,
} from '../core/parsing/classification-fixes.js';
import { isValidIdentityName } from '../core/parsing/identity-extraction.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';
import { resumeDataToCvData } from '../core/resume-data.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '../..');

const CAREER_LINE =
  '30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, packaging.';
const EDU_LINE = '+33649434839 2011 2012 : LISAA, web and motion design';
const URL_MERGED_LINE = '++ Yoaz.Tumblr.Comagi - Yohann AZANCOT - 2011-2023';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const hit = classifyLineType(CAREER_LINE);
ok(hit.type === 'experience', `career line type=${hit.type} (expected experience)`);
const parsed = parseFreelanceCareerLine(CAREER_LINE);
ok(parsed?.company === 'Independent / Freelance', `freelance company=${parsed?.company}`);
ok(parsed?.role?.includes('Freelance'), `freelance role=${parsed?.role}`);

ok(!isValidIdentityName('Adress Mustrations'), 'reject OCR garbage name Adress Mustrations');
const merged = parseUrlMergedExperienceLine(URL_MERGED_LINE);
ok(merged?.recoveredName === 'Yohann Azancot', `merged name=${merged?.recoveredName}`);
ok(merged?.company === 'Independent / Freelance', `merged company=${merged?.company}`);
ok(merged?.startDate === '2011', `merged start=${merged?.startDate}`);

const sanitized = sanitizeResumeForDisplay({
  identity: { name: 'Adress Mustrations', title: 'Graphic designer & Illustrator', email: 'yoaz@example.com' },
  experiences: [{ role: URL_MERGED_LINE, company: '', dates: '', bullets: [] }],
  education: ['Créapole - Visual Communication - 2008-2011'],
  skills: ['Logo Design'],
  tools: ['Adobe Illustrator'],
  clients: ['Meta'],
  unsorted: [],
  meta: { rawText: URL_MERGED_LINE, cleanedText: URL_MERGED_LINE },
});
ok(
  /yohann\s+azancot/i.test(sanitized.identity?.name || ''),
  `sanitized name=${sanitized.identity?.name}`
);
ok(
  (sanitized.experiences || []).some(
    (e) => /freelance/i.test(e.role) && String(e.startDate) === '2011'
  ),
  `sanitized experiences=${JSON.stringify(sanitized.experiences?.map((e) => ({ role: e.role, start: e.startDate })))}`
);
ok(
  !(sanitized.experiences || []).some((e) => /tumblr|comagi/i.test(`${e.role} ${e.company}`)),
  'no raw URL blob in experiences'
);

const toolHit = classifyLineType('English: fluent Ps] photoshop EEE CTT');
ok(toolHit.type === 'tools', `software line type=${toolHit.type}`);

const careerAsTool = classifyLineType(CAREER_LINE);
ok(careerAsTool.type !== 'tools', 'career line not tools');

const ocrText = JSON.parse(
  readFileSync(join(root, 'tests/output/ocr-quality-yoaz/report.json'), 'utf8')
).ocrText;
const ent = extractPlainTextEnterprise(ocrText, 'ocr');
const cleaned = coerceParserInputText(ent.cleanedText, ocrText);
const pipe = await runProductionExtractionPipeline(ocrText, {
  rawText: ocrText,
  extractionMethod: 'ocr',
  enterpriseExtraction: ent,
});
const imp = productionToHirelyImportResult(pipe, null);
const rd = imp.resumeData;
resumeDataToCvData(rd);

ok((rd.experiences || []).length >= 1, `experiences=${rd.experiences?.length}`);
ok(
  (rd.education || []).some((e) => /lisaa|créapole|creapole/i.test(String(e))),
  `education has school: ${JSON.stringify(rd.education?.slice(0, 2))}`
);
ok(
  (rd.skills || []).some((s) => /design|illustration|packaging|graphic/i.test(String(s))),
  `skills=${JSON.stringify(rd.skills?.slice(0, 4))}`
);
ok(
  !(rd.tools || []).some((t) => /30-year|freelancer illustrator and graphic/i.test(String(t))),
  'no career sentence in tools'
);
ok((rd.unsorted || []).length < 35, `unsorted reduced to ${rd.unsorted?.length}`);
ok(
  (rd.education || []).some((e) => /lisaa/i.test(String(e))),
  `education includes LISAA: ${JSON.stringify(rd.education)}`
);
ok(rd.identity?.phone && !/2011/.test(rd.identity.phone), `phone=${rd.identity.phone}`);

process.exit(failed ? 1 : 0);
