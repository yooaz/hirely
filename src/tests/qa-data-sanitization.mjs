#!/usr/bin/env node
/**
 * P1 — DATA_SANITIZATION_LAYER acceptance.
 */
import {
  applyDataSanitizationLayer,
  auditDataSanitization,
  experienceRowHasForbiddenFutureDate,
  DATA_SANITIZATION_LAYER,
} from '../core/validation/data-sanitization-layer.js';
import { normalizeCvData } from '../core/parsing/rich-parser.js';
import { resumeDataToCvData } from '../core/resume-data.js';

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const HEADER_FORBIDDEN = /\b(education|formation|competences|compétences|langues|languages|clients)\b/i;
const EDU_FORBIDDEN = /\binstagram\b|linkedin|https?:\/\/|www\.|@/i;

const polluted = {
  name: 'Jane Doe',
  title: 'Illustrator EDUCATION FORMATION',
  email: 'jane@example.com COMPETENCES',
  phone: '+33 6 12 34 56 78 LANGUES',
  location: 'Paris CLIENTS',
  experience: [
    'Designer — McCann — 2011–2014',
    'Freelance Illustrator — 2014–2030',
    'Consultant — Future Corp — 2028–2032',
  ],
  education: [
    'LISAA — Bachelor Design — 2011–2012',
    'instagram.com/yoaz portfolio 2015',
    'linkedin.com/in/jane ENSAD 2016',
    'yoaz@hotmail.fr Créapole 2011',
    'www.behance.net/gallery design 2019',
    'ENSAD — Visual Communication — 2027–2029',
  ],
  skills: ['Figma'],
};

const sanitized = applyDataSanitizationLayer(polluted);
ok(sanitized._dataSanitization === DATA_SANITIZATION_LAYER, 'engine marker set');

const headerBlob = [sanitized.name, sanitized.title, sanitized.email, sanitized.phone, sanitized.location]
  .filter(Boolean)
  .join(' | ');
ok(!HEADER_FORBIDDEN.test(headerBlob), `header has no forbidden section words (${headerBlob})`);
ok(sanitized.email === 'jane@example.com', `email cleaned (${sanitized.email})`);
ok(/illustrator/i.test(sanitized.title), `title preserved (${sanitized.title})`);

ok(
  !(sanitized.education || []).some((line) => EDU_FORBIDDEN.test(String(line))),
  'education has no instagram/linkedin/http/www/@'
);
ok((sanitized.education || []).length >= 1, `valid education kept (${(sanitized.education || []).length})`);
ok(
  !(sanitized.education || []).some((line) => /\b202[7-9]\b|\b203\d\b/.test(String(line))),
  'education has no future years beyond 2026'
);

ok(experienceRowHasForbiddenFutureDate('Role — Co — 2028–2030'), 'detects forbidden future experience');
ok(
  !(sanitized.experience || []).some((line) => experienceRowHasForbiddenFutureDate(line)),
  'experience has no forbidden future dates'
);
ok((sanitized.experience || []).some((line) => /mccann/i.test(line)), 'valid experience kept');

const audit = auditDataSanitization(sanitized);
ok(audit.headerClean, 'audit header clean');
ok(audit.educationClean, 'audit education clean');
ok(audit.noFutureDates, 'audit no future dates');

const normalized = normalizeCvData(polluted);
const normHeader = [normalized.name, normalized.title, normalized.email, normalized.phone, normalized.location]
  .filter(Boolean)
  .join(' | ');
ok(!HEADER_FORBIDDEN.test(normHeader), 'normalizeCvData header clean');
ok(
  !(normalized.education || []).some((line) => EDU_FORBIDDEN.test(String(line))),
  'normalizeCvData education clean'
);

const resumeCv = resumeDataToCvData(
  {
    identity: {
      name: 'Jane Doe',
      title: 'Designer FORMATION',
      email: 'jane@example.com EDUCATION',
      phone: '+33 6 12 34 56 78',
      location: 'Paris',
    },
    experiences: [{ role: 'Designer', company: 'McCann', startDate: '2011', endDate: '2014', dates: '2011–2014' }],
    education: ['LISAA — Design — 2011–2012', 'instagram.com/foo 2015'],
    skills: [],
    tools: [],
    languages: [],
    clients: [],
    projects: [],
    unsorted: [],
    meta: {},
  },
  { skipNormalize: true }
);
const resumeHeader = [resumeCv.name, resumeCv.title, resumeCv.email, resumeCv.phone, resumeCv.location]
  .filter(Boolean)
  .join(' | ');
ok(!HEADER_FORBIDDEN.test(resumeHeader), 'resumeDataToCvData header clean');
ok(
  !(resumeCv.education || []).some((line) => EDU_FORBIDDEN.test(String(line))),
  'resumeDataToCvData education clean'
);
ok(!('_dataSanitization' in resumeCv), 'resumeDataToCvData strips internal sanitization markers');
ok(!('unsorted' in resumeCv), 'resumeDataToCvData strips parser unsorted bucket');

console.log('\nDATA_SANITIZATION QA PASS');
