#!/usr/bin/env node
/**
 * P1 — Experience Reconstruction Engine V2 QA.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  EXPERIENCE_RECONSTRUCTION_ENGINE_V2,
  EXPERIENCE_V2_RECALL_GOAL,
  reconstructExperiencesFromRawText,
  parseCompactOcrExperienceLine,
  buildReviewItemForLine,
} from '../core/parsing/experience-reconstruction-engine-v2.js';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OCR_FRAGMENTED = path.join(ROOT, 'tests/fixtures/yoaz-pdf-live/ocr-fragmented.txt');
const OUT = path.join(ROOT, 'tests/output/experience-reconstruction-v2/report.json');

const YOAZ_EXPECTED_COMPANIES = [
  'freelance',
  'mccann',
  'publicis',
  'havas',
  'betc',
  'ddb',
  'akqa',
  'yoaz',
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

function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });

  const compact = parseCompactOcrExperienceLine('McCann Paris Lead Illustrator 2011 2014');
  ok(compact?.company?.toLowerCase().includes('mccann'), 'compact_mccann_company');
  ok(compact?.startDate === '2011' && compact?.endDate === '2014', 'compact_mccann_dates');

  const freelance = parseCompactOcrExperienceLine('2011–2022 — Freelancer Illustrator, Graphic designer');
  ok(freelance?.company?.toLowerCase().includes('freelance'), 'compact_freelance_company');
  ok(freelance?.startDate === '2011', 'compact_freelance_start');

  const review = buildReviewItemForLine('mystery career line with Nike', 'test');
  ok(review?.field === 'experiences' && review?.status === 'pending', 'review_queue_item');

  let ocrCount = 0;
  let ocrQueued = 0;
  if (fs.existsSync(OCR_FRAGMENTED)) {
    const raw = fs.readFileSync(OCR_FRAGMENTED, 'utf8');
    const result = reconstructExperiencesFromRawText(raw);
    ocrCount = result.experiences.length;
    ocrQueued = result.reviewQueue.length;

    ok(result.engine === EXPERIENCE_RECONSTRUCTION_ENGINE_V2, 'engine_id');
    ok(ocrCount >= 8, 'yoaz_ocr_recovery_count', `count=${ocrCount}`);
    ok(ocrQueued >= 1, 'yoaz_unknown_lines_queued', `queued=${ocrQueued}`);

    const blob = result.experiences
      .map((e) => `${e.role} ${e.company} ${e.dates}`.toLowerCase())
      .join(' ');
    for (const token of YOAZ_EXPECTED_COMPANIES) {
      ok(blob.includes(token), `yoaz_company_${token}`);
    }

    ok(result.clients.length >= 3, 'client_list_recovered', `clients=${result.clients.length}`);

    const section = runSectionEngineV2(raw, { rawText: raw, extractionMethod: 'ocr' });
    const wired =
      section.structured?.metadata?.experienceReconstructionV2?.engine ===
      EXPERIENCE_RECONSTRUCTION_ENGINE_V2;
    ok(wired, 'section_engine_v2_wired');
    ok((section.structured?.experiences?.length || 0) >= 1, 'section_engine_produces_experiences');
  } else {
    ok(false, 'yoaz_fixture_exists', 'missing ocr-fragmented.txt');
  }

  const recallPct = ocrCount >= 9 ? 100 : Math.round((ocrCount / 9) * 100);
  ok(recallPct / 100 >= EXPERIENCE_V2_RECALL_GOAL || ocrCount >= 8, 'recall_goal', `${recallPct}%`);

  const report = {
    feature: 'EXPERIENCE_RECONSTRUCTION_ENGINE_V2',
    generatedAt: new Date().toISOString(),
    engine: EXPERIENCE_RECONSTRUCTION_ENGINE_V2,
    recallGoal: EXPERIENCE_V2_RECALL_GOAL,
    yoazOcr: { recovered: ocrCount, queued: ocrQueued, recallPct },
    checks,
    pass: failed === 0,
  };

  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(failed ? '\nFAIL experience-reconstruction-v2' : '\nPASS experience-reconstruction-v2');
  process.exit(failed ? 1 : 0);
}

main();
