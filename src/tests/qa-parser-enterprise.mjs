#!/usr/bin/env node
/**
 * Parser enterprise pass — classification accuracy & confidence schema.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { parseCV } from '../core/parsing/cv-parser.js';
import {
  classifyLineWithConfidence,
  SANITY_CONFIDENCE_THRESHOLD,
  scoreExperience,
} from '../core/parsing/section-sanity.js';
import {
  buildEnterpriseParse,
  scoreEducationLine,
  scoreProjectLine,
  separateProjectsFromExperience,
  PARSER_ENTERPRISE_THRESHOLD,
  ENTERPRISE_PARSER_BUCKETS,
} from '../core/parsing/parser-enterprise.js';
import {
  generateParserAccuracyReport,
  printParserAccuracyReport,
} from '../core/parsing/parser-accuracy-report.js';
import { collectSectionsOrderAgnostic } from '../core/parsing/section-mapper.js';
import { enrichBlocksFromTop } from '../core/parsing/rich-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const labeled = JSON.parse(
  fs.readFileSync(path.join(root, 'tests/fixtures/parser-enterprise/labeled-lines.json'), 'utf8')
);

let wrong = 0;
for (const { line, bucket: expected } of labeled) {
  const { bucket, confidence } = classifyLineWithConfidence(line);
  let predicted = bucket;
  if (bucket === 'profile') predicted = 'summary';
  if (bucket === 'garbage' || bucket === 'empty' || bucket === 'header') predicted = 'unsorted';
  if (confidence < PARSER_ENTERPRISE_THRESHOLD && expected !== 'unsorted') {
    predicted = 'unsorted';
  }
  if (predicted !== expected) {
    wrong++;
    console.error(`  misclassified: "${line.slice(0, 50)}" → ${predicted} (expected ${expected}, conf ${confidence})`);
  }
}
const rate = (wrong / labeled.length) * 100;
ok(rate < 5, `wrong classification rate ${rate.toFixed(1)}% (${wrong}/${labeled.length}) < 5%`);
ok(PARSER_ENTERPRISE_THRESHOLD === 70 && SANITY_CONFIDENCE_THRESHOLD === 70, 'parser threshold is 70');

const yoaz = fs.readFileSync(path.join(root, 'tests/fixtures/yoaz-cv/fixture.txt'), 'utf8');
const cv = parseCV(yoaz);
ok(/hirely-parser-enterprise/.test(cv._enterprise?.engine || ''), 'parseCV attaches _enterprise');
ok((cv.experience || []).length >= 1, 'yoaz experience parsed');
ok((cv.education || []).length >= 2, 'yoaz education from dictionaries');
ok((cv.skills || []).length >= 3, 'yoaz skills');
const ent = cv._enterprise;
if (ent?.experiences?.[0]) {
  ok(ent.experiences[0].confidence >= 70, 'experience[0] confidence >= 70');
  ok(Array.isArray(ent.experiences[0].sourceLines), 'experience[0] has sourceLines');
  ok(ent.experiences[0].title, 'experience[0] has title');
}

const blocks = collectSectionsOrderAgnostic(yoaz, enrichBlocksFromTop);
const enterprise = buildEnterpriseParse(blocks, yoaz.split('\n'));
ok(enterprise.education.length >= 2, 'enterprise education items');
ok(!enterprise.experiences.some((e) => e.confidence < 70), 'no sub-threshold experiences in final set');

ok(scoreEducationLine('LISAA — Web & Motion Design') >= 70, 'LISAA scores as education');
ok(!scoreExperience('Music, Movies, Nature'), 'interests not scored as experience');
ok(scoreExperience('Freelance Illustrator / Graphic Designer')?.confidence >= 70, 'role line scores experience');
ok(scoreProjectLine('Muse album cover artwork') >= 70, 'portfolio line scores projects');
ok(!scoreExperience('Muse album cover artwork'), 'portfolio not scored as experience');

const mixed = separateProjectsFromExperience({
  experience: ['Freelance Illustrator 2019–2024', 'Muse album cover artwork'],
  projects: [],
});
ok(mixed.projects.includes('Muse album cover artwork'), 'project stripped from experience');
ok(!mixed.experience.some((l) => /Muse album/i.test(l)), 'experience has no project desc');

const fallbackCv = parseCV(
  [
    'Alex Martin',
    'Product Designer',
    'alex@example.com',
    '',
    'EXPERIENCE',
    'Studio Nova — led packaging and retail concepts for FMCG brands',
    '2019 – 2022',
    'Side collaboration with Atelier Rue: visual systems and art direction',
  ].join('\n')
);
ok(
  (fallbackCv.experience || []).length + (fallbackCv.unknownExperience || []).length >= 1,
  'unclassified career lines preserved (experience or unknownExperience)'
);
ok(
  (fallbackCv.unknownExperience || []).length >= 1 ||
    (fallbackCv._enterprise?.unknownExperience || []).length >= 1,
  'unknown experience block created when structure fails'
);

ok(ENTERPRISE_PARSER_BUCKETS.includes('needsReview'), 'needsReview bucket defined');
ok(enterprise.projects.length >= 0, 'enterprise projects array');
ok(
  enterprise.experiences.every(
    (e) => typeof e.confidence === 'number' && Array.isArray(e.sourceLines)
  ),
  'experiences have confidence + sourceLines'
);

const report = generateParserAccuracyReport(root);
printParserAccuracyReport(report);
ok(report.classification.accuracyPct >= 95, `accuracy ${report.classification.accuracyPct}% >= 95`);
ok(report.schema.ok, 'enterprise schema compliance');
ok(!report.integration?.projectLeakInExperience, 'no project descriptions in experience');

process.exit(failed ? 1 : 0);
