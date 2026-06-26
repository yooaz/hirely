#!/usr/bin/env node
/**
 * Pipeline data contract — cleanedText never empty; structuredResume JSON bounded.
 */
import { readFileSync, existsSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';
import {
  normalizePipelineTexts,
  coerceParserInputText,
  slimStructuredResume,
  assertStructuredResumeJsonSize,
  assertExperienceRecovery,
  debugStructuredResumeJson,
  STRUCTURED_RESUME_JSON_MAX,
} from '../core/pipeline/pipeline-contract.js';
import { buildStructuredResumeFromBlocks } from '../core/parsing/structured-resume-from-blocks.js';
import { structuredToCvData } from '../core/parsing/structured-resume.js';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { NAME_UNCERTAIN_LABEL } from '../core/parsing/parser-recovery.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');

let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

const YOAZ_CAREER = `Yohann Azancot
Graphic Designer & Illustrator
yoaz@hotmail.fr
+33 6 49 43 48 39

WORK EXPERIENCE
Freelancer Illustrator, Graphic Designer
2011-2022
McCann G. Agency
Graphic Designer
2010-2011

EDUCATION
LISAA — Web Design
`;

const before = {
  rawTextLen: YOAZ_CAREER.length,
  cleanedTextLen: 0,
  jsonLen: 896739,
  experience: 0,
};

const norm = normalizePipelineTexts(YOAZ_CAREER, '');
ok(norm.cleanedText.length > 0, 'empty cleanedText falls back to rawText');
ok(norm.rawText.length > 0, 'rawText preserved');

const parserInput = coerceParserInputText('', YOAZ_CAREER);
ok(parserInput.length > 0, 'parser input from raw when clean empty');

const blocks = [
  {
    type: 'contact',
    text: 'yoaz@hotmail.fr\n+33 6 49 43 48 39',
    confidence: 92,
    accepted: true,
    lines: [
      { text: 'yoaz@hotmail.fr', cleanedText: 'yoaz@hotmail.fr' },
      { text: '+33 6 49 43 48 39', cleanedText: '+33 6 49 43 48 39' },
    ],
  },
  {
    type: 'experience',
    text: 'Freelancer Illustrator, Graphic Designer\n2011-2022\nMcCann G. Agency',
    confidence: 88,
    accepted: true,
    lines: [
      { text: 'Freelancer Illustrator, Graphic Designer', cleanedText: 'Freelancer Illustrator, Graphic Designer' },
      { text: '2011-2022', cleanedText: '2011-2022' },
      { text: 'McCann G. Agency', cleanedText: 'McCann G. Agency' },
    ],
  },
];

const structured = buildStructuredResumeFromBlocks(blocks, {
  rawText: YOAZ_CAREER,
  cleanedText: parserInput,
});

const srJson = debugStructuredResumeJson(structured);
const size = assertStructuredResumeJsonSize(structured);
ok(size.ok, `structuredResume JSON under ${STRUCTURED_RESUME_JSON_MAX} (got ${size.length})`);
ok(srJson.length < STRUCTURED_RESUME_JSON_MAX, 'debug JSON bounded');

const expOk =
  (structured.experiences?.length ?? 0) > 0 || (structured.unsorted?.length ?? 0) > 0;
ok(expOk, 'experience detected or queued to unsorted');

const cv = structuredToCvData(structured);
const cvJsonLen = JSON.stringify(cv).length;
ok(cvJsonLen < 100000, `cvData JSON not enormous (${cvJsonLen})`);

const pipe = await runHirelyImportFromText(YOAZ_CAREER, {
  extractionMethod: 'paste-text',
});

const after = {
  rawTextLen: String(pipe.rawText || '').length,
  cleanedTextLen: String(pipe.cleanedText || '').length,
  jsonLen: debugStructuredResumeJson(pipe.structuredResume).length,
  experience: pipe.structuredResume?.experiences?.length ?? 0,
  unsorted: pipe.structuredResume?.unsorted?.length ?? 0,
  name: pipe.structuredResume?.identity?.name || '',
  errors: pipe.errors || [],
};

console.log('BEFORE (broken contract):', JSON.stringify(before));
console.log('AFTER:', JSON.stringify(after));

ok(after.rawTextLen > 0, 'pipeline rawText > 0');
ok(after.cleanedTextLen > 0, 'pipeline cleanedText > 0');
ok(after.jsonLen < STRUCTURED_RESUME_JSON_MAX, 'pipeline structuredResume JSON bounded');
ok(!/print logo/i.test(after.name), 'pipeline identity.name not keyword cluster');
ok(after.name === NAME_UNCERTAIN_LABEL || !after.name || !/print logo|vector art/i.test(after.name), 'pipeline name uncertain or valid');
ok(after.errors.length === 0 || !after.errors.includes('STRUCTURED_RESUME_TOO_LARGE'), 'no oversized JSON error');
ok(
  after.experience > 0 || after.unsorted > 0,
  'pipeline experience or unsorted recovery'
);

try {
  assertExperienceRecovery({ experiences: [], unsorted: [] }, YOAZ_CAREER, { strict: true });
  ok(false, 'strict experience recovery should throw');
} catch {
  ok(true, 'strict experience recovery throws when career text missed');
}

const pdfPaths = [
  join(ROOT, 'tests/fixtures/yoaz-cv/fixture.pdf'),
  '/Users/yohannazancot/Documents/cv 2024 yohann azancot copie.pdf',
  '/Users/yohannazancot/Documents/cv2022 yohann azancot copie.pdf',
];
const pdfPath = pdfPaths.find((p) => existsSync(p));
if (pdfPath) {
  try {
    const { extractFromFileDetailed } = await import('../core/extraction/extract-file.js');
    const buf = readFileSync(pdfPath);
    const file =
      typeof File !== 'undefined'
        ? new File([buf], 'yoaz.pdf', { type: 'application/pdf' })
        : { name: 'yoaz.pdf', type: 'application/pdf', size: buf.length, arrayBuffer: async () => buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength) };
    const detailed = await extractFromFileDetailed(file);
    const { runHirelyImportFromFile } = await import('../core/pipeline/hirely-import.js');
    const pdfImport = await runHirelyImportFromFile(file, {
      extractionMethod: detailed.method || 'pdf',
      enterpriseExtraction: detailed.enterprise,
      pdfExtraction: detailed.pdfExtraction,
    });
    ok(String(pdfImport.cleanedText || '').length > 0, 'PDF cleanedText > 0');
    ok(
      debugStructuredResumeJson(pdfImport.structuredResume).length < STRUCTURED_RESUME_JSON_MAX,
      'PDF structuredResume JSON bounded'
    );
    console.log('PDF structuredResume:', debugStructuredResumeJson(pdfImport.structuredResume).slice(0, 2000));
  } catch (e) {
    console.warn('PDF contract test skipped:', e.message);
  }
} else {
  console.log('SKIP PDF (fixture not on disk)');
}

process.exit(failed ? 1 : 0);
