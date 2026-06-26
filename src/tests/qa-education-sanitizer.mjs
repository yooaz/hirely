#!/usr/bin/env node
/**
 * P1 — EDUCATION_SANITIZER acceptance: no social/contact/clients in education.
 */
import {
  sanitizeEducationRows,
  educationRowForbiddenReason,
  educationRowHasSchoolOrDegree,
  EDUCATION_SANITIZER,
} from '../core/parsing/education-sanitizer.js';
import {
  applyEducationQuality,
  applyEducationQualityToCvData,
} from '../core/parsing/education-quality-engine.js';
import { normalizeCvData } from '../core/parsing/rich-parser.js';

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const identity = {
  name: 'Jane Doe',
  email: 'jane@example.com',
  phone: '+33 6 12 34 56 78',
};

ok(educationRowForbiddenReason('instagram.com/yoaz 2015') === 'instagram', 'instagram URL forbidden');
ok(educationRowForbiddenReason('Follow me on Instagram') === 'instagram', 'instagram word forbidden');
ok(educationRowForbiddenReason('linkedin.com/in/jane') === 'linkedin', 'linkedin forbidden');
ok(educationRowForbiddenReason('jane@example.com LISAA') === 'at_symbol', '@ symbol forbidden');
ok(educationRowForbiddenReason('http://school.edu degree') === 'http', 'http forbidden');
ok(educationRowForbiddenReason('www.school.edu program') === 'www', 'www forbidden');
ok(educationRowForbiddenReason('+33 6 12 34 56 78 LISAA') === 'phone', 'phone forbidden');
ok(educationRowForbiddenReason('Nike, Adidas, Puma campaigns') === 'clients', 'client list forbidden');

ok(educationRowHasSchoolOrDegree('LISAA — Bachelor Design — 2011–2012'), 'school row accepted');
ok(educationRowHasSchoolOrDegree('Master Visual Communication 2021'), 'degree row accepted');
ok(!educationRowHasSchoolOrDegree('coffee shop cashier 2015'), 'noise without school/degree rejected');

const polluted = [
  'LISAA — Web & Motion Design — 2011–2012',
  'instagram.com/yoaz portfolio 2015',
  'linkedin.com/in/yoaz ENSAD 2016',
  'yoaz@hotmail.fr Créapole 2011',
  'Nike, Adidas, Puma — 2018',
  'www.behance.net/gallery design 2019',
  'Créapole — Visual Communication — 2008–2011',
];

const sanitized = sanitizeEducationRows(polluted, { identity });
ok(sanitized.engine === EDUCATION_SANITIZER, 'sanitizer engine id');
ok(sanitized.education.length === 2, `keeps valid rows (${sanitized.education.length})`);
ok(sanitized.rejectedLines.length === 5, `rejects contaminated rows (${sanitized.rejectedLines.length})`);
ok(
  sanitized.rejectedLines.some((l) => /instagram/i.test(l)),
  'instagram row in rejectedLines'
);
ok(
  !sanitized.education.some((item) => /instagram|linkedin|@|http|www/i.test(String(item))),
  'accepted education has no forbidden tokens'
);

const quality = applyEducationQuality(polluted, { identity });
ok(quality.count === 2, `quality engine keeps two education entries (${quality.count})`);
ok(quality.rejectedLines.length >= 5, `quality rejectedLines populated (${quality.rejectedLines.length})`);
ok(
  !(quality.displays || []).some((line) => /instagram/i.test(line)),
  'Instagram never appears in education output'
);

const cv = applyEducationQualityToCvData({
  name: 'Jane Doe',
  education: polluted,
  experience: [],
  skills: [],
});
ok((cv.education || []).length === 2, `cvData education count (${(cv.education || []).length})`);
ok((cv.rejectedLines || []).length >= 5, `cvData rejectedLines (${(cv.rejectedLines || []).length})`);
ok(!JSON.stringify(cv.education).toLowerCase().includes('instagram'), 'cvData education has no instagram');

const normalized = normalizeCvData({
  name: 'Jane Doe',
  education: polluted,
});
ok((normalized.education || []).length === 2, `normalizeCvData education (${(normalized.education || []).length})`);
ok(
  !(normalized.education || []).some((line) => /instagram|linkedin|@|http|www/i.test(String(line))),
  'normalizeCvData strips forbidden education rows'
);

console.log('\nEDUCATION_SANITIZER QA PASS');
