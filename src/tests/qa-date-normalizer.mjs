#!/usr/bin/env node
/**
 * P1 — DATE_NORMALIZER acceptance: no future years beyond 2026.
 */
import {
  DATE_NORMALIZER,
  DATE_NORMALIZER_MAX_YEAR,
  normalizeYearRange,
  normalizeDateRangeInText,
  applyDateNormalizationToCvData,
  textHasFutureYearBeyondMax,
} from '../core/parsing/date-normalizer.js';
import { normalizeCvData } from '../core/parsing/rich-parser.js';

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

ok(DATE_NORMALIZER_MAX_YEAR === 2026, `max year is 2026 (${DATE_NORMALIZER_MAX_YEAR})`);

const futureEnd = normalizeYearRange('2008', '2032');
ok(futureEnd.endDate === 'Present', `future end becomes Present (${futureEnd.endDate})`);
ok(futureEnd.startDate === '2008', `start preserved (${futureEnd.startDate})`);
ok(futureEnd.dates === '2008–Present', `dates label (${futureEnd.dates})`);
ok(futureEnd.endWasFuture, 'endWasFuture flagged');
ok(futureEnd.needsReview, 'long duration flagged for review');
ok(futureEnd.reviewReason === 'duration_exceeded_20_years', `review reason (${futureEnd.reviewReason})`);

const valid = normalizeYearRange('2018', '2022');
ok(valid.endDate === '2022', `valid range end (${valid.endDate})`);
ok(!valid.needsReview, 'valid short range not flagged');

const present = normalizeYearRange('2020', 'Present');
ok(present.endDate === 'Present', 'Present end preserved');

const expLine = normalizeDateRangeInText('Designer — McCann — 2008–2032');
ok(!/2032/.test(expLine.line), 'experience line has no 2032');
ok(/2008–Present/i.test(expLine.line), `experience line normalized (${expLine.line})`);
ok(expLine.needsReview, 'experience long duration flagged');

const cv = applyDateNormalizationToCvData({
  name: 'Jane Doe',
  experience: ['Designer — McCann — 2008–2032', 'Freelance — 2014–2020'],
  education: ['Créapole — Visual Communication — 2008–2032'],
  skills: [],
});
ok(cv._dateNormalizer === DATE_NORMALIZER, 'cvData date normalizer marker');
ok(
  !textHasFutureYearBeyondMax(JSON.stringify({ experience: cv.experience, education: cv.education })),
  'cvData output has no year beyond 2026'
);
ok((cv._dateReview || []).length >= 1, `date review items (${(cv._dateReview || []).length})`);
ok(!cv.experience.some((line) => /2032/.test(line)), 'experience output has no 2032');
ok(!cv.education.some((line) => /2032/.test(line)), 'education output has no 2032');

const normalized = normalizeCvData({
  name: 'Jane Doe',
  experience: ['Senior Designer — Studio — 2008–2032'],
  education: ['LISAA — Web Design — 2008–2032'],
  skills: [],
});
ok(
  !textHasFutureYearBeyondMax(
    JSON.stringify({ experience: normalized.experience, education: normalized.education })
  ),
  'normalizeCvData output has no year beyond 2026'
);
ok(
  (normalized.experience || []).some((line) => /Present/i.test(line)),
  'normalizeCvData uses Present for future end'
);

console.log('\nDATE_NORMALIZER QA PASS');
