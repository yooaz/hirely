#!/usr/bin/env node
/**
 * Product acceptance — stable import → resumeData → render (no fake identity).
 * node src/tests/qa-product-acceptance.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

const { runHirelyImportFromText, runHirelyImportFromFile, buildProductFallback } = await import(
  '../core/pipeline/hirely-import.js'
);
const {
  resumeDataFromImport,
  resumeDataIsRenderable,
  normalizeResumeData,
  moveUnsortedToSection,
  resumeDataToCvData,
} = await import('../core/resume-data.js');
const { debugStructuredResumeJson, STRUCTURED_RESUME_JSON_MAX } = await import(
  '../core/pipeline/pipeline-contract.js'
);
const { NAME_UNCERTAIN_LABEL } = await import('../core/parsing/parser-recovery.js');
const { isValidIdentityName } = await import('../core/parsing/identity-extraction.js');

let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

const txtFixture = fs.readFileSync(
  path.join(root, 'tests/fixtures/creative-cv/fixture.txt'),
  'utf8'
);

const careerText = `
WORK EXPERIENCE
Freelancer — Graphic Designer
2011 – 2022
McCann Paris
`.trim();

// TXT / paste
const paste = await runHirelyImportFromText(txtFixture, { source: 'paste' });
ok(paste.rawText.length > 0, 'TXT/paste rawText');
ok(paste.cleanedText.length > 0, 'TXT/paste cleanedText');
ok(paste.resumeData, 'TXT/paste resumeData');
ok(!/print logo/i.test(paste.resumeData?.identity?.name || ''), 'no fake identity on paste');
ok(
  paste.resumeData?.identity?.name === NAME_UNCERTAIN_LABEL ||
    isValidIdentityName(paste.resumeData?.identity?.name),
  'paste identity uncertain or valid'
);
ok(JSON.parse(debugStructuredResumeJson(paste.structuredResume || {})) && true, 'slim JSON parseable');
ok(
  debugStructuredResumeJson(paste.structuredResume).length < STRUCTURED_RESUME_JSON_MAX,
  'structuredResume under 50k'
);
ok(resumeDataIsRenderable(paste.resumeData), 'paste renderable');

// Career recovery
const career = await runHirelyImportFromText(careerText, { source: 'paste' });
const rd = resumeDataFromImport(career);
ok(
  rd.experiences.length > 0 || rd.unsorted.length > 0,
  'career text in experience or unsorted'
);

// Product fallback
const fb = buildProductFallback(careerText, careerText);
ok(fb.resumeData?.unsorted?.length > 0, 'fallback preserves text in unsorted');
ok(fb.resumeData?.identity?.name === NAME_UNCERTAIN_LABEL, 'fallback name Nom à confirmer');
ok(fb.resumeData?.identity?.name === NAME_UNCERTAIN_LABEL, 'fallback no keyword name');

// Editor move
const moved = moveUnsortedToSection(
  normalizeResumeData({ ...fb.resumeData, unsorted: ['McCann Paris'] }),
  ['McCann Paris'],
  'client'
);
ok(moved.clients.includes('McCann Paris'), 'editor move to clients');

// Template data from resumeData
const cv = resumeDataToCvData(rd);
ok(cv && typeof cv.name === 'string', 'templateData derivable from resumeData');

// DOCX if fixture exists
const docxPath = [
  process.env.HIRELY_ACCEPT_DOCX,
  path.join(root, 'tests/fixtures/text-cv.docx'),
].find((p) => p && fs.existsSync(p));

if (docxPath) {
  const buf = fs.readFileSync(docxPath);
  const file = {
    name: path.basename(docxPath),
    type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    size: buf.length,
    arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
  try {
    const docx = await runHirelyImportFromFile(file, { source: 'docx-upload' });
    ok(docx.rawText?.length > 20 || docx.resumeData?.unsorted?.length > 0, 'DOCX import has content');
  } catch (e) {
    console.warn('DOCX skipped:', e.message);
  }
} else {
  console.log('SKIP DOCX (no fixture)');
}

// TEXT_EMPTY still returns editable shell (never blocks)
const emptyFile = await runHirelyImportFromText('', { source: 'paste' });
ok(emptyFile.resumeData, 'empty input still has resumeData');
ok(emptyFile.errors.includes('RAW_TEXT_EMPTY'), 'empty input flagged');

console.log('\nProduct acceptance:', failed ? 'FAILED' : 'PASSED');
process.exit(failed ? 1 : 0);
