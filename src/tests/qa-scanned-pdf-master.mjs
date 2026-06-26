#!/usr/bin/env node
/**
 * P2 Scanned PDF Master — OCR_STRUCTURE_RECOVERY acceptance (experience recall > 85%).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { postProcessOcrText } from '../core/parsing/ocr-postprocess.js';
import {
  OCR_STRUCTURE_RECOVERY,
  OCR_EXPERIENCE_RECALL_GOAL,
  runOcrStructureRecovery,
  lineHasYearAnchor,
  isYearOnlyLine,
  groupOcrLines,
} from '../core/parsing/ocr-structure-recovery/index.js';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';
import { SCANNED_OCR_FIXTURE } from '../../tests/lib/extraction-release-criteria.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/scanned-pdf-master');

const YOAZ_OCR = path.join(ROOT, 'tests/fixtures/yoaz-pdf-live/ocr-fragmented.txt');
const SCANNED_FIXTURE = path.join(ROOT, 'tests/fixtures/scanned-pdf/fixture.txt');

const YOAZ_EXPECTED = [
  { company: /freelance/i, role: /illustrator|designer/i },
  { company: /mccann/i, role: /illustrator/i },
  { company: /publicis/i, role: /art director|illustrat/i },
  { company: /havas/i, role: /illustrator/i },
  { company: /independent|freelance/i, role: /art director/i },
  { company: /betc/i, role: /illustrator|designer/i },
  { company: /ddb/i, role: /designer/i },
  { company: /akqa/i, role: /designer|visual/i },
  { company: /yoaz|studio/i, role: /director|creative/i },
];

let failed = 0;
const checks = [];

function ok(cond, id, detail = '') {
  checks.push({ id, pass: !!cond, detail });
  if (!cond) {
    failed++;
    console.error('FAIL', id, detail);
  } else console.log('OK', id, detail || '');
}

function matchExpected(experiences, expected) {
  const blob = (experiences || [])
    .map((e) => `${e.role || ''} ${e.company || ''} ${e.dates || ''} ${e.title || ''}`.toLowerCase())
    .join(' ');
  let hits = 0;
  for (const exp of expected) {
    if (exp.company.test(blob) && exp.role.test(blob)) hits++;
  }
  return hits;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

ok(lineHasYearAnchor('2011 2014'), 'year_anchor_range');
ok(isYearOnlyLine('2011 2014'), 'year_only_line');
ok(isYearOnlyLine('2023 Present'), 'year_only_present');

const grouped = groupOcrLines(['McCann Paris', 'Lead Illustrator', '2011 2014'], {});
ok(grouped.some((g) => g.kind === 'experience-stack'), 'line_group_experience_stack');

const recovery = runOcrStructureRecovery('Experience\nAcme Corp\nEngineer\n2019 2022', {
  extractionMethod: 'pdf-ocr',
  force: true,
});
ok(recovery.applied && recovery.engine === OCR_STRUCTURE_RECOVERY, 'recovery_engine');
ok(recovery.stats.neverTrustOcrOrder === true, 'never_trust_ocr_order');
ok(/Experience/.test(recovery.text) && /Acme/.test(recovery.text), 'recovery_rebuilds_sections');

function runOcrFixture(label, raw, expectedList, minRecall) {
  const clean = postProcessOcrText(raw, { ocr: true });
  const struct = runOcrStructureRecovery(clean, { rawText: raw, extractionMethod: 'pdf-ocr' });
  ok(struct.applied, `${label}_recovery_applied`, String(struct.stats?.experienceGroups ?? 0));

  const engine = runSectionEngineV2(clean, { rawText: raw, extractionMethod: 'pdf-ocr' });
  ok(engine.ocrStructureRecovery === true, `${label}_section_engine_wired`);

  const exps = engine.structured?.experiences || [];
  if (expectedList?.length) {
    const hits = matchExpected(exps, expectedList);
    const recall = hits / expectedList.length;
    ok(recall >= minRecall, `${label}_experience_recall`, `${Math.round(recall * 100)}% (${hits}/${expectedList.length})`);
    return { hits, recall, count: exps.length };
  }

  ok(exps.length >= 1, `${label}_has_experience`, `count=${exps.length}`);
  return { hits: exps.length ? 1 : 0, recall: exps.length ? 1 : 0, count: exps.length };
}

let yoaz = { hits: 0, recall: 0, count: 0 };
if (fs.existsSync(YOAZ_OCR)) {
  yoaz = runOcrFixture('yoaz_ocr', fs.readFileSync(YOAZ_OCR, 'utf8'), YOAZ_EXPECTED, OCR_EXPERIENCE_RECALL_GOAL);
} else {
  ok(false, 'yoaz_fixture_missing');
}

const scanned = runOcrFixture(
  'scanned_fixture',
  fs.readFileSync(SCANNED_FIXTURE, 'utf8'),
  [{ company: /acme/i, role: /pm|product|manager/i }],
  OCR_EXPERIENCE_RECALL_GOAL
);

const release = runOcrFixture(
  'release_scanned',
  SCANNED_OCR_FIXTURE,
  [{ company: /independent|freelance/i, role: /illustrator/i }],
  OCR_EXPERIENCE_RECALL_GOAL
);

const overallRecall = Math.min(yoaz.recall || 0, scanned.recall, release.recall);
ok(overallRecall >= OCR_EXPERIENCE_RECALL_GOAL, 'overall_recall_goal', `${Math.round(overallRecall * 100)}%`);

const report = {
  feature: 'SCANNED_PDF_MASTER',
  engine: OCR_STRUCTURE_RECOVERY,
  generatedAt: new Date().toISOString(),
  recallGoal: OCR_EXPERIENCE_RECALL_GOAL,
  yoazOcr: yoaz,
  scannedFixture: scanned,
  releaseScanned: release,
  checks,
  pass: failed === 0,
};

fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
process.exit(failed ? 1 : 0);
