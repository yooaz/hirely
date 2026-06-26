#!/usr/bin/env node
/**
 * HIRELY P1 — Suggestion classification fix.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import { classifySpecialtyLineV2 } from '../core/parsing/classification-engine-v2.js';
import { classifySemanticBlockV2 } from '../core/parsing/semantic-classifier-v2.js';
import {
  isEmploymentCompanyLine,
  resolveSuggestionCategory,
  SUGGESTION_CLASSIFICATION_CONFIDENCE_MIN,
} from '../core/parsing/suggestion-classification-fix.js';
import { suggestPossibleCategories } from '../core/parsing/review-queue-categories.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/suggestion-classification-fix/report.json');

const EMPLOYMENT_LINES = [
  'Independent / Freelance',
  'Company à confirmer',
  'Freelance — Nike, Apple — 2012–2018',
];

const CASES = [
  { line: 'Independent / Freelance', expectPredicted: 'experience', expectCategory: 'experience' },
  { line: 'Company à confirmer', expectPredicted: 'experience', expectCategory: 'unknown', needsReview: true },
  { line: 'Marketing', notIdentity: true, expectPredicted: 'skill', expectCategory: 'skill' },
  { line: 'Marketing Coordinator', expectPredicted: null },
  { line: 'Visual communication', expectPredicted: 'skill', expectCategory: 'unknown', needsReview: true },
  { line: 'Créapole — Master Visual Communication', expectPredicted: 'education', expectCategory: 'education' },
  { line: 'Freelance — Nike, Apple — 2012–2018', expectPredicted: 'experience', expectCategory: 'experience' },
];

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

ok(SUGGESTION_CLASSIFICATION_CONFIDENCE_MIN === 80, 'confidence threshold 80');

for (const c of CASES) {
  const v2 = classifySpecialtyLineV2(c.line);
  const resolved = resolveSuggestionCategory(c.line, v2);
  const semantic = classifySemanticBlockV2(c.line, { lineIndex: 12 });

  if (EMPLOYMENT_LINES.includes(c.line)) {
    ok(resolved.category !== 'skill', `"${c.line}" not suggested as skill (got ${resolved.category})`);
    ok(resolved.predictedCategory !== 'skill', `"${c.line}" predicted not skill (got ${resolved.predictedCategory})`);
    ok(v2?.type !== 'skill', `"${c.line}" v2 not skill`);
  }

  if (c.expectCategory) {
    ok(resolved.category === c.expectCategory, `"${c.line}" category ${c.expectCategory} (got ${resolved.category})`);
  }

  if (c.notIdentity) {
    ok(resolved.category !== 'identity', `"${c.line}" not identity`);
    ok(resolved.predictedCategory !== 'identity', `"${c.line}" predicted not identity`);
    ok(semantic?.semanticType !== 'JOB_TITLE', `"${c.line}" semantic not JOB_TITLE`);
  }

  if (c.expectPredicted) {
    ok(
      resolved.predictedCategory === c.expectPredicted,
      `"${c.line}" predicted ${c.expectPredicted} (got ${resolved.predictedCategory})`
    );
  }

  if (c.needsReview) {
    ok(resolved.needsReview, `"${c.line}" needs review`);
    ok(resolved.category === 'unknown', `"${c.line}" surfaces as unknown / À valider`);
  }

  if (isEmploymentCompanyLine(c.line)) {
    const opts = suggestPossibleCategories(c.line);
    ok(!opts.some((o) => o.id === 'skill'), `"${c.line}" category picker excludes skill`);
  }
}

const report = {
  pass: failed === 0,
  threshold: SUGGESTION_CLASSIFICATION_CONFIDENCE_MIN,
  cases: CASES.map((c) => {
    const v2 = classifySpecialtyLineV2(c.line);
    const resolved = resolveSuggestionCategory(c.line, v2);
    return { line: c.line, v2: v2?.type, resolved };
  }),
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

process.exit(failed ? 1 : 0);
