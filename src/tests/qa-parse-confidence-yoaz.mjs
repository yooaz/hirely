#!/usr/bin/env node
/**
 * Parse confidence + review hints — Yohann CV fixture.
 * node src/tests/qa-parse-confidence-yoaz.mjs
 */

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { classifyDocumentPages } from '../core/layout/page-document-classifier.js';
import { classifyDocumentPageLayouts } from '../core/layout/page-layout.js';
import { buildLayoutMemory } from '../core/layout/layout-memory.js';
import { spatialBlocksFromLayoutMemory } from '../core/layout/spatial-block.js';
import { detectSectionBlocks } from '../core/parsing/section-detect-v2.js';
import {
  scoreCvParseBundle,
  applyValidationConfidenceAdjustments,
  extractContactFromParseContext,
  LOW_CONFIDENCE_THRESHOLDS,
  CV_PARSE_CONFIDENCE,
} from '../core/parsing/cv-parse-confidence.js';
import {
  validateCvParseBundle,
  CV_PARSE_VALIDATION,
} from '../core/parsing/cv-parse-validation.js';
import {
  generateCvReviewHints,
  buildCvParseResponsePayload,
  CV_REVIEW_HINTS,
} from '../core/parsing/cv-review-hints.js';
import { CV_SECTION } from '../core/parsing/section-heading-dictionary.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'tests/output/parse-confidence-yoaz');
mkdirSync(outDir, { recursive: true });

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

function loadLines(rel) {
  const raw = JSON.parse(readFileSync(join(root, rel), 'utf8'));
  return raw.lines.map((l, i) => ({
    ...l,
    cleanedText: l.text,
    rawExtraction: l.text,
    confidence: 90,
    source: 'native',
    line: i,
  }));
}

const page1Lines = loadLines('tests/fixtures/yoaz-pdf-benchmark/page1-lines.json').filter(
  (l) => (l.page || 1) === 1
);
const page2Lines = loadLines('tests/fixtures/yoaz-pdf-benchmark/page2-lines.json');
const allLines = [...page1Lines, ...page2Lines];

const memory = buildLayoutMemory(allLines, { source: 'pdf_native' });
const spatialBlocks = spatialBlocksFromLayoutMemory(memory);
const pageLayouts = classifyDocumentPageLayouts(allLines);
const classification = classifyDocumentPages(allLines, { pageLayouts });

const detected = detectSectionBlocks(
  allLines.map((l) => l.text).join('\n'),
  {
    layoutMemory: memory,
    spatialBlocks,
    extractionLines: allLines,
    pageDocumentClassification: classification,
    pageLayouts,
  }
);

const conf = detected.parseConfidence;
const validation = detected.parseValidation;
const hints = detected.reviewHints;
const response = detected.parseResponse;

writeFileSync(join(outDir, 'sample-parse-response.json'), JSON.stringify(response, null, 2));
writeFileSync(
  join(outDir, 'yoaz-confidence-report.json'),
  JSON.stringify({ confidence: conf, validation, reviewHints: hints }, null, 2)
);
writeFileSync(
  join(outDir, 'yoaz-validation-report.json'),
  JSON.stringify(validation, null, 2)
);

ok(conf?.version === CV_PARSE_CONFIDENCE, `confidence version ${conf?.version}`);
ok(validation?.version === CV_PARSE_VALIDATION, `validation version ${validation?.version}`);
ok(hints?.version === CV_REVIEW_HINTS, `hints version ${hints?.version}`);
ok(response?.schema === 'hirely.parse_response.v1', 'parse response schema');

// Contact — high confidence
ok(conf.sections.contact >= 0.85, `contact section high (>=0.85, got ${conf.sections.contact})`);
ok(conf.fields['contact.email'] >= 0.9, `contact.email high (${conf.fields['contact.email']})`);
ok(
  conf.contact?.email === 'yoaz@hotmail.fr',
  `contact email extracted (${conf.contact?.email})`
);
ok(!hints.hints.some((h) => h.type === 'low_confidence_contact'), 'no low_confidence_contact hint on clean fixture');

// Page classification — strong
ok(
  conf.sections.page_classification >= 0.85,
  `page_classification high (>=0.85, got ${conf.sections.page_classification})`
);
ok(
  conf.traces.page_classification_confidence >= 0.85,
  `trace page_classification_confidence (${conf.traces.page_classification_confidence})`
);

// Experience — medium/high
ok(conf.sections.experience >= 0.7, `experience section >= 0.7 (${conf.sections.experience})`);
ok(conf.items.experience.length >= 1, `experience items >= 1 (${conf.items.experience.length})`);
ok(
  conf.items.experience.every((e) => e.confidence >= 0.7),
  'each experience item >= 0.7'
);
ok(
  !hints.hints.some((h) => h.type === 'missing_dates' && h.target_ids?.some((id) => id.startsWith('experience'))),
  'no missing_dates on yoaz experiences'
);

// Education — strong on clean Yoaz fixture
ok(conf.sections.education >= 0.8, `education section strong (>=0.8, got ${conf.sections.education})`);
ok(conf.items.education.length >= 3, `education items >= 3 (${conf.items.education.length})`);

// Page 2 portfolio excluded with trace
ok(conf.traces.portfolio_pages.includes(2), 'trace portfolio_pages includes 2');
ok(conf.traces.excluded_pages.includes(2), 'trace excluded_pages includes 2');

const portfolioHint = hints.hints.find((h) => h.type === 'portfolio_page_excluded' && h.trace?.page === 2);
ok(!!portfolioHint, 'portfolio_page_excluded hint for page 2');
ok(
  /portfolio.*excluded/i.test(portfolioHint?.message || ''),
  `portfolio hint message (“${portfolioHint?.message}”)`
);

// Validation — no page 2 leakage, no polluted skills
ok(validation?.valid === true, `validation valid (${validation?.valid})`);
ok(validation?.stats.page_leakage === 0, `no page leakage (got ${validation?.stats.page_leakage})`);
ok(validation?.stats.polluted_skills === 0, `no polluted skills (got ${validation?.stats.polluted_skills})`);
ok(
  !validation.issues.some((i) => i.code === 'page_leakage_suspected'),
  'no page_leakage_suspected issues'
);
ok(
  !validation.issues.some((i) => i.code === 'polluted_skill'),
  'no polluted_skill issues'
);

const skillNames = (detected.skillItems || []).map((s) => s.name.toLowerCase());
ok(!skillNames.some((n) => /playstation|sunglass|nike|god of war/i.test(n)), 'skills free of page 2/portfolio pollution');

ok(conf.global >= 0.75, `global confidence strong (${conf.global})`);
ok(response.quality_gate.needs_review === hints.needs_review, 'quality_gate aligned');
ok(response.validation?.valid === true, 'parseResponse validation.valid');
ok(response.quality_gate.production_ready === validation.production_ready, 'production_ready aligned');

// --- synthetic low-confidence cases ---
const synthExperience = applyValidationConfidenceAdjustments(
  scoreCvParseBundle({
    experienceItems: [
      {
        job_title: 'Designer',
        company: '',
        start_date: '',
        end_date: '',
        confidence: 0.4,
        source_block_ids: ['blk-1'],
      },
    ],
    resumeSegments: [],
  }),
  validateCvParseBundle(
    {
      experienceItems: [
        {
          job_title: 'Designer',
          company: '',
          start_date: '',
          end_date: '',
          confidence: 0.4,
          source_block_ids: ['blk-1'],
        },
      ],
      resumeSegments: [],
    },
    scoreCvParseBundle({
      experienceItems: [
        {
          job_title: 'Designer',
          company: '',
          start_date: '',
          end_date: '',
          confidence: 0.4,
          source_block_ids: ['blk-1'],
        },
      ],
    })
  )
);

const synthValidation = validateCvParseBundle(
  {
    experienceItems: [{ job_title: 'Designer', company: '', start_date: '', end_date: '' }],
    resumeSegments: [{ section: CV_SECTION.OTHER, text: 'Unlabeled paragraph of content here', block_id: 'blk-u1' }],
    pageDocumentClassification: { portfolio_pages: [2], pages: [{ page: 2, page_class: 'portfolio_page', confidence: 0.96 }] },
    portfolio_items: [{ page_number: 2, title: 'Sample project' }],
    skillItems: [{ name: 'Nike', source_block_ids: ['sk-1'] }],
  },
  synthExperience
);

const synthHints = generateCvReviewHints(
  {
    experienceItems: [{ job_title: 'Designer', company: '', start_date: '', end_date: '' }],
    resumeSegments: [{ section: CV_SECTION.OTHER, text: 'Unlabeled paragraph of content here', block_id: 'blk-u1' }],
    pageDocumentClassification: { portfolio_pages: [2], pages: [{ page: 2, page_class: 'portfolio_page', confidence: 0.96 }] },
    portfolio_items: [{ page_number: 2, title: 'Sample project' }],
    skillItems: [{ name: 'Nike', source_block_ids: ['sk-1'] }],
  },
  synthExperience,
  synthValidation
);

ok(
  synthHints.hints.some((h) => h.type === 'missing_dates' || h.type === 'invalid_dates'),
  'synthetic date validation hint'
);
ok(
  synthHints.hints.some((h) => h.type === 'unclassified_block'),
  'synthetic unclassified_block hint'
);
ok(
  synthHints.hints.some((h) => h.type === 'polluted_skill'),
  'synthetic polluted_skill hint'
);

const ambiguousEduHints = generateCvReviewHints(
  {
    educationItems: [
      { school: 'LISAA', degree: 'Design', start_date: '2008', end_date: '2009' },
      { school: 'Creapole', degree: 'Design', start_date: '2008', end_date: '2009' },
    ],
  },
  scoreCvParseBundle({
    educationItems: [
      { school: 'LISAA', degree: 'Design', start_date: '2008', end_date: '2009', confidence: 0.6 },
      { school: 'Creapole', degree: 'Design', start_date: '2008', end_date: '2009', confidence: 0.6 },
    ],
  }),
  validateCvParseBundle(
    {
      educationItems: [
        { school: 'LISAA', degree: 'Design', start_date: '2008', end_date: '2009', confidence: 0.6 },
        { school: 'Creapole', degree: 'Design', start_date: '2008', end_date: '2009', confidence: 0.6 },
      ],
    },
    scoreCvParseBundle({
      educationItems: [
        { school: 'LISAA', degree: 'Design', start_date: '2008', end_date: '2009', confidence: 0.6 },
        { school: 'Creapole', degree: 'Design', start_date: '2008', end_date: '2009', confidence: 0.6 },
      ],
    })
  )
);
ok(
  ambiguousEduHints.hints.some(
    (h) => h.type === 'ambiguous_school' || h.type === 'duplicate_education_entry'
  ),
  'ambiguous or duplicate education hint'
);

const contactOnly = extractContactFromParseContext({
  resumeSegments: [],
  extractionLines: page1Lines,
});
ok(contactOnly.email === 'yoaz@hotmail.fr', 'extractContactFromParseContext email');
ok(contactOnly.phone?.includes('336494344839'), `extractContactFromParseContext phone (${contactOnly.phone})`);

const payload = buildCvParseResponsePayload({
  contact: contactOnly,
  experienceItems: detected.experienceItems,
  parseConfidence: conf,
  parseValidation: validation,
  reviewHints: hints,
});
ok(payload.confidence?.global === conf.global, 'buildCvParseResponsePayload preserves global');
ok(payload.validation?.issues?.length >= 0, 'buildCvParseResponsePayload includes validation');

console.log('\n--- confidence sections ---');
console.log(conf.sections);
console.log('\n--- review hints ---');
console.log(hints.hints.map((h) => ({ type: h.type, message: h.message, severity: h.severity })));
console.log(`\nSample: ${join(outDir, 'sample-parse-response.json')}`);
console.log(failed ? `\n${failed} FAILED` : '\nAll parse confidence checks passed');
process.exit(failed ? 1 : 0);
