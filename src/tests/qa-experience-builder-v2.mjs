#!/usr/bin/env node
/**
 * EXPERIENCE_BUILDER_V2 — classified experience blocks only, no garbage jobs.
 */
import {
  buildExperiencesFromClassifiedBlocks,
  normalizeExperienceFields,
  validateExperienceCandidate,
  mergeAdjacentExperienceBlocks,
  filterExperienceBlocksOnly,
  EXPERIENCE_BUILDER_MIN_CONFIDENCE,
} from '../core/parsing/experience-builder-v2.js';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';
import { SECTION_IDS } from '../core/parsing/section-types-v2.js';
import { classifyDocumentBlocksV1, documentBlocksToSectionBlocks } from '../core/parsing/section-classifier-v1.js';
import { buildDocumentBlocksFromOcrLines } from '../core/parsing/block-builder-v1.js';

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const garbageSample = `
30-year old Illustrator and Graphic
Designer
2011-2022
Freelancer Illustrator
Independent / Freelance
WORK EXPERIENCE
Music
Adobe
EDUCATION
Créapole
Product Design
McCann G. Agency Internship
2010 — 2011
`;

const ocrLines = garbageSample
  .split(/\r?\n/)
  .map((l) => l.trim())
  .filter(Boolean);

const { documentBlocks } = buildDocumentBlocksFromOcrLines(ocrLines, { source: 'ocr' });
const classified = classifyDocumentBlocksV1(documentBlocks);
const sectionBlocks = documentBlocksToSectionBlocks(classified.blocks);
const experienceBlocks = filterExperienceBlocksOnly(sectionBlocks);

ok(experienceBlocks.length >= 1, `experience blocks only (${experienceBlocks.length})`);
ok(
  !sectionBlocks.some(
    (b) => b.type === SECTION_IDS.EXPERIENCE && /music|créapole|product design/i.test((b.lines || []).join('\n'))
  ),
  'Music/Créapole/Product design not in experience blocks after classifier'
);

const merged = mergeAdjacentExperienceBlocks(experienceBlocks);
ok(merged.length >= 1, `merged date+role blocks (${merged.length})`);

const parsed = buildExperiencesFromClassifiedBlocks(merged);
ok(parsed.experiences.length >= 1, `accepted experiences (${parsed.experiences.length})`);

const badRolePattern = /year\s*old|^\s*music\s*$|^\s*product design\s*$|créapole|creapole/i;
ok(
  !parsed.experiences.some(
    (e) => badRolePattern.test(e.role || '') || badRolePattern.test(e.company || '')
  ),
  'no Year Old / Music / Product design / Créapole as experience'
);

const freelance = parsed.experiences.find((e) => /\bfreelanc/i.test(e.role || ''));
ok(Boolean(freelance), 'freelance experience accepted');
ok(/2011/.test(freelance.startDate || ''), 'freelance has 2011 start date');
ok(
  /Independent\s*\/\s*Freelance/i.test(freelance.company || ''),
  'freelance company normalized'
);
ok(/\bFreelance\b/i.test(freelance.role || ''), 'Freelancer → Freelance role normalization');

const internNorm = normalizeExperienceFields({
  role: '',
  company: 'McCann G. Agency Internship',
  startDate: '2010',
  endDate: '2011',
});
ok(internNorm.role === 'Intern', 'intern role extracted');
ok(/McCann G\. Agency/i.test(internNorm.company), 'intern company normalized');

const internValidation = validateExperienceCandidate(internNorm, { inExperienceSection: true, hasDateInBlock: true });
ok(internValidation.ok, 'intern entry validates');

const ageReject = validateExperienceCandidate(
  { role: '30-year old Illustrator And Graphic', company: '', startDate: '2011', endDate: '2022' },
  { inExperienceSection: true, hasDateInBlock: true }
);
ok(!ageReject.ok && ageReject.reason === 'age_as_role', 'age as role rejected');

const musicReject = validateExperienceCandidate(
  { role: 'Music', company: '', startDate: '2011', endDate: '2022' },
  { inExperienceSection: true, hasDateInBlock: true }
);
ok(!musicReject.ok, 'Music as role rejected');

const creapoleReject = validateExperienceCandidate(
  { role: 'Designer', company: 'Créapole', startDate: '2011', endDate: '2012' },
  { inExperienceSection: true, hasDateInBlock: true }
);
ok(!creapoleReject.ok && creapoleReject.reason === 'school_as_company', 'Créapole as company rejected');

ok(parsed.audit.rejected.length >= 0, 'rejection audit present');
ok(EXPERIENCE_BUILDER_MIN_CONFIDENCE === 80, 'confidence gate at 80%');

const nonExpBlocks = [
  { id: 'u1', type: SECTION_IDS.UNKNOWN, lines: ['Music, Movies, Nature'] },
  { id: 'e1', type: SECTION_IDS.EDUCATION, lines: ['Créapole — Product Design'] },
  { id: 's1', type: SECTION_IDS.SKILLS, lines: ['Illustration, Branding'] },
  { id: 'x1', type: SECTION_IDS.EXPERIENCE, lines: ['2011-2022', 'Freelancer Illustrator', 'Independent / Freelance'] },
];
const scoped = buildExperiencesFromClassifiedBlocks(nonExpBlocks);
ok(scoped.experiences.length >= 1, 'only EXPERIENCE block parsed');
ok(
  !scoped.experiences.some((e) => /music|créapole/i.test(`${e.role} ${e.company}`)),
  'unknown/education/skills blocks ignored'
);

const engine = runSectionEngineV2(garbageSample, { rawText: garbageSample });
const exps = engine.structured?.experiences || [];
ok(
  !exps.some((e) => badRolePattern.test(`${e.role} ${e.company}`)),
  'section engine: no garbage jobs'
);

console.log('\nEXPERIENCE_BUILDER_V2 QA OK', {
  experiences: parsed.experiences.length,
  rejected: parsed.audit.rejected.length,
});
