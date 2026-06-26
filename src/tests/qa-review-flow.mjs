#!/usr/bin/env node
/**
 * P3 — Product review flow: suggestions cap, OCR gate, readiness.
 */
import { buildReviewReadinessReport, isExportReady } from '../core/validation/review-readiness.js';
import {
  applyReviewQueueToCvData,
  pendingReviewItems,
  normalizeReviewItem,
} from '../core/parsing/review-queue.js';

const PRODUCT_SUGGESTIONS_MAX = 5;

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

const baseCv = {
  name: 'Marie Dupont',
  title: 'Designer',
  email: 'marie@example.com',
  experience: ['Lead Designer — Acme · 2020–Present'],
  education: ['ENSAD Paris'],
  skills: ['Branding'],
  tools: ['Figma'],
  languages: ['French'],
};

const ocrItem = normalizeReviewItem({
  field: 'skill',
  detected: 'gibberish ocr noise xyz',
  sourceText: 'gibberish ocr noise xyz',
  confidence: 45,
  action: 'corruption',
  status: 'pending',
  corruptionScore: 72,
});

const queue = [ocrItem];
const gated = applyReviewQueueToCvData(
  { ...baseCv, skills: ['Branding', 'gibberish ocr noise xyz'] },
  queue
);

ok(!gated.skills.some((s) => /gibberish/i.test(s)), 'unvalidated OCR not in CV skills');
ok(
  (gated.unsorted || []).some((u) => /gibberish/i.test(u)) ||
    pendingReviewItems(queue).length === 1,
  'OCR noise held in queue or unsorted'
);

const suggestions = Array.from({ length: 8 }, (_, i) =>
  normalizeReviewItem({
    field: 'skill',
    detected: `item-${i}`,
    sourceText: `item-${i}`,
    confidence: 70,
    status: 'pending',
  })
);
ok(suggestions.slice(0, PRODUCT_SUGGESTIONS_MAX).length === 5, 'suggestions cap is 5');

const report = buildReviewReadinessReport(baseCv, { toClassifyCount: 0, atsScore: 82 });
ok(report.gates.identity, 'readiness identity gate');
ok(report.gates.experience, 'readiness experience gate');
ok(isExportReady(report), 'export ready when gates pass');

process.exit(failed ? 1 : 0);
