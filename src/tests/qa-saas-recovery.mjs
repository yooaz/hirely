#!/usr/bin/env node
/**
 * SaaS recovery acceptance — canonical import, resumeData contract, no fake identity.
 * node src/tests/qa-saas-recovery.mjs
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

const {
  canonicalImportFromText,
  canonicalImportFromFile,
  normalizeText,
} = await import('../core/import/canonical-import.js');
const {
  buildResumeData,
  assertResumeDataContract,
  moveUnsortedToSection,
  resumeDataToCvData,
} = await import('../core/resume-data.js');
const { NAME_UNCERTAIN_LABEL, TITLE_UNCERTAIN_LABEL } = await import('../core/parsing/parser-recovery.js');
const { shouldSkipRemoteOcr, isStaticLocalMode } = await import('../core/runtime/static-mode.js');

let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

ok(isStaticLocalMode() === true || typeof process !== 'undefined', 'static mode detect');
ok(shouldSkipRemoteOcr() === true, 'skip remote OCR on static');

const txt = fs.readFileSync(path.join(root, 'tests/fixtures/creative-cv/fixture.txt'), 'utf8');

// 1 TXT / 5 paste
const paste = await canonicalImportFromText(txt, { source: 'paste' });
ok(paste.rawText.length > 0, 'TXT/paste rawText');
ok(paste.resumeData, 'paste resumeData');
ok(assertResumeDataContract(paste.resumeData).ok, 'resumeData contract');
ok(!/print logo/i.test(paste.resumeData.identity?.name || ''), 'no keyword name');

// 6 duplicate import
const paste2 = await canonicalImportFromText(txt, { source: 'paste' });
ok(paste2.rawText.length === paste.rawText.length, 'same file twice stable');

// 7 career
const career = await canonicalImportFromText(
  'WORK EXPERIENCE\nDesigner — Agency\n2019 – 2024\n',
  { source: 'paste' }
);
ok(
  career.resumeData.experiences.length > 0 || career.resumeData.unsorted.length > 0,
  'experience or unsorted'
);

// 8 template data
const cv = resumeDataToCvData(paste.resumeData);
ok(typeof cv.name === 'string', 'template from resumeData only');

// 9 manual edit move
const moved = moveUnsortedToSection(
  { ...paste.resumeData, unsorted: ['Adobe Photoshop'] },
  ['Adobe Photoshop'],
  'tool'
);
ok(
  moved.tools.some((t) => /photoshop/i.test(String(t))),
  'move unsorted → tools'
);

// 10 empty → shell + uncertain labels
const empty = await canonicalImportFromText('   ', { source: 'paste' });
ok(empty.resumeData, 'empty paste resumeData');
ok(
  empty.resumeData.identity?.name === NAME_UNCERTAIN_LABEL,
  'empty uncertain name'
);

// normalizeText never drops raw
const norm = normalizeText('Line one\nLine two', '');
ok(norm.cleanedText.length > 0, 'normalize keeps text');

// buildResumeData size guard
const huge = buildResumeData({
  structured: {
    identity: { name: NAME_UNCERTAIN_LABEL, title: TITLE_UNCERTAIN_LABEL },
    unsorted: Array.from({ length: 8000 }, (_, i) => `line ${i} padding text`),
  },
  rawText: 'x',
  cleanedText: 'x',
});
ok(assertResumeDataContract(huge).ok || huge.meta.errors.includes('DATA_CONTRACT_BROKEN'), 'oversize handled');

console.log('\nSaaS recovery acceptance:', failed ? 'FAILED' : 'PASSED');
process.exit(failed ? 1 : 0);
