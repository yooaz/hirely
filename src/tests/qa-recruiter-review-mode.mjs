#!/usr/bin/env node
/**
 * HIRELY H12 — Recruiter review mode QA.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  classifySemanticBlockV2,
  SEMANTIC_CLASS,
} from '../core/parsing/semantic-classifier-v2.js';
import { extractFactsFromLine } from '../core/parsing/fact-extraction.js';
import { buildCvFromFacts, partitionFactsByConfidence } from '../core/parsing/cv-from-facts.js';
import {
  applyReviewQueueToCvData,
  resolveReviewItem,
} from '../core/parsing/review-queue.js';
import {
  buildRecruiterReviewItem,
  auditLowConfidenceNotInCv,
  factsToRecruiterReviewItems,
  semanticClassToFactType,
} from '../core/parsing/recruiter-review-mode.js';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { resumeDataToCvData } from '../core/resume-data.js';
import { P7_CV_FIXTURES } from '../../tests/lib/p7-stress-catalog.mjs';
import { resolveFixtureText } from '../../tests/lib/stress-catalog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/recruiter-review-mode/report.json');

const VISUAL_COMM = 'visual communication';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function runVisualCommunicationRegression() {
  const sem = classifySemanticBlockV2(VISUAL_COMM);
  assert(sem.needsReview, 'visual communication must need review');
  assert(sem.semanticType === SEMANTIC_CLASS.UNKNOWN, 'must not auto-place semantic type');
  assert((sem.alternatives?.length ?? 0) >= 2, 'must expose multiple hypotheses');

  const skillAlt = sem.alternatives.find((a) => a.type === SEMANTIC_CLASS.SKILL);
  const eduAlt = sem.alternatives.find((a) => a.type === SEMANTIC_CLASS.EDUCATION);
  assert(skillAlt?.confidence === 55, `skill alt expected 55 got ${skillAlt?.confidence}`);
  assert(eduAlt?.confidence === 42, `education alt expected 42 got ${eduAlt?.confidence}`);

  const facts = extractFactsFromLine(VISUAL_COMM);
  assert(facts.length >= 1, 'fact extracted');
  const fact = facts[0];
  assert(fact.type === 'unknown', 'fact must be unknown pending review');
  assert((fact.confidence ?? 1) < 0.8, 'fact confidence below threshold');

  const { pending } = partitionFactsByConfidence(facts);
  assert(pending.length === 1, 'fact must be pending');

  const reviewItems = factsToRecruiterReviewItems(pending);
  assert(reviewItems.length === 1, 'review item created');
  const item = reviewItems[0];
  assert(item.requiresUserChoice, 'requires user choice');
  assert((item.possibleCategories?.length ?? 0) >= 2, 'possible categories on card');

  const cv = buildCvFromFacts(facts).structured;
  const skills = [...(cv.skills || []), ...(cv.tools || [])];
  const education = cv.education || [];
  assert(!skills.some((s) => /visual\s+communication/i.test(s)), 'not auto-placed in skills');
  assert(!education.some((e) => /visual\s+communication/i.test(e)), 'not auto-placed in education');

  const gated = applyReviewQueueToCvData(
    { ...resumeDataToCvData(cv), skills: ['visual communication'], education: ['visual communication'] },
    reviewItems
  );
  const audit = auditLowConfidenceNotInCv(gated, reviewItems);
  assert(audit.pass, `pending must not corrupt CV: ${JSON.stringify(audit.issues)}`);

  const accepted = resolveReviewItem(reviewItems, 0, 'accepted', gated, {
    chosenType: 'skill',
  });
  assert(
    (accepted.cvData?.skills || []).some((s) => /visual\s+communication/i.test(s)),
    'accepted skill lands in skills'
  );

  return {
    id: 'visual_communication',
    line: VISUAL_COMM,
    alternatives: sem.alternatives,
    reviewItem: {
      requiresUserChoice: item.requiresUserChoice,
      possibleCategories: item.possibleCategories,
    },
    pass: true,
  };
}

async function runStressNoAutoCorruption() {
  const rows = [];
  let passCount = 0;
  for (const fixture of P7_CV_FIXTURES) {
    const { rawText } = resolveFixtureText(ROOT, fixture);
    const importResult = await runHirelyImportFromText(rawText, {
      source: fixture.id,
      extractionMethod: fixture.extractionMethod || 'paste',
      trusted: true,
    });
    const cv = resumeDataToCvData(importResult?.resumeData || importResult?.cvData || {});
    const queue = importResult?.reviewQueue || cv?.reviewQueue || [];
    const gated = applyReviewQueueToCvData(cv, queue);
    const audit = auditLowConfidenceNotInCv(gated, queue);
    if (audit.pass) passCount += 1;
    rows.push({ id: fixture.id, pass: audit.pass, pending: audit.pendingCount, issues: audit.issues });
  }
  return { rows, passCount, total: P7_CV_FIXTURES.length };
}

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const regression = runVisualCommunicationRegression();
  const stress = await runStressNoAutoCorruption();

  const card = buildRecruiterReviewItem({
    line: VISUAL_COMM,
    classification: classifySemanticBlockV2(VISUAL_COMM),
  });
  assert(card?.requiresUserChoice, 'recruiter card requires user choice');
  assert(semanticClassToFactType(SEMANTIC_CLASS.SKILL) === 'skill', 'semantic map');

  const pass = stress.passCount === stress.total;
  const report = {
    engine: 'RECRUITER_REVIEW_MODE_V1',
    generatedAt: new Date().toISOString(),
    regression,
    stress: {
      pass: stress.passCount,
      total: stress.total,
      rate: `${Math.round((stress.passCount / stress.total) * 100)}%`,
      rows: stress.rows,
    },
    actions: ['accept', 'move', 'edit', 'ignore'],
    pass,
  };

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(pass ? 'PASS recruiter-review-mode' : 'FAIL recruiter-review-mode');
  console.log(JSON.stringify(report, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error('FAIL', err.message);
  process.exit(1);
});
