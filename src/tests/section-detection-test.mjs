#!/usr/bin/env node
/**
 * H4 section detection — alias matrix + confidence thresholds.
 */
import {
  scoreSectionHeader,
  detectSectionsWithConfidence,
  H4_SECTION_LABELS,
} from '../core/parsing/section-detection.js';
import { splitBySectionHeaders } from '../core/parsing/section-mapper.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const MIN_CONF = 85;

for (const [key, labels] of Object.entries(H4_SECTION_LABELS)) {
  for (const label of labels) {
    const scored = scoreSectionHeader(label);
    ok(scored?.key === key, `${label} → ${key}`);
    ok((scored?.confidence ?? 0) >= MIN_CONF, `${label} confidence ≥ ${MIN_CONF} (${scored?.confidence})`);
  }
}

ok(scoreSectionHeader('Software Engineer — Google — 2020') === null, 'reject experience content row');
ok(scoreSectionHeader('Technical Skills: Python, SQL')?.key === 'skills', 'inline technical skills');

const sample = [
  'Jane Doe',
  'Work Experience',
  'PM at Acme 2019–2022',
  'Academic Background',
  'MIT — B.S. CS — 2015',
  'Competencies',
  'Leadership, Strategy',
  'Languages',
  'English (native), French (fluent)',
  'Projects',
  'Open-source CLI tool',
  'Certifications',
  'AWS Solutions Architect',
  'Volunteer',
  'Code mentor at local nonprofit',
  'Interests',
  'Hiking, photography',
].join('\n');

const detected = detectSectionsWithConfidence(sample);
ok((detected.sections.experience || []).some((l) => /Acme/i.test(l)), 'experience body captured');
ok((detected.sections.education || []).some((l) => /MIT/i.test(l)), 'education body captured');
ok((detected.sections.skills || []).some((l) => /Leadership/i.test(l)), 'skills body captured');
ok((detected.sections.certifications || []).some((l) => /AWS/i.test(l)), 'certifications body captured');
ok((detected.sections.volunteer || []).some((l) => /mentor/i.test(l)), 'volunteer body captured');
ok(detected.sectionConfidence.experience >= MIN_CONF, 'experience header confidence');
ok(detected.sectionConfidence.education >= MIN_CONF, 'education header confidence');

const blocks = splitBySectionHeaders(sample);
ok(blocks.sectionConfidence?.skills >= MIN_CONF, 'splitBySectionHeaders attaches confidence');

process.exit(failed ? 1 : 0);
