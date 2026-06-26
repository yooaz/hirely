#!/usr/bin/env node
/**
 * Education normalization — school / program / dates, no contact or OCR leaks.
 */
import {
  normalizeEducationEntry,
  normalizeAllEducation,
  stripEducationLeaks,
} from '../core/parsing/education-normalization-layer.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

const identity = {
  name: 'Yohann Azancot',
  email: 'yoaz@hotmail.fr',
  phone: '+33 6 49 43 48 39',
};

function testLisaa() {
  const raw =
    'yoaz@hotmail.fr LISAA Web and Motion Design +33 6 49 43 48 39 2011 2012';
  const out = normalizeEducationEntry(raw, { identity });
  ok(out?.school === 'LISAA', `LISAA school (${out?.school})`);
  ok(out?.program === 'Web & Motion Design', `LISAA program (${out?.program})`);
  ok(out?.dates === '2011–2012', `LISAA dates (${out?.dates})`);
  ok(!/yoaz|hotmail|\+33/i.test(out?.display || ''), `LISAA no leaks (${out?.display})`);
}

function testCreapole() {
  const raw = 'Créapole Ic) yoaz : Visual Communication 2008-2011';
  const out = normalizeEducationEntry(raw, { identity });
  ok(/créapole/i.test(out?.school || ''), `Créapole school (${out?.school})`);
  ok(out?.program === 'Visual Communication', `Créapole program (${out?.program})`);
  ok(out?.dates === '2008–2011', `Créapole dates (${out?.dates})`);
  ok(!/yoaz|Ic\)/i.test(out?.display || ''), `Créapole no OCR (${out?.display})`);
}

function testStripLeaks() {
  const cleaned = stripEducationLeaks(
    'Yohann Azancot yoaz@hotmail.fr +33 6 49 43 48 39 LISAA',
    identity
  );
  ok(!/yohann|yoaz|hotmail|\+33/i.test(cleaned), `stripped leaks (${cleaned})`);
  ok(/\bLISAA\b/i.test(cleaned), `school preserved (${cleaned})`);
}

function testSanitizerIntegration() {
  const resumeData = {
    identity,
    summary: '',
    experiences: [],
    education: [
      'LISAA yoaz@hotmail.fr Web and Motion Design 2011 2012',
      'Créapole Ic) yoaz : Visual Communication 2008-2011',
    ],
    skills: [],
    tools: [],
    languages: [],
    clients: [],
    unsorted: [],
  };
  const out = sanitizeResumeForDisplay(resumeData);
  ok(out.education?.length === 2, `two education rows (${out.education?.length})`);
  const blob = (out.education || []).join(' | ');
  ok(/\bLISAA\b.*Web & Motion Design.*2011/i.test(blob), `LISAA normalized (${blob})`);
  ok(/Créapole.*Visual Communication.*2008–2011/i.test(blob), `Créapole normalized (${blob})`);
  ok(!/yoaz|hotmail|\+33|Ic\)/i.test(blob), `sanitizer stripped leaks (${blob})`);
}

function testNormalizeAll() {
  const lines = normalizeAllEducation(
    [
      'LISAA — Web & Motion Design — 2011–2012',
      'LISAA — Web & Motion Design — 2011–2012',
      'Créapole — Visual Communication — 2008–2011',
    ],
    { identity }
  );
  ok(lines.length === 2, `deduped to 2 schools (${lines.length})`);
}

testLisaa();
testCreapole();
testStripLeaks();
testSanitizerIntegration();
testNormalizeAll();

if (failed) process.exit(1);
console.log('qa-education-normalization: all passed');
