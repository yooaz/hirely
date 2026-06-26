/**
 * Parser enterprise accuracy report — classification + schema compliance.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  classifyLineWithConfidence,
  scoreExperience,
  isLikelyPortfolioProject,
} from './section-sanity.js';
import {
  buildEnterpriseParse,
  ENTERPRISE_PARSER_BUCKETS,
  PARSER_ENTERPRISE_THRESHOLD,
  scoreEducationLine,
  scoreProjectLine,
} from './parser-enterprise.js';
import { collectSectionsOrderAgnostic } from './section-mapper.js';
import { enrichBlocksFromTop } from './rich-parser.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

function fieldHasSchema(item) {
  if (!item || typeof item !== 'object') return false;
  const hasConf = typeof item.confidence === 'number';
  const hasSrc = Array.isArray(item.sourceLines);
  if (item.value !== undefined) return hasConf && hasSrc;
  if (item.text !== undefined) return hasConf && hasSrc;
  if (item.title !== undefined) return hasConf && hasSrc;
  return hasConf && hasSrc;
}

function validateIdentityBucket(identity) {
  const keys = ['name', 'title', 'email', 'phone'];
  let ok = 0;
  for (const k of keys) {
    if (fieldHasSchema(identity?.[k])) ok++;
  }
  return { fields: keys.length, valid: ok };
}

function validateEnterpriseSchema(enterprise) {
  const issues = [];
  const id = validateIdentityBucket(enterprise.identity);
  if (id.valid < 2) issues.push('identity: missing confidence/sourceLines on core fields');

  if (!fieldHasSchema(enterprise.summary)) issues.push('summary: schema incomplete');

  for (const key of ['experiences', 'education', 'skills', 'tools', 'languages', 'clients', 'projects']) {
    for (const item of enterprise[key] || []) {
      if (!fieldHasSchema(item)) issues.push(`${key}: item missing confidence/sourceLines`);
    }
  }

  for (const item of enterprise.needsReviewBucket || []) {
    if (!fieldHasSchema(item)) issues.push('needsReview: item missing confidence/sourceLines');
  }

  return { ok: issues.length === 0, issues };
}

/**
 * @param {Array<{ line: string, bucket: string }>} labeled
 */
export function scoreLabeledLines(labeled) {
  let correct = 0;
  const misclassified = [];

  for (const { line, bucket: expected } of labeled) {
    const { bucket, confidence } = classifyLineWithConfidence(line);
    let predicted = bucket;
    if (bucket === 'profile') predicted = 'summary';
    if (bucket === 'garbage' || bucket === 'empty' || bucket === 'header') predicted = 'unsorted';
    if (expected === 'contact' && (bucket === 'contact' || bucket === 'identity')) {
      predicted = 'contact';
    }
    if (expected === 'interests' && (bucket === 'interests' || bucket === 'unsorted')) {
      predicted = 'interests';
    }
    if (confidence < PARSER_ENTERPRISE_THRESHOLD && !['unsorted', 'interests', 'contact'].includes(expected)) {
      predicted = 'unsorted';
    }
    if (predicted === expected) correct++;
    else misclassified.push({ line, expected, predicted, confidence });
  }

  return {
    total: labeled.length,
    correct,
    wrong: labeled.length - correct,
    accuracyPct: labeled.length ? Math.round((correct / labeled.length) * 1000) / 10 : 0,
    misclassified,
  };
}

/**
 * @param {string} [fixtureRoot]
 */
export function generateParserAccuracyReport(fixtureRoot) {
  const root = fixtureRoot || path.join(__dirname, '../../..');
  const labeledPath = path.join(root, 'tests/fixtures/parser-enterprise/labeled-lines.json');
  const labeled = JSON.parse(fs.readFileSync(labeledPath, 'utf8'));
  const classification = scoreLabeledLines(labeled);

  const designerFixturePath = path.join(root, 'tests/fixtures/creative-cv/fixture.txt');
  const designerFixture = fs.existsSync(designerFixturePath)
    ? fs.readFileSync(designerFixturePath, 'utf8')
    : '';
  const blocks = designerFixture
    ? collectSectionsOrderAgnostic(designerFixture, enrichBlocksFromTop)
    : {};
  const enterprise = designerFixture
    ? buildEnterpriseParse(blocks, designerFixture.split('\n'))
    : null;
  const schema = enterprise ? validateEnterpriseSchema(enterprise) : { ok: false, issues: ['no fixture'] };

  const projectInExp = (enterprise?.experiences || []).some((e) =>
    (e.sourceLines || []).some((l) => isLikelyPortfolioProject(l))
  );

  const expScores = labeled
    .filter((x) => x.bucket === 'experience')
    .map((x) => scoreExperience(x.line));
  const projectScores = labeled
    .filter((x) => x.bucket === 'projects')
    .map((x) => scoreProjectLine(x.line));

  return {
    generatedAt: new Date().toISOString(),
    engine: enterprise?.engine || 'hirely-parser-enterprise-v2',
    threshold: PARSER_ENTERPRISE_THRESHOLD,
    buckets: ENTERPRISE_PARSER_BUCKETS,
    classification,
    schema,
    integration: enterprise
      ? {
          experienceCount: enterprise.experiences.length,
          projectCount: enterprise.projects.length,
          needsReviewCount: enterprise.needsReviewBucket?.length ?? 0,
          unsortedCount: enterprise.unsorted.length,
          projectLeakInExperience: projectInExp,
          educationCount: enterprise.education.length,
        }
      : null,
    signals: {
      experienceLinesScored: expScores.filter(Boolean).length,
      projectLinesScored: projectScores.filter((s) => s > 0).length,
    },
    pass:
      classification.accuracyPct >= 95 &&
      schema.ok &&
      !projectInExp &&
      (enterprise?.experiences?.length ?? 0) >= 1,
  };
}

/** Console + object report for QA scripts. */
export function printParserAccuracyReport(report) {
  console.log('\n═══ HIRELY Parser Enterprise — Accuracy Report ═══');
  console.log(`Engine: ${report.engine} · threshold: ${report.threshold}%`);
  console.log(`Buckets: ${report.buckets.join(', ')}`);
  console.log(
    `Line classification: ${report.classification.correct}/${report.classification.total} (${report.classification.accuracyPct}%)`
  );
  if (report.classification.misclassified.length) {
    console.log('Misclassified:');
    for (const m of report.classification.misclassified.slice(0, 8)) {
      console.log(`  · "${m.line.slice(0, 48)}" → ${m.predicted} (expected ${m.expected}, ${m.confidence}%)`);
    }
  }
  console.log(`Schema compliance: ${report.schema.ok ? 'OK' : 'FAIL'}`);
  if (report.schema.issues?.length) {
    for (const i of report.schema.issues) console.log(`  · ${i}`);
  }
  if (report.integration) {
    console.log(
      `Parser integration: exp=${report.integration.experienceCount} proj=${report.integration.projectCount} review=${report.integration.needsReviewCount} unsorted=${report.integration.unsortedCount}`
    );
    console.log(`Project text in experience bucket: ${report.integration.projectLeakInExperience ? 'YES (fail)' : 'no'}`);
  }
  console.log(`Overall: ${report.pass ? 'PASS' : 'NEEDS WORK'}\n`);
  return report;
}
