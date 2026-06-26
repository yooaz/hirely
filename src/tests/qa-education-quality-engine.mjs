#!/usr/bin/env node
/**
 * P3 — Education Quality Engine QA.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeCvData } from '../core/parsing/rich-parser.js';
import {
  applyEducationQuality,
  buildQualityEducationEntry,
  educationHasContamination,
  validateEducationYears,
  EDUCATION_QUALITY_ENGINE,
} from '../core/parsing/education-quality-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../../tests/output/education-quality-engine');
const JSON_PATH = path.join(OUT_DIR, 'report.json');

const identity = {
  name: 'Yohann Azancot',
  email: 'yoaz@hotmail.fr',
  phone: '+33 6 49 43 48 39',
};

const results = [];

function check(id, label, pass, detail = '') {
  results.push({ id, label, pass, detail });
  console.log(pass ? 'OK' : 'FAIL', label, detail ? `— ${detail}` : '');
}

function run() {
  check(
    'reject-instagram',
    'Reject instagram social link',
    educationHasContamination('LISAA instagram.com/yoaz 2011-2012'),
    ''
  );
  check(
    'reject-linkedin',
    'Reject linkedin URL',
    educationHasContamination('behance.net/portfolio linkedin.com/in/test'),
    ''
  );
  check(
    'reject-http',
    'Reject http URL',
    educationHasContamination('http://school.edu degree 2015'),
    ''
  );
  check(
    'reject-email',
    'Reject email in education',
    educationHasContamination('yoaz@hotmail.fr LISAA 2011-2012'),
    ''
  );
  check(
    'reject-phone',
    'Reject phone in education',
    educationHasContamination('+33 6 49 43 48 39 LISAA 2011'),
    ''
  );
  check(
    'reject-ocr',
    'Reject OCR garbage',
    educationHasContamination('Créapole Ic) yoaz : Visual Communication'),
    ''
  );

  check(
    'year-order',
    'startYear must be <= endYear',
    !validateEducationYears(2014, 2012).ok,
    validateEducationYears(2014, 2012).reason
  );
  check(
    'year-future',
    'endYear must be <= currentYear + 1',
    !validateEducationYears(2028, 2032).ok,
    validateEducationYears(2028, 2032).reason
  );
  check(
    'year-duration',
    'duration must be <= 10 years',
    !validateEducationYears(1900, 1910).ok,
    validateEducationYears(1900, 1910).reason
  );
  check(
    'year-valid',
    'Valid year range accepted',
    validateEducationYears(2011, 2012).ok,
    ''
  );

  const lisaa = buildQualityEducationEntry(
    'yoaz@hotmail.fr LISAA Web and Motion Design +33 6 49 43 48 39 2011 2012',
    { identity }
  );
  check('lisaa-school', 'LISAA school extracted', lisaa?.school === 'LISAA', lisaa?.school);
  check('lisaa-degree', 'LISAA degree extracted', lisaa?.degree === 'Web & Motion Design', lisaa?.degree);
  check('lisaa-years', 'LISAA years extracted', lisaa?.startYear === '2011' && lisaa?.endYear === '2012', `${lisaa?.startYear}-${lisaa?.endYear}`);
  check('lisaa-clean', 'LISAA has no contact leaks in display', !/yoaz|hotmail|\+33/i.test(lisaa?.display || ''), lisaa?.display);

  const creapole = buildQualityEducationEntry('Créapole Ic) yoaz : Visual Communication 2008-2011', {
    identity,
  });
  check('creapole-valid', 'Créapole OCR line normalized cleanly', !!creapole?.school, creapole?.display);
  check(
    'creapole-structure',
    'Créapole has structured fields',
    creapole?.school === 'Créapole' && creapole?.degree === 'Visual Communication',
    JSON.stringify(creapole)
  );

  const rejected = buildQualityEducationEntry('Design School 2028-2032', { identity });
  check('reject-future-entry', 'Future dates rejected as entry', rejected === null, '');

  const polluted = applyEducationQuality(
    [
      'LISAA — Web & Motion Design — 2011–2012',
      'instagram.com/yoaz portfolio 2015',
      'linkedin.com/in/yoaz 2016',
      'Fine Arts 1900-1910',
      'Design Institute 2028-2032',
      'yoaz@hotmail.fr LISAA duplicate 2011 2012',
      'Créapole — Visual Communication — 2008–2011',
    ],
    { identity }
  );
  check(
    'no-corrupted-batch',
    'Batch rejects all corrupted education rows',
    polluted.count === 2,
    `count=${polluted.count} ${JSON.stringify(polluted.displays)}`
  );
  check(
    'batch-confidence',
    'Quality entries carry confidence',
    polluted.entries.every((e) => typeof e.confidence === 'number' && e.confidence >= 50),
    polluted.entries.map((e) => e.confidence).join(',')
  );

  const normalized = normalizeCvData({
    name: 'Jane Doe',
    title: 'Designer',
    education: [
      'LISAA — Web & Motion Design — 2011–2012',
      'behance.net/yoaz 2015',
      'Créapole — Visual Communication — 2008–2011',
      'Master 2030-2035',
    ],
    experience: [],
    skills: [],
  });
  check(
    'normalize-clean',
    'normalizeCvData keeps only clean education',
    (normalized.education || []).length === 2,
    JSON.stringify(normalized.education)
  );
  check(
    'normalize-meta',
    'normalizeCvData attaches quality metadata',
    normalized._educationQualityEngine === EDUCATION_QUALITY_ENGINE &&
      (normalized._educationQuality || []).length === 2,
    normalized._educationQualityEngine
  );
  check(
    'meta-shape',
    'Metadata uses school/degree/startYear/endYear shape',
    (normalized._educationQuality || []).every(
      (e) => e.school && e.startYear && 'degree' in e && 'endYear' in e
    ),
    JSON.stringify(normalized._educationQuality)
  );
}

run();

const passed = results.filter((r) => r.pass).length;
const pass = passed === results.length;

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  JSON_PATH,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      pass,
      passed,
      total: results.length,
      results,
    },
    null,
    2
  )
);

console.log(`\n${passed}/${results.length} checks — ${pass ? 'PASS' : 'FAIL'}`);
process.exit(pass ? 0 : 1);
