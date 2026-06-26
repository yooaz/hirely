#!/usr/bin/env node
/**
 * H17 — Stack overflow / classifier cycle guard.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

import {
  MAX_PARSER_DEPTH,
  UNKNOWN_EDUCATION_SIGNALS,
  UNKNOWN_CLASSIFICATION,
  resetParserCycleGuard,
} from '../core/parsing/parser-cycle-guard.js';
import {
  getEducationLineSignals,
  scoreEducationConfidence,
  buildForcedEducationClassification,
} from '../core/parsing/education-confidence.js';
import {
  lineIsEducationData,
  parseStrictExperiencesFromLines,
  qualifiesStrictExperience,
} from '../core/parsing/experience-parser.js';
import { passesExperienceGate, classifyLineWithConfidence } from '../core/parsing/section-sanity.js';
import { termMatchesHay } from '../data/dictionaries/match-utils.js';
import { SCHOOL_TERMS } from '../data/dictionaries/json-dictionary-match.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const FIXTURE = path.join(__dirname, '../../tests/fixtures/yoaz-cv/fixture.txt');

let failed = 0;
function ok(cond, id, detail = '') {
  if (!cond) {
    failed++;
    console.error('FAIL', id, detail);
  } else console.log('OK', id, detail || '');
}

function runNoStack(label, fn) {
  try {
    fn();
    ok(true, label);
  } catch (e) {
    ok(false, label, String(e?.message || e));
  }
}

ok(MAX_PARSER_DEPTH === 10, 'max_depth_10');
ok(UNKNOWN_EDUCATION_SIGNALS.unknown === true, 'unknown_edu_flag');
ok(UNKNOWN_CLASSIFICATION.bucket === 'unknown', 'unknown_bucket');

const sample =
  'LISAA — Web & Motion Design 2010 — 2012 · Créapole Visual Communication';

runNoStack('edu_signals_sample', () => {
  const s = getEducationLineSignals(sample);
  if (!s || typeof s.score !== 'number') throw new Error('bad signals');
});

runNoStack('exp_gate_sample', () => {
  passesExperienceGate('Lead Illustrator · McCann Paris 2011 — 2014');
});

runNoStack('classify_line_sample', () => {
  classifyLineWithConfidence(sample);
});

runNoStack('stress_school_terms', () => {
  for (const term of SCHOOL_TERMS.slice(0, 200)) {
    termMatchesHay(`${sample} ${term}`, term);
    getEducationLineSignals(`${sample} — ${term}`);
    lineIsEducationData(`${sample} — ${term}`);
  }
});

runNoStack('parse_yoaz_fixture', () => {
  const text = fs.readFileSync(FIXTURE, 'utf8');
  const lines = text.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  resetParserCycleGuard();
  const parsed = parseStrictExperiencesFromLines(lines);
  if (!parsed.experiences?.length) throw new Error('no experiences');
  for (const line of lines) {
    classifyLineWithConfidence(line);
    qualifiesStrictExperience(
      { role: 'Designer', company: line.slice(0, 40), startDate: '2020', endDate: '2022' },
      line
    );
  }
});

runNoStack('forced_edu_no_stack', () => {
  buildForcedEducationClassification(sample);
  const unknown = buildForcedEducationClassification(sample);
  if (!unknown.bucket) throw new Error('missing bucket');
});

runNoStack('score_edu_unknown_shape', () => {
  const sc = scoreEducationConfidence(sample);
  if (sc.unknown && sc.confidence !== 0) throw new Error('unknown must be zero confidence');
});

console.log(failed ? `\n${failed} failed` : '\nH17 stack overflow guard checks passed');
process.exit(failed ? 1 : 0);
