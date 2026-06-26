#!/usr/bin/env node
/**
 * P1 — EXPERIENCE_PARSER_V2 acceptance: date-anchored split, no merged jobs.
 */
import {
  parseExperiencesV2,
  splitExperienceLines,
  splitMergedExperienceByDates,
  isExperienceEntryStartLine,
  extractExperienceDateRange,
  EXPERIENCE_SPLIT_PARSER_V2,
} from '../core/parsing/experience-split-parser.js';
import { splitLinesIntoDateAnchoredGroups } from '../core/parsing/block-reconstruction.js';
import { buildExperiencesFromClassifiedBlocks } from '../core/parsing/experience-builder-v2.js';
import { reconstructExperienceEntries } from '../core/parsing/experience-reconstruction-engine.js';
import { normalizeCvData } from '../core/parsing/rich-parser.js';
import { SECTION_IDS } from '../core/parsing/section-types-v2.js';

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const MCCANN_FREELANCE_LINES = [
  'Designer - McCann - 2011-2014',
  'Freelance - 2014-2025',
];

ok(isExperienceEntryStartLine('Designer - McCann - 2011-2014'), 'McCann line is entry start');
ok(isExperienceEntryStartLine('Freelance - 2014-2025'), 'Freelance line is entry start');
ok(isExperienceEntryStartLine('Jan 2018 - Mar 2022'), 'month+year range is entry start');
ok(!isExperienceEntryStartLine('- Led cross-functional design sprints in 2019'), 'bullet description is not entry start');

const groups = splitExperienceLines(MCCANN_FREELANCE_LINES);
ok(groups.length === 2, `split into two groups (${groups.length})`);

const legacyGroups = splitLinesIntoDateAnchoredGroups(MCCANN_FREELANCE_LINES);
ok(legacyGroups.length === 2, `legacy split into two groups (${legacyGroups.length})`);

const parsed = parseExperiencesV2(MCCANN_FREELANCE_LINES);
ok(parsed.count === 2, `parseExperiencesV2 returns two entries (${parsed.count})`);
ok(parsed.engine === EXPERIENCE_SPLIT_PARSER_V2, 'engine id set');

const mccann = parsed.entries.find((e) => /mccann/i.test(e.company));
const freelance = parsed.entries.find((e) => /freelanc/i.test(e.title || e.role));
ok(Boolean(mccann), 'McCann entry present');
ok(Boolean(freelance), 'Freelance entry present');
ok(mccann.title === 'Designer', `McCann title (${mccann.title})`);
ok(/mccann/i.test(mccann.company), `McCann company (${mccann.company})`);
ok(mccann.startDate === '2011' && mccann.endDate === '2014', `McCann dates (${mccann.startDate}-${mccann.endDate})`);
ok(/freelance/i.test(freelance.title), `Freelance title (${freelance.title})`);
ok(freelance.startDate === '2014' && freelance.endDate === '2025', `Freelance dates (${freelance.startDate}-${freelance.endDate})`);

const mergedOneLine = 'Designer - McCann - 2011-2014 Freelance - 2014-2025';
const splitParts = splitMergedExperienceByDates(mergedOneLine);
ok(splitParts.length === 2, `merged one-line splits (${splitParts.length})`);

const reconMerged = reconstructExperienceEntries([mergedOneLine]);
ok(reconMerged.count === 2, `reconstruction splits merged blob (${reconMerged.count})`);

const monthDates = extractExperienceDateRange('Senior Designer — Jan 2018 - Mar 2022');
ok(/jan 2018/i.test(monthDates.startDate), `month start (${monthDates.startDate})`);
ok(/mar 2022/i.test(monthDates.endDate), `month end (${monthDates.endDate})`);

const builder = buildExperiencesFromClassifiedBlocks([
  {
    id: 'exp-mccann-freelance',
    type: SECTION_IDS.EXPERIENCE,
    sectionHint: 'experience',
    anchor: 'date',
    lines: MCCANN_FREELANCE_LINES,
    signals: { hasDate: true },
  },
]);
ok(builder.experiences.length === 2, `builder emits two experiences (${builder.experiences.length})`);
ok(
  builder.experiences.some((e) => /mccann/i.test(e.company || '')) &&
    builder.experiences.some((e) => /\bfreelanc/i.test(e.role || '')),
  'builder keeps McCann and Freelance separate'
);

const normalized = normalizeCvData({
  name: 'Test User',
  experience: MCCANN_FREELANCE_LINES,
});
ok(normalized.experience.length === 2, `normalizeCvData keeps two experience lines (${normalized.experience.length})`);
ok(
  !normalized.experience.some((line) => /mccann.*freelance|freelance.*mccann/i.test(line)),
  'no giant merged experience sentence'
);

console.log('\nEXPERIENCE_PARSER_V2 QA PASS');
