#!/usr/bin/env node
/**
 * H11 — Semantic classifier V2 regression + stress audit.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  classifySemanticBlockV2,
  auditSemanticMisclassifications,
  isRejectedPersonNameLine,
  SEMANTIC_CLASS,
  SEMANTIC_V2_CONFIDENCE_MIN,
} from '../core/parsing/semantic-classifier-v2.js';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { resumeDataToCvData } from '../core/resume-data.js';
import { P7_CV_FIXTURES } from '../../tests/lib/p7-stress-catalog.mjs';
import { resolveFixtureText } from '../../tests/lib/stress-catalog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/semantic-v2/report.json');

const REGRESSION = [
  {
    id: 'expertise_not_name',
    line: 'Expertise Specialized',
    expect: (r) => r.semanticType !== SEMANTIC_CLASS.PERSON_NAME && isRejectedPersonNameLine('Expertise Specialized'),
  },
  {
    id: 'jb_not_summary',
    line: 'JB Impressions',
    expect: (r) => r.semanticType === SEMANTIC_CLASS.CLIENT || r.semanticType === SEMANTIC_CLASS.COMPANY || r.semanticType === SEMANTIC_CLASS.UNKNOWN,
  },
  {
    id: 'visual_comm_not_skill',
    line: 'visual communication',
    expect: (r) => r.semanticType !== SEMANTIC_CLASS.SKILL,
  },
  {
    id: 'market_reviews_not_school',
    line: 'Market Reviews',
    expect: (r) => r.semanticType !== SEMANTIC_CLASS.EDUCATION,
  },
  {
    id: 'mccann_company',
    line: 'McCann G. Agency (Internship)',
    expect: (r) =>
      r.semanticType === SEMANTIC_CLASS.EXPERIENCE ||
      r.semanticType === SEMANTIC_CLASS.CLIENT ||
      r.semanticType === SEMANTIC_CLASS.COMPANY,
  },
  {
    id: 'lisaa_education',
    line: '2011 2012 : LISAA, web and motion design',
    expect: (r) => r.semanticType === SEMANTIC_CLASS.EDUCATION && r.confidence >= SEMANTIC_V2_CONFIDENCE_MIN,
  },
  {
    id: 'parsons_education',
    line: 'Parsons School of Design — BFA',
    expect: (r) => r.semanticType === SEMANTIC_CLASS.EDUCATION,
  },
];

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function runRegression() {
  const rows = [];
  for (const case_ of REGRESSION) {
    const result = classifySemanticBlockV2(case_.line);
    const pass = case_.expect(result);
    rows.push({
      id: case_.id,
      line: case_.line,
      semanticType: result.semanticType,
      confidence: result.confidence,
      needsReview: result.needsReview,
      pass,
    });
    if (!pass) throw new Error(`Regression failed: ${case_.id} → ${result.semanticType} (${result.confidence})`);
  }
  return rows;
}

async function runStressSemanticAudit() {
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
    const audit = auditSemanticMisclassifications(cv);
    const pass = audit.pass;
    if (pass) passCount += 1;
    rows.push({
      id: fixture.id,
      pass,
      issues: audit.issues,
      name: cv?.name || '',
    });
  }
  return { rows, passCount, total: P7_CV_FIXTURES.length };
}

async function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const regression = await runRegression();
  const stress = await runStressSemanticAudit();
  const pass = stress.passCount === stress.total;
  const report = {
    engine: 'SEMANTIC_CLASSIFIER_V2',
    generatedAt: new Date().toISOString(),
    confidenceMin: SEMANTIC_V2_CONFIDENCE_MIN,
    regression,
    stress: {
      pass: stress.passCount,
      total: stress.total,
      rate: Math.round((stress.passCount / stress.total) * 100),
      rows: stress.rows,
    },
    pass,
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(`Semantic V2 QA: ${pass ? 'PASS' : 'FAIL'} (${stress.passCount}/${stress.total} stress CVs clean)`);
  if (!pass) {
    for (const r of stress.rows.filter((x) => !x.pass)) {
      console.log(`  FAIL ${r.id}:`, r.issues);
    }
    process.exit(1);
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
