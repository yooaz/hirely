#!/usr/bin/env node
/**
 * H19 — Trust score acceptance checks.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  TRUST_SCORE_WEIGHTS,
  TRUST_SCORE_CAPS,
  computeTrustScore,
  applyTrustScoreCaps,
  isCriticalReviewItem,
  countUnresolvedCriticalReview,
} from '../core/validation/trust-score.js';
import { computeProductScore } from '../core/validation/product-score.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/h19-trust-score');
fs.mkdirSync(outDir, { recursive: true });

const checks = [];

function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

function profile(overrides = {}) {
  return {
    name: 'Alex Martin',
    title: 'Senior Designer',
    email: 'alex@example.com',
    phone: '+33 6 00 00 00 00',
    experience: ['Lead Designer — Studio Nova · Paris · 2021–Present'],
    education: ['MA Design — ENSAD'],
    skills: ['Figma', 'Branding'],
    ...overrides,
  };
}

// Weights
check('extraction weight 40%', TRUST_SCORE_WEIGHTS.extraction === 0.4);
check('completeness weight 25%', TRUST_SCORE_WEIGHTS.completeness === 0.25);
check('recruiter quality weight 25%', TRUST_SCORE_WEIGHTS.recruiterQuality === 0.25);
check('formatting weight 10%', TRUST_SCORE_WEIGHTS.formatting === 0.1);
check(
  'weights sum to 100%',
  Math.abs(
    TRUST_SCORE_WEIGHTS.extraction +
      TRUST_SCORE_WEIGHTS.completeness +
      TRUST_SCORE_WEIGHTS.recruiterQuality +
      TRUST_SCORE_WEIGHTS.formatting -
      1
  ) < 0.001
);

// Pillars present
{
  const report = computeTrustScore(profile(), {
    importQualityScore: { extraction: 80, parser: 75, completeness: 82 },
  });
  check('trust score report returned', !!report);
  check('pillars include extraction', !!report?.trustScore?.pillars?.extraction);
  check('pillars include classification signal', report?.trustScore?.pillars?.extraction?.classificationQuality === 75);
  check('pillars include completeness', report?.trustScore?.pillars?.completeness?.score != null);
  check('pillars include recruiter quality', report?.trustScore?.pillars?.recruiterQuality?.score != null);
  check('pillars include formatting', report?.trustScore?.pillars?.formatting?.score != null);
}

// Hard caps
{
  const high = { total: 95, trustScore: { rawWeighted: 95 } };
  const wrongName = applyTrustScoreCaps(high, profile({ name: '' }));
  check('cap wrong name ≤ 30', wrongName.total <= TRUST_SCORE_CAPS.wrongName, `got ${wrongName.total}`);

  const noEmail = applyTrustScoreCaps(high, profile({ email: '' }));
  check('cap missing email ≤ 40', noEmail.total <= TRUST_SCORE_CAPS.missingEmail, `got ${noEmail.total}`);

  const noExp = applyTrustScoreCaps(high, profile({ experience: [] }));
  check('cap missing experience ≤ 50', noExp.total <= TRUST_SCORE_CAPS.missingExperience, `got ${noExp.total}`);

  const noEdu = applyTrustScoreCaps(high, profile({ education: [] }));
  check('cap missing education ≤ 60', noEdu.total <= TRUST_SCORE_CAPS.missingEducation, `got ${noEdu.total}`);
}

// Critical review cap
{
  const criticalQueue = [
    {
      id: 'r1',
      status: 'pending',
      field: 'identity.name',
      detected: 'Unknown',
      confidence: 40,
    },
  ];
  check('identity review item is critical', isCriticalReviewItem(criticalQueue[0]));
  check('critical review count', countUnresolvedCriticalReview(criticalQueue) === 1);

  const capped = computeProductScore(profile(), {
    reviewQueue: criticalQueue,
    importQualityScore: { extraction: 90, parser: 88, completeness: 90 },
  });
  check(
    'critical review caps score ≤ 70',
    capped.total <= TRUST_SCORE_CAPS.criticalReview,
    `got ${capped.total}`
  );
}

// Clean profile may score higher
{
  const clean = computeProductScore(profile(), {
    reviewQueue: [],
    importQualityScore: { extraction: 88, parser: 86, completeness: 85 },
  });
  check('clean CV can exceed 70', clean.total > 70, `got ${clean.total}`);
}

const pass = checks.every((c) => c.ok);
const report = {
  pass,
  verdict: pass ? 'PASS' : 'FAIL',
  weights: TRUST_SCORE_WEIGHTS,
  caps: TRUST_SCORE_CAPS,
  checks,
  auditedAt: new Date().toISOString(),
};

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(`\nH19 trust score: ${pass ? 'PASS' : 'FAIL'} (${checks.filter((c) => c.ok).length}/${checks.length})`);
process.exit(pass ? 0 : 1);
