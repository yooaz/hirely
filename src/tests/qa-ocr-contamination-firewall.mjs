#!/usr/bin/env node
/**
 * P1 — OCR contamination firewall (normalization-only).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { normalizeCvData } from '../core/parsing/rich-parser.js';
import {
  applyOcrContaminationFirewall,
  isSectionAnchorField,
  rejectEducationContamination,
  sanitizeClientsFirewall,
  splitExperienceContamination,
} from '../core/parsing/ocr-contamination-firewall.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT_DIR = path.join(__dirname, '../../tests/output/ocr-contamination-firewall');
const JSON_PATH = path.join(OUT_DIR, 'report.json');

const results = [];

function check(id, label, pass, detail = '') {
  results.push({ id, label, pass, detail });
  console.log(pass ? 'OK' : 'FAIL', label, detail ? `— ${detail}` : '');
}

function headerBlob(d) {
  return [d.name, d.title, d.email, d.phone].filter(Boolean).join(' | ');
}

function educationBlob(d) {
  return (d.education || []).join(' | ');
}

function hasFutureOrAncientYears(d) {
  const max = new Date().getFullYear() + 1;
  const years = [...educationBlob(d).matchAll(/\b((?:19|20)\d{2})\b/g)].map((m) => parseInt(m[1], 10));
  return years.some((y) => y < 1950 || y > max);
}

function hasEducationUrls(d) {
  return /https?:\/\/|www\.|instagram|linkedin|behance/i.test(educationBlob(d));
}

function headerHasSectionAnchors(d) {
  return /^(education|formation|experience|skills|tools|languages|clients)$/i.test(d.title || '');
}

function run() {
  check(
    'anchor-detect',
    'Section anchor detector flags EDUCATION',
    isSectionAnchorField('EDUCATION'),
    'isSectionAnchorField'
  );

  check(
    'edu-url-reject',
    'Education rejects social URLs',
    rejectEducationContamination('LISAA instagram.com/yoaz 2011-2012') === '',
    'instagram stripped'
  );

  check(
    'edu-future-reject',
    'Education rejects future year 2032',
    rejectEducationContamination('Design School 2028-2032') === '',
    '2032 blocked'
  );

  check(
    'edu-ancient-reject',
    'Education rejects ancient span 1900',
    rejectEducationContamination('Fine Arts 1900-1910') === '',
    '1900 blocked'
  );

  check(
    'clients-strict',
    'Clients only from recognized list tokens',
    sanitizeClientsFirewall(['Nike, Adidas', 'Random Agency XYZ']).join(',') === 'Nike,Adidas',
    sanitizeClientsFirewall(['Nike, Adidas', 'Random Agency XYZ']).join(',')
  );

  const split = splitExperienceContamination([
    'Freelance Illustrator — Independent — 2011-2022 — Editorial campaigns Internship — Nike — Summer 2018',
  ]);
  check(
    'exp-split-intern',
    'Experience splits internship from freelance block',
    split.length >= 2,
    `parts=${split.length}`
  );

  const polluted = normalizeCvData({
    name: 'Yohann Azancot',
    title: 'EDUCATION',
    email: 'yoaz@example.com',
    phone: '+33 6 49 43 48 39',
    education: [
      'LISAA Web and Motion Design 2011-2012',
      'behance.net/yoaz portfolio 2015',
      'linkedin.com/in/yoaz contact 2016',
      'Design Institute 2028-2032',
      'Fine Arts Academy 1900-1905',
      'Ic) yoaz : Visual Communication 2008-2011',
    ],
    experience: [
      'Freelance Illustrator — Independent — 2011-2022 — Editorial campaigns Internship — Nike — Summer 2018',
    ],
    summary: 'Collaborated with Nike, Chanel and Adidas on global campaigns.',
    skills: ['Nike', 'Illustrator', 'Photoshop'],
    clients: [],
  });

  check(
    'header-no-education',
    'Header rejects section anchor title',
    !headerHasSectionAnchors(polluted) && polluted.title !== 'EDUCATION',
    `title="${polluted.title}"`
  );

  check(
    'education-no-urls',
    'Education has no URL contamination',
    !hasEducationUrls(polluted),
    educationBlob(polluted)
  );

  check(
    'education-no-bad-years',
    'Education has no impossible years',
    !hasFutureOrAncientYears(polluted),
    educationBlob(polluted)
  );

  check(
    'clients-no-infer',
    'Clients not inferred from summary/skills',
    !(polluted.clients || []).includes('Nike') && !(polluted.clients || []).includes('Chanel'),
    `clients=${JSON.stringify(polluted.clients)}`
  );

  check(
    'clients-explicit-list',
    'Explicit comma client list keeps recognized brands',
    (() => {
      const d = normalizeCvData({
        name: 'Jane Doe',
        title: 'Illustrator',
        clients: ['Nike, Adidas, Gucci'],
        education: ['LISAA 2011-2012'],
        experience: ['Freelance Illustrator — 2011-2022'],
      });
      return d.clients?.includes('Nike') && d.clients?.includes('Adidas');
    })(),
    'comma list preserved'
  );

  check(
    'exp-separated',
    'Normalized experience separates internship',
    (polluted.experience || []).length >= 2,
    JSON.stringify(polluted.experience)
  );

  check(
    'firewall-marker',
    'Firewall marker attached',
    polluted._ocrFirewall === 'OCR_CONTAMINATION_FIREWALL',
    polluted._ocrFirewall
  );

  const direct = applyOcrContaminationFirewall({
    name: 'EDUCATION',
    title: 'FORMATION',
    education: ['http://spam.edu 2015'],
    clients: ['Made Up Brand Co'],
    experience: [],
  });
  check(
    'direct-firewall',
    'Direct firewall clears anchors and junk',
    !direct.name && !direct.title && !direct.education?.length && !direct.clients?.length,
    JSON.stringify(direct)
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
