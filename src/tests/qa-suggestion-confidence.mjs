#!/usr/bin/env node
/**
 * Suggestion noise engine — uncertain LOW_CONFIDENCE only in product UI; GARBAGE hidden; max 2.
 */
import {
  suggestionConfidenceScore,
  classifySuggestionNoise,
  filterProductSuggestions,
} from '../core/parsing/suggestion-confidence-score.js';

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const garbage = [
  'v38 A',
  'LEA',
  'S Phone:',
  '@27Yo8z market reviews',
  'Print',
  'CONTACT',
  'Ic) yoaz27 2008 2009 : Créapole creation school management',
  'ee à',
  'Mustrator RE scowboscc',
];

for (const line of garbage) {
  const s = classifySuggestionNoise(line);
  ok(s.classification === 'GARBAGE', `GARBAGE: ${line} (${s.reason})`);
  ok(!s.show, `never show garbage: ${line}`);
}

const lowConfidence = ['@ man visual communication', 'visuel identity'];

for (const line of lowConfidence) {
  const s = classifySuggestionNoise(line);
  ok(s.classification === 'LOW_CONFIDENCE', `LOW_CONFIDENCE: ${line}`);
  ok(s.show, `may show low confidence: ${line}`);
}

const meaningful = [
  'Branding and illustration for global fashion campaigns',
  'Adobe Photoshop and Illustrator production workflows',
  'French native — English fluent professional working proficiency',
];

for (const line of meaningful) {
  const s = suggestionConfidenceScore(line, { confidence: 82 });
  ok(s.classification === 'VALID', `VALID: ${line.slice(0, 48)}…`);
  ok(s.show, `show meaningful: ${line.slice(0, 48)}… (score=${s.score})`);
}

const candidates = [
  ...garbage.map((text, i) => ({ kind: 'classify', id: `g-${i}`, text, category: 'skill' })),
  ...lowConfidence.map((text, i) => ({ kind: 'classify', id: `l-${i}`, text, category: 'skill' })),
  ...meaningful.map((text, i) => ({ kind: 'classify', id: `m-${i}`, text, category: 'skill', confidence: 85 })),
];

const filtered = filterProductSuggestions(candidates, { maxVisible: 2 });
ok(filtered.stats.before === candidates.length, `before=${filtered.stats.before}`);
ok(filtered.stats.after <= 2, `after=${filtered.stats.after}`);
ok(filtered.stats.hidden === filtered.stats.before - filtered.stats.after, `hidden=${filtered.stats.hidden}`);
ok(filtered.items.every((it) => it.classification !== 'GARBAGE'), 'visible items never GARBAGE');
ok(
  filtered.items.every((it) => it.classification === 'LOW_CONFIDENCE'),
  'visible items LOW_CONFIDENCE only'
);
ok(!filtered.items.some((it) => meaningful.includes(it.text)), 'VALID classifiable lines hidden from product UI');
ok(!filtered.items.some((it) => garbage.includes(it.text)), 'no garbage in visible set');
ok(filtered.archive.some((it) => it.archiveReason === 'garbage'), 'garbage archived');
ok(filtered.stats.garbage === garbage.length, `garbage count=${filtered.stats.garbage}`);

console.log('SUGGESTION_FILTER', filtered.stats);
console.log('qa-suggestion-confidence: passed');
