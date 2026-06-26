#!/usr/bin/env node
/**
 * P0 — OCR + text dedupe engine QA (fuzzy / Levenshtein / semantic).
 */
import {
  DEDUPE_ENGINE,
  DEDUPE_SIMILARITY_DEFAULT,
  normalizeCompareString,
  dedupeEducationStrings,
  dedupeExperienceEntries,
  dedupeCvExperienceLines,
  dedupeStringList,
  dedupeBySimilarity,
  dedupeTextLinesBySimilarity,
  semanticSimilarity,
  semanticSimilarityForDedup,
  levenshteinSimilarity,
} from '../core/parsing/dedupe-engine.js';
import { dedupePlainText } from '../core/extraction/extraction-audit.js';
import { dedupeFinalResumeData, auditFinalResumeDuplicates } from '../core/validation/dedupe-final-resume.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';
import { applyDataSanitizationLayer } from '../core/validation/data-sanitization-layer.js';
import { resumeDataToCvData } from '../core/resume-data.js';

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

ok(DEDUPE_ENGINE === 'DEDUPE_ENGINE_V3', 'engine version V3');
ok(DEDUPE_SIMILARITY_DEFAULT === 0.88, 'default similarity threshold');
ok(
  normalizeCompareString('  Créapole  ') === normalizeCompareString('creapole'),
  'normalize trim + lowercase + accent fold'
);
ok(levenshteinSimilarity('Nike', 'Nike') === 1, 'Levenshtein exact Nike');
ok(semanticSimilarity('McCann G. Agency', 'McCann G Agency') >= 0.9, 'fuzzy McCann OCR variant');
ok(semanticSimilarityForDedup('Nike', 'Graphic Designer — Nike — 2019') < 0.92, 'Nike not lost inside experience line');
ok(semanticSimilarityForDedup('Adobe', 'Adobe Illustrator') < 0.92, 'Adobe vs Adobe Illustrator kept separate');

const entityDupes = dedupeStringList(['Nike', 'Nike', 'McCann', 'McCann', 'Adobe Illustrator', 'Adobe Illustrator']);
ok(entityDupes.filter((c) => /^nike$/i.test(c)).length === 1, 'Nike + Nike = 1');
ok(entityDupes.filter((c) => /^mccann$/i.test(c)).length === 1, 'McCann + McCann = 1');
ok(entityDupes.filter((c) => /adobe illustrator/i.test(c)).length === 1, 'Adobe Illustrator + Adobe Illustrator = 1');

const ocrLines = dedupeTextLinesBySimilarity([
  'Senior Designer — McCann — 2018–2020',
  'Senior Designer - McCann - 2018-2020',
  'Nike',
  'Nike',
  'Adobe Illustrator',
  'Adobe  Illustrator',
]);
ok(ocrLines.length === 3, `OCR merged lines deduped (${ocrLines.length})`);

const mergedPdfText = [
  'Experience',
  'Graphic Designer — Nike — 2019–Present',
  'Graphic Designer — Nike — 2019–Present',
  'Education',
  'LISAA — Web Design — 2011–2012',
  'LISAA — Web Design — 2011–2012',
].join('\n');
const plainDedupe = dedupePlainText(mergedPdfText);
ok((plainDedupe.text.match(/Graphic Designer — Nike/g) || []).length <= 1, 'plain text: Nike experience once');
ok((plainDedupe.text.match(/LISAA/g) || []).length === 1, 'plain text: LISAA education once');

const eduDupes = dedupeEducationStrings([
  'Créapole',
  'Créapole',
  'Creative School Management',
  'Creative School Management',
  'LISAA — Web & Motion Design — 2011–2012',
]);
ok(eduDupes.filter((l) => /créapole/i.test(l)).length === 1, 'Créapole appears once');
ok(
  eduDupes.filter((l) => /creative school management/i.test(l)).length === 1,
  'Creative School Management appears once'
);
ok(eduDupes.filter((l) => /lisaa/i.test(l)).length === 1, 'LISAA preserved');

const expDupes = dedupeExperienceEntries([
  { role: 'Freelance', company: '', dates: '', bullets: [] },
  { role: 'Freelance', company: '', dates: '', bullets: ['Posters'] },
  { role: 'Graphic Designer', company: 'McCann', dates: '2018–2020', bullets: [] },
  { role: 'Graphic Designer', company: 'McCann', dates: '2018–2020', bullets: ['Campaigns'] },
  { role: 'Designer', company: 'Nike', dates: '2019–Present', bullets: [] },
  { role: 'Designer', company: 'Nike', dates: '2019-Present', bullets: ['Campaigns'] },
]);
ok(expDupes.filter((e) => /freelance/i.test(e.role)).length === 1, 'Freelance appears once');
ok(
  expDupes.find((e) => /freelance/i.test(e.role))?.bullets?.length === 1,
  'Freelance merge keeps richer bullets'
);
ok(expDupes.filter((e) => /mccann/i.test(e.company)).length === 1, 'McCann appears once');
ok(expDupes.filter((e) => /nike/i.test(e.company)).length === 1, 'Nike experience appears once');

const cvLines = dedupeCvExperienceLines([
  'Freelance — Independent — 2011–2022',
  'Freelance — Independent — 2011–2022',
]);
ok(cvLines.length === 1, 'cv experience lines deduped');

const resumeData = sanitizeResumeForDisplay({
  identity: { name: 'Test User', title: 'Designer', email: 't@test.com' },
  summary: '',
  experiences: [
    { role: 'Freelance', company: '', dates: '', bullets: [] },
    { role: 'Freelance', company: '', dates: '', bullets: [] },
    { role: 'Designer', company: 'Agency', dates: '2020–2022', bullets: [] },
    { role: 'Designer', company: 'Agency', dates: '2020–2022', bullets: ['Work'] },
  ],
  education: ['Créapole', 'Créapole', 'Creative School Management', 'Creative School Management'],
  skills: ['Brand Identity', 'brand identity', 'Illustration'],
  tools: ['Adobe Illustrator', 'Adobe Illustrator', 'Photoshop'],
  languages: [],
  clients: ['Nike', 'Nike', 'Adobe', 'Adobe'],
  projects: [],
  unsorted: [],
  meta: {},
});
ok(
  (resumeData.education || []).filter((l) => /créapole/i.test(l)).length === 1,
  'sanitizer: Créapole once'
);
ok(
  (resumeData.experiences || []).filter((e) => /freelance/i.test(e.role)).length === 1,
  'sanitizer: Freelance once'
);
ok((resumeData.clients || []).filter((c) => /^nike$/i.test(c)).length === 1, 'sanitizer: Nike client once');

const built = buildFinalResumeData(resumeData);
ok(
  (built.finalResumeData?.education || []).filter((l) => /créapole|creapole/i.test(l)).length <= 1,
  'final contract: Créapole at most once'
);
ok(
  (built.finalResumeData?.education || []).filter((l) => /creative school management/i.test(l)).length <= 1,
  'final contract: no duplicate school rows'
);

const frd = dedupeFinalResumeData({
  identity: { name: 'Alex' },
  education: ['RISD — Graphic Design', 'RISD - Graphic Design'],
  experiences: [
    { role: 'Designer', company: 'Nike', dates: '2019–Present', bullets: [] },
    { role: 'Designer', company: 'Nike', dates: '2019-Present', bullets: ['Retail'] },
  ],
  skills: ['Typography', 'typography'],
  tools: ['Adobe Illustrator', 'Adobe  Illustrator'],
  languages: ['English — fluent', 'english — fluent'],
  clients: ['Nike', 'Nike', 'McCann', 'McCann'],
  projects: ['Air Max campaign', 'Air Max Campaign'],
});
const dupAudit = auditFinalResumeDuplicates(frd);
ok(dupAudit.ok, `no duplicate entities in finalResumeData (${dupAudit.duplicates.length} found)`);
ok((frd.clients || []).length === 2, 'clients: Nike + McCann only');
ok((frd.tools || []).length === 1, 'tools: Adobe Illustrator once');

const cv = applyDataSanitizationLayer(
  resumeDataToCvData(built.finalResumeData, { skipNormalize: true })
);
ok(
  (cv.experience || []).filter((l) => /freelance/i.test(l)).length <= 1,
  'cvData layer: freelance line once'
);

ok(
  dedupeBySimilarity(['A', 'A']).length === 1 && dedupeBySimilarity(['A', 'B']).length === 2,
  'dedupeBySimilarity core'
);

if (failed) {
  console.error(`\nqa-dedupe-engine FAILED (${failed})`);
  process.exit(1);
}
console.log('\nqa-dedupe-engine PASSED');
