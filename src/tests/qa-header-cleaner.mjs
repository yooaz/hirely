#!/usr/bin/env node
/**
 * P1 — HEADER_CLEANER acceptance: no section titles in identity header fields.
 */
import {
  HEADER_CLEANER,
  headerContainsForbiddenSection,
  cleanHeaderField,
  applyHeaderCleaner,
  headerFieldsBlob,
  stripForbiddenSectionsFromText,
} from '../core/parsing/header-cleaner.js';
import { normalizeCvData } from '../core/parsing/rich-parser.js';

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const FORBIDDEN = /education|formation|competences|compétences|langues|languages|clients/i;

ok(headerContainsForbiddenSection('EDUCATION'), 'detects EDUCATION');
ok(headerContainsForbiddenSection('FORMATION'), 'detects FORMATION');
ok(headerContainsForbiddenSection('COMPETENCES'), 'detects COMPETENCES');
ok(headerContainsForbiddenSection('LANGUES'), 'detects LANGUES');
ok(headerContainsForbiddenSection('CLIENTS'), 'detects CLIENTS');
ok(!headerContainsForbiddenSection('Graphic Designer'), 'allows professional title');

const stripped = stripForbiddenSectionsFromText('Paris EDUCATION FORMATION COMPETENCES');
ok(!FORBIDDEN.test(stripped.cleaned), `strips section words (${stripped.cleaned})`);
ok(/paris/i.test(stripped.cleaned), 'keeps location token');

const emailClean = cleanHeaderField('jane@example.com EDUCATION FORMATION', 'email');
ok(emailClean.value === 'jane@example.com', `email extracted (${emailClean.value})`);

const phoneClean = cleanHeaderField('+33 6 12 34 56 78 COMPETENCES', 'phone');
ok(phoneClean.value.includes('+33'), `phone extracted (${phoneClean.value})`);

const titleClean = cleanHeaderField('Graphic Designer EDUCATION FORMATION', 'title');
ok(!FORBIDDEN.test(titleClean.value), `title cleaned (${titleClean.value})`);
ok(/graphic designer/i.test(titleClean.value), 'title role preserved');

const polluted = {
  name: 'Jane Doe',
  title: 'Illustrator EDUCATION FORMATION COMPETENCES',
  email: 'jane@example.com EDUCATION',
  phone: '+33 6 12 34 56 78 LANGUES',
  location: 'Paris CLIENTS',
  experience: [],
  education: [],
  skills: [],
};

const cleaned = applyHeaderCleaner(polluted);
ok(cleaned._headerCleaner === HEADER_CLEANER, 'header cleaner marker');
ok(!FORBIDDEN.test(headerFieldsBlob(cleaned)), `header blob clean (${headerFieldsBlob(cleaned)})`);
ok(cleaned.email === 'jane@example.com', `email kept (${cleaned.email})`);
ok(cleaned.phone.includes('+33'), `phone kept (${cleaned.phone})`);
ok(/jane doe/i.test(cleaned.name), `name kept (${cleaned.name})`);
ok(/illustrator/i.test(cleaned.title), `title kept (${cleaned.title})`);
ok(/paris/i.test(cleaned.location), `location kept (${cleaned.location})`);

const normalized = normalizeCvData({
  name: 'Yohann Azancot',
  title: 'Graphic Designer FORMATION',
  email: 'yoaz@hotmail.fr EDUCATION',
  phone: '+33 6 49 43 48 39 COMPETENCES',
  location: 'Paris LANGUES',
  experience: ['Designer — McCann — 2011–2014'],
  education: ['LISAA — Web Design — 2011–2012'],
  skills: ['Figma'],
});
ok(!FORBIDDEN.test(headerFieldsBlob(normalized)), 'normalizeCvData header has no section titles');
ok(normalized.email === 'yoaz@hotmail.fr', `normalizeCvData email (${normalized.email})`);

console.log('\nHEADER_CLEANER QA PASS');
