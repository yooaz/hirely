#!/usr/bin/env node
/**
 * Yoaz PDF OCR regression — structured output quality + experience/education recovery.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'path';
import { fileURLToPath } from 'url';

import { runProductionExtractionPipeline } from '../src/core/pipeline/production-pipeline.js';
import { productionToHirelyImportResult } from '../src/core/pipeline/hirely-import.js';
import { extractPlainTextEnterprise } from '../src/core/extraction/enterprise-engine.js';
import {
  buildExperienceEntryFromLineGroup,
  normalizeExperienceRole,
  parseStrictExperiencesFromLines,
} from '../src/core/parsing/experience-parser.js';
import {
  parseFreelanceCareerLine,
  parseInternshipLine,
  parseEducationLineWithContact,
} from '../src/core/parsing/classification-fixes.js';
import { isCorruptEducationLine } from '../src/core/parsing/education-confidence.js';
import { resumeDataToCvData, resumeDataFromCvData, normalizeResumeData } from '../src/core/resume-data.js';
import { normalizeCvData } from '../src/core/parsing/rich-parser.js';
import { computeAtsScore } from '../src/core/validation/ats-engine.js';
import { logHirelyRuntimeVersion, logResumeDataCounts } from '../src/core/runtime/runtime-version.js';

const __dir = dirname(fileURLToPath(import.meta.url));
const root = join(__dir, '..');

const CAREER_LINE =
  '30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, packaging.';
const MCCANN_LINE = '20N : McCann G. Agency (Internship)';
const EDU_LINE = '+33649434839 2011 2012 : LISAA, web and motion design';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const normalizedRole = normalizeExperienceRole('30-year old Illustrator and graphic', CAREER_LINE);
ok(
  /freelance illustrator/i.test(normalizedRole) && /graphic designer/i.test(normalizedRole),
  `normalizeExperienceRole=${normalizedRole}`
);

const strictCareer = buildExperienceEntryFromLineGroup([CAREER_LINE]);
ok(strictCareer?.role, `strict parser career role=${strictCareer?.role}`);
ok(
  /independent\s*\/\s*freelance/i.test(String(strictCareer?.company || '')),
  `strict parser company=${strictCareer?.company}`
);
ok(/2011/.test(String(strictCareer?.startDate || strictCareer?.dates || '')), 'strict parser dates');

const freelance = parseFreelanceCareerLine(CAREER_LINE);
ok(
  freelance?.role === 'Freelance Illustrator / Graphic Designer',
  `freelance role=${freelance?.role}`
);

const eduParsed = parseEducationLineWithContact(EDU_LINE);
ok(/lisaa/i.test(eduParsed?.education || ''), `LISAA parsed=${eduParsed?.education}`);
ok(eduParsed?.phone === '+33649434839', `phone extracted=${eduParsed?.phone}`);

const intern = parseInternshipLine(MCCANN_LINE, { nearbyLines: [EDU_LINE, CAREER_LINE] });
ok(/mccann/i.test(intern?.company || ''), `McCann parsed company=${intern?.company}`);

const ocrText = JSON.parse(
  readFileSync(join(root, 'tests/output/ocr-quality-yoaz/report.json'), 'utf8')
).ocrText;
const ent = extractPlainTextEnterprise(ocrText, 'ocr');
const pipe = await runProductionExtractionPipeline(ocrText, {
  rawText: ocrText,
  extractionMethod: 'ocr',
  enterpriseExtraction: ent,
});
logHirelyRuntimeVersion();
const imp = productionToHirelyImportResult(pipe, null);
const rd = imp.resumeData;
logResumeDataCounts(rd, 'test:yoaz-pdf-regression:productionToHirelyImportResult');

const careerDupUnsorted = (rd.unsorted || []).some((u) => /30-year old Illustrator/i.test(String(u)));
const careerDupReview = (imp.reviewQueue || []).some((q) =>
  /30-year old Illustrator/i.test(String(q.sourceText || q.detected || ''))
);
ok(!careerDupUnsorted, 'career line not in unsorted when parsed as experience');
ok(!careerDupReview, `career line not in reviewQueue (${imp.reviewQueue?.length} items)`);

const lisaaDupReview = (imp.reviewQueue || []).some((q) =>
  /\blisaa\b/i.test(String(q.sourceText || q.detected || '')) &&
  (rd.education || []).some((e) => /lisaa/i.test(String(e)))
);
ok(!lisaaDupReview, 'LISAA not duplicated in reviewQueue when in education');

ok((rd.experiences || []).length >= 1, `experiences=${rd.experiences?.length}`);
ok((rd.education || []).length >= 1, `education=${rd.education?.length}`);
ok((rd.skills || []).length >= 3, `skills=${rd.skills?.length}`);
ok((rd.tools || []).length >= 2, `tools=${rd.tools?.length}`);
ok((rd.languages || []).length >= 1, `languages=${rd.languages?.length}`);
ok((rd.clients || []).length >= 4, `clients=${rd.clients?.length}`);
ok((rd.unsorted || []).length <= 20, `unsorted=${rd.unsorted?.length}`);

const exp0 = rd.experiences?.[0];
ok(
  /freelance illustrator\s*\/\s*graphic designer/i.test(String(exp0?.role || '')),
  `experience role=${exp0?.role}`
);
ok(
  (exp0?.bullets || []).some((b) => /posters|packaging/i.test(String(b))),
  `experience bullets=${JSON.stringify(exp0?.bullets || [])}`
);

const corruptEdu = (rd.education || []).filter((e) => isCorruptEducationLine(e));
ok(corruptEdu.length === 0, `no corrupt education in CV (${corruptEdu.join(' | ')})`);
ok(
  (rd.education || []).some((e) => /lisaa/i.test(String(e))),
  'education includes LISAA'
);

const clientBlob = JSON.stringify(rd.clients || []);
ok(!/\(|\)|and more/i.test(clientBlob), `clients clean: ${clientBlob}`);

const cv = resumeDataToCvData(rd);
ok((cv.experience || []).length >= 1, `cvData.experience=${cv.experience?.length}`);
ok((cv.education || []).length >= 1, `cvData.education=${cv.education?.length}`);

const rdRoundTrip = normalizeResumeData(resumeDataFromCvData(normalizeCvData(cv)));
ok((rdRoundTrip.experiences || []).length >= 1, `cv round-trip experiences=${rdRoundTrip.experiences?.length}`);
ok((rdRoundTrip.education || []).length >= 1, `cv round-trip education=${rdRoundTrip.education?.length}`);
ok(/freelance illustrator/i.test(String(rdRoundTrip.experiences?.[0]?.role || '')), 'round-trip preserves role');

const ats = computeAtsScore(cv);
ok(ats?.checklist?.find((c) => c.id === 'experience')?.ok, 'ATS experience ✓');
ok(ats?.checklist?.find((c) => c.id === 'education')?.ok, 'ATS education ✓');
ok(ats?.checklist?.find((c) => c.id === 'skills')?.ok, 'ATS skills ✓');

const mccannInExp = (rd.experiences || []).some((e) => /mccann/i.test(JSON.stringify(e)));
const mccannInClients = (rd.clients || []).some((c) => /mccann/i.test(String(c)));
const mccannInUnsorted = (rd.unsorted || []).some((u) => /mccann/i.test(String(u)));
ok(mccannInExp || mccannInClients || mccannInUnsorted, 'McCann preserved');

const lines = ent.cleanedText.split('\n').map((l) => l.trim()).filter(Boolean);
const fromLines = parseStrictExperiencesFromLines(lines);
ok(fromLines.experiences.length >= 1, `parseStrictExperiencesFromLines exp=${fromLines.experiences.length}`);

console.log('\n--- resumeData counts ---');
console.log({
  experiences: rd.experiences?.length,
  education: rd.education?.length,
  skills: rd.skills?.length,
  tools: rd.tools?.length,
  languages: rd.languages?.length,
  clients: rd.clients?.length,
  unsorted: rd.unsorted?.length,
});
console.log('experience[0]:', exp0);
console.log('education[0]:', rd.education?.[0]);
console.log('education[1]:', rd.education?.[1]);
console.log('clients:', rd.clients);
console.log('unsorted sample:', (rd.unsorted || []).slice(0, 8));

process.exit(failed ? 1 : 0);
