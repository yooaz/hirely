#!/usr/bin/env node
/**
 * mergeFragmentedExperienceBlocks — unit + recall samples.
 */
import { mergeFragmentedExperienceBlocks } from '../core/parsing/experience-block-merge.js';
import { parseStrictExperiencesFromLines } from '../core/parsing/experience-parser.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

function block(id, type, text) {
  return {
    id,
    type,
    bucket: type,
    text,
    confidence: 85,
    accepted: true,
    needsReview: false,
  };
}

const mccannBlocks = [
  block('b1', 'unknown', 'Designer'),
  block('b2', 'unknown', 'McCann G Agency'),
  block('b3', 'unknown', '2011-2014'),
];
const mccann = mergeFragmentedExperienceBlocks(mccannBlocks);
ok(mccann.mergedCount >= 1, 'McCann fragmented blocks merge to ≥1 experience');
ok(
  mccann.experiences.some((e) => /mccann/i.test(e.company || '')),
  'McCann company preserved'
);

const freelanceBlocks = [
  block('f1', 'experience', 'Freelance Illustrator'),
  block('f2', 'identity', 'Graphic Designer'),
  block('f3', 'unknown', 'Independent'),
  block('f4', 'unknown', '2011-2022'),
];
const freelance = mergeFragmentedExperienceBlocks(freelanceBlocks);
ok(freelance.mergedCount >= 1, 'Freelance fragmented blocks merge to ≥1 experience');
ok(
  freelance.experiences.some(
    (e) => /freelance|illustrator/i.test(e.role || '') && /independent|freelance/i.test(e.company || '')
  ),
  'Freelance role + independent company preserved'
);

const lines = mccann.experiences.map((e) =>
  [e.role, e.company, e.dates].filter(Boolean).join(' — ')
);
const strict = parseStrictExperiencesFromLines(lines);
ok(strict.experiences.length >= 1, 'merged entries pass strict parser');

process.exit(failed ? 1 : 0);
