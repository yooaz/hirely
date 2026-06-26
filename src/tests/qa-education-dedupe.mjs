#!/usr/bin/env node
/**
 * Education dedupe — same school + program + overlapping years merge to one row.
 */
import { dedupeEducationEntries } from '../core/parsing/education-dedupe.js';
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

const identity = { name: 'Yohann Azancot', email: 'yoaz@hotmail.fr' };

function testCreapoleOverlappingMerge() {
  const input = [
    'Créapole — Visual Communication — 2007–2009',
    'Créapole — Visual Communication — 2008–2010',
    'Créapole — Product Design — 2011–2012',
    'LISAA — Web & Motion Design — 2011–2012',
  ];
  const out = dedupeEducationEntries(input, { identity });
  ok(out.length === 3, `3 programs after dedupe (${out.length})`);
  const creapoleVc = out.filter((l) => /créapole/i.test(l) && /visual communication/i.test(l));
  ok(creapoleVc.length === 1, `one Visual Communication row (${creapoleVc.length})`);
  ok(/2007.*2010|2007–2010/.test(creapoleVc[0] || ''), `merged years 2007–2010 (${creapoleVc[0]})`);
  const creapolePd = out.filter((l) => /créapole/i.test(l) && /product design/i.test(l));
  ok(creapolePd.length === 1, `Product Design kept separate (${creapolePd[0]})`);
  ok(out.filter((l) => /lisaa/i.test(l)).length === 1, 'LISAA preserved');
}

function testExactDuplicateRemoved() {
  const input = [
    'LISAA — Web & Motion Design — 2011–2012',
    'LISAA — Web & Motion Design — 2011–2012',
  ];
  const out = dedupeEducationEntries(input, { identity });
  ok(out.length === 1, `exact duplicate collapsed (${out.length})`);
}

function testSanitizerNoDuplicateBlocks() {
  const resumeData = {
    identity,
    summary: '',
    experiences: [],
    education: [
      'Créapole — Visual Communication — 2007–2009',
      'Créapole — Visual Communication — 2008–2010',
      'Créapole — 2011–2012',
      'LISAA — Web & Motion Design — 2011–2012',
    ],
    skills: [],
    tools: [],
    languages: [],
    clients: [],
    unsorted: [],
  };
  const out = sanitizeResumeForDisplay(resumeData);
  const creapole = (out.education || []).filter((l) => /créapole/i.test(l));
  ok(creapole.length <= 2, `no Créapole triple duplicate (${creapole.length} rows)`);
  const keys = new Set();
  for (const line of out.education || []) {
    const school = line.split(/\s*[—–-]\s*/)[0].trim().toLowerCase();
    const program = (line.split(/\s*[—–-]\s*/)[1] || '').trim().toLowerCase();
    const key = `${school}|${program}`;
    ok(!keys.has(key), `unique school+program block (${key})`);
    keys.add(key);
  }
}

testCreapoleOverlappingMerge();
testExactDuplicateRemoved();
testSanitizerNoDuplicateBlocks();

if (failed) process.exit(1);
console.log('qa-education-dedupe: all passed');
