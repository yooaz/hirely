#!/usr/bin/env node
/**
 * Block reconstruction + experience parser v2 — date-anchored groups, no line-by-line jobs.
 */
import {
  reconstructLineBlocks,
  splitLinesIntoDateAnchoredGroups,
} from '../core/parsing/block-reconstruction.js';
import {
  parseExperiencesFromExperienceBlocks,
  EXPERIENCE_V2_CONFIDENCE_MIN,
} from '../core/parsing/experience-parser-v2.js';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';
import { SECTION_IDS } from '../core/parsing/section-types-v2.js';
import { lineIsSkillOrTagOnly } from '../core/parsing/experience-parser.js';

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const ocrSample = `
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
`;

const { lineGroupBlocks, lines } = reconstructLineBlocks(ocrSample);
ok(lineGroupBlocks.length >= 3, `blocks created (${lineGroupBlocks.length})`);
ok(
  lineGroupBlocks.some((b) => b.signals?.hasDate && /2011-2022/.test(b.text)),
  'date block includes 2011-2022 cluster'
);
ok(
  lines.some((l) => /Illustrator and Graphic Designer/i.test(l)),
  'role continuation merged'
);

const dateGroups = splitLinesIntoDateAnchoredGroups([
  '2011-2022',
  'Freelancer Illustrator',
  'Independent / Freelance',
]);
ok(dateGroups.length === 1 && dateGroups[0].length === 3, 'date anchor collects nearby lines');

const expBlocks = [
  {
    id: 'exp-1',
    type: SECTION_IDS.EXPERIENCE,
    lines: ['2011-2022', 'Freelancer Illustrator', 'Independent / Freelance'],
  },
];
const parsed = parseExperiencesFromExperienceBlocks(expBlocks);
ok(parsed.experiences.length >= 1, `experience accepted (${parsed.experiences.length})`);
ok(
  parsed.experiences.some(
    (e) =>
      /2011/.test(e.startDate || '') &&
      (/\bfreelanc/i.test(e.role || '') ||
        /Independent\s*\/\s*Freelance/i.test(e.company || ''))
  ),
  'freelance engagement with 2011 dates'
);
ok(
  !parsed.experiences.some((e) => lineIsSkillOrTagOnly(e.role) || /music|adobe|créapole|product design/i.test(e.role)),
  'no skill/education hallucinations as jobs'
);
ok(parsed.audit.rejected.length >= 0, 'audit trail present');
ok(EXPERIENCE_V2_CONFIDENCE_MIN === 80, 'confidence gate at 80%');

const engine = runSectionEngineV2(ocrSample, { rawText: ocrSample });
const exps = engine.structured?.experiences || [];
const unsorted = (engine.structured?.unsorted || []).join('\n').toLowerCase();
ok(
  !exps.some((e) => /year old|music|adobe|créapole|product design/i.test(`${e.role} ${e.company}`)),
  'section engine: no garbage jobs'
);
ok(
  exps.length >= 1 || /freelanc|2011|intern/.test(unsorted),
  'career text preserved in experience or unsorted'
);

console.log('\nBLOCK EXPERIENCE V2 QA OK');
