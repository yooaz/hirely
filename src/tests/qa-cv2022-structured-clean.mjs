#!/usr/bin/env node
/**
 * Acceptance — cv2022 yohann azancot copie.pdf
 * node src/tests/qa-cv2022-structured-clean.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { extractFromFileDetailed } from '../core/extraction/extract-file.js';
import { runHirelyImportFromFile, runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import {
  STRUCTURED_RESUME_JSON_MAX,
  assertStrictStructuredResumeKeys,
  guardStructuredResumeSize,
} from '../core/pipeline/pipeline-contract.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/cv2022-structured-clean');
fs.mkdirSync(outDir, { recursive: true });

const PDF_CANDIDATES = [
  process.env.HIRELY_YOAZ_PDF,
  '/Users/yohannazancot/Documents/cv2022 yohann azancot copie.pdf',
  '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
].filter(Boolean);

function resolvePdf() {
  for (const p of PDF_CANDIDATES) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

const pdfPath = resolvePdf();
let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

if (!pdfPath) {
  console.error('PDF not found — set HIRELY_YOAZ_PDF');
  process.exit(1);
}

const buf = fs.readFileSync(pdfPath);
const file =
  typeof File !== 'undefined'
    ? new File([buf], path.basename(pdfPath), { type: 'application/pdf' })
    : {
        name: path.basename(pdfPath),
        type: 'application/pdf',
        size: buf.length,
        arrayBuffer: async () =>
          buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
      };

const fixturePath = path.join(root, 'tests/fixtures/yoaz-cv/fixture.txt');
let imported;
let rawLen = 0;
let usedFixture = false;

try {
  const detailed = await extractFromFileDetailed(file);
  rawLen = String(detailed.enterprise?.rawExtraction || detailed.text || '').length;
  imported = await runHirelyImportFromFile(file, {
    extractionMethod: detailed.method || 'pdf',
    enterpriseExtraction: detailed.enterprise,
    pdfExtraction: detailed.pdfExtraction,
  });
} catch (err) {
  console.warn('PDF extract in Node skipped:', err.message);
  if (!fs.existsSync(fixturePath)) throw err;
  const fixture = fs.readFileSync(fixturePath, 'utf8');
  rawLen = fixture.length;
  usedFixture = true;
  imported = await runHirelyImportFromText(fixture, { extractionMethod: 'paste-text' });
}

ok(rawLen > 1200, `rawText > 1200 (${rawLen})`);

const sr = imported.structuredResume || {};
const srJson = JSON.stringify(sr);
const srSize = srJson.length;
const keys = Object.keys(sr);
const forbidden = assertStrictStructuredResumeKeys(sr);

ok(!imported.errors.includes('STRUCTURED_RESUME_TOO_LARGE'), 'no STRUCTURED_RESUME_TOO_LARGE error');
ok(srSize < STRUCTURED_RESUME_JSON_MAX, `structuredResume < ${STRUCTURED_RESUME_JSON_MAX} (${srSize})`);
ok(forbidden.ok, `only schema keys (forbidden: ${forbidden.forbidden.join(', ') || 'none'})`);
ok(!/"(graph|debug|audit|metadata|parserTrace|documentBlocks)"/i.test(srJson), 'no debug blobs in JSON');

const title = String(sr.identity?.title || '').toLowerCase();
ok(
  title.includes('graphic designer') && title.includes('illustrator'),
  `title Graphic Designer & Illustrator (got "${sr.identity?.title}")`
);

const expN = sr.experiences?.length ?? 0;
const unsortedHay = (sr.unsorted || []).join('\n').toLowerCase();
const expOk =
  expN > 0 ||
  /\b(freelanc|mccann|illustrator|graphic designer|work experience)\b/i.test(unsortedHay);
ok(expOk, `experienceCount > 0 or career text in unsorted (exp=${expN})`);

const guarded = guardStructuredResumeSize(sr, imported.cleanedText);
ok(guarded.size === srSize, 'guard idempotent on clean resume');

const report = {
  pdf: pdfPath,
  usedFixture,
  rawTextLength: rawLen,
  structuredResumeKeys: keys,
  structuredResumeSize: srSize,
  experienceCount: expN,
  unsortedCount: sr.unsorted?.length ?? 0,
  identityName: sr.identity?.name,
  identityTitle: sr.identity?.title,
  errors: imported.errors,
  warnings: imported.warnings,
  debugReportChars: imported.debugReport ? JSON.stringify(imported.debugReport).length : 0,
};
fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log('\n--- REPORT ---');
console.log(JSON.stringify(report, null, 2));
console.log('\nReport:', path.join(outDir, 'report.json'));
process.exit(failed ? 1 : 0);
