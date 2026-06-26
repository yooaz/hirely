#!/usr/bin/env node
/**
 * P1 — EXPERIENCE_SEGMENTATION_ENGINE acceptance.
 */
import {
  parseSegmentedExperiences,
  segmentExperienceInput,
  shouldSplitExperienceSegment,
  isCompanyHeaderLine,
  experienceEntryComplete,
  EXPERIENCE_SEGMENTATION_ENGINE,
} from '../core/parsing/experience-segmentation-engine.js';
import { reconstructExperienceEntries, applyExperienceReconstruction } from '../core/parsing/experience-reconstruction-engine.js';
import { normalizeCvData } from '../core/parsing/rich-parser.js';

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const ACCEPTANCE_LINES = [
  'Designer - McCann - 2011-2014',
  'Freelance - 2014-2025',
  'Illustrator - Nike projects - 2016-2020',
];

ok(isCompanyHeaderLine('McCann Paris'), 'McCann Paris is company header');
ok(isCompanyHeaderLine('Nike projects'), 'Nike projects is company header');

const prev = { title: 'Designer', company: 'McCann', startDate: '2011', endDate: '2014' };
const next = { title: 'Freelance', company: 'Independent', startDate: '2014', endDate: '2025' };
ok(shouldSplitExperienceSegment(prev, next, 'Freelance - 2014-2025'), 'split on new title/company/dates');

const groups = segmentExperienceInput(ACCEPTANCE_LINES);
ok(groups.length === 3, `segmented into three groups (${groups.length})`);

const parsed = parseSegmentedExperiences(ACCEPTANCE_LINES);
ok(parsed.count === 3, `three distinct entries (${parsed.count})`);
ok(parsed.engine === EXPERIENCE_SEGMENTATION_ENGINE, 'engine id set');

const mccann = parsed.entries.find((e) => /mccann/i.test(e.company));
const freelance = parsed.entries.find((e) => /freelanc/i.test(e.title));
const nike = parsed.entries.find((e) => /nike/i.test(e.company));

ok(Boolean(mccann), 'McCann entry present');
ok(Boolean(freelance), 'Freelance entry present');
ok(Boolean(nike), 'Nike projects entry present');

for (const entry of [mccann, freelance, nike]) {
  ok(experienceEntryComplete(entry), `entry complete (${entry.title} @ ${entry.company})`);
  ok(entry.title && entry.company && entry.startDate, `title/company/dates (${entry.title}|${entry.company}|${entry.startDate})`);
}

ok(mccann.startDate === '2011' && mccann.endDate === '2014', `McCann dates (${mccann.startDate}-${mccann.endDate})`);
ok(freelance.startDate === '2014' && freelance.endDate === '2025', `Freelance dates (${freelance.startDate}-${freelance.endDate})`);
ok(nike.startDate === '2016' && nike.endDate === '2020', `Nike dates (${nike.startDate}-${nike.endDate})`);

const mergedBlob =
  'Designer - McCann - 2011-2014 Freelance - 2014-2025 Illustrator - Nike projects - 2016-2020';
const merged = parseSegmentedExperiences([mergedBlob]);
ok(merged.count === 3, `merged blob splits to three (${merged.count})`);

const recon = reconstructExperienceEntries(ACCEPTANCE_LINES);
ok(recon.count === 3, `reconstruction emits three (${recon.count})`);
ok(
  recon.entries.some((e) => /mccann/i.test(e.company || '')) &&
    recon.entries.some((e) => /freelanc/i.test(e.role || '')) &&
    recon.entries.some((e) => /nike/i.test(e.company || '')),
  'reconstruction keeps McCann, Freelance, Nike separate'
);

const normalized = normalizeCvData({ name: 'Test', experience: ACCEPTANCE_LINES });
ok(normalized.experience.length === 3, `normalizeCvData keeps three lines (${normalized.experience.length})`);
ok(
  !normalized.experience.some((line) => /mccann.*freelance.*nike/i.test(line)),
  'no collapsed mega-experience line'
);

const applied = applyExperienceReconstruction({ name: 'Test', experience: ACCEPTANCE_LINES });
ok(applied.experience.length === 3, `applyExperienceReconstruction keeps three (${applied.experience.length})`);

console.log('\nEXPERIENCE_SEGMENTATION QA PASS');
