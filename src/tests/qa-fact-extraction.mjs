#!/usr/bin/env node
/**
 * Fact extraction pipeline — Stage 1 facts, Stage 2 CV build.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractFactsFromLine,
  extractFactsFromLines,
  FACT_TYPES,
} from '../core/parsing/fact-extraction.js';
import {
  buildCvFromFacts,
  partitionFactsByConfidence,
} from '../core/parsing/cv-from-facts.js';
import { FACT_CONFIDENCE_THRESHOLD } from '../core/parsing/fact-types.js';
import { runFactPipeline } from '../core/parsing/fact-pipeline.js';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const yoazFixture = readFileSync(join(root, 'tests/fixtures/yoaz-cv/fixture.txt'), 'utf8');

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

function fact(line, type, valueFragment) {
  const facts = extractFactsFromLine(line);
  const hit = facts.find(
    (f) =>
      f.type === type &&
      String(f.value).toLowerCase().includes(String(valueFragment).toLowerCase())
  );
  ok(Boolean(hit), `fact ${type} "${valueFragment}" from "${line.slice(0, 48)}"`);
  if (hit) {
    ok(hit.confidence >= FACT_CONFIDENCE_THRESHOLD, `${valueFragment} confidence ${hit.confidence} >= ${FACT_CONFIDENCE_THRESHOLD}`);
    ok(
      typeof hit.confidence === 'number' && hit.confidence <= 1,
      `${valueFragment} confidence is 0–1 (${hit.confidence})`
    );
  }
  return hit;
}

ok(FACT_CONFIDENCE_THRESHOLD === 0.8, 'fact threshold is 0.8');
ok(FACT_TYPES.includes('language'), 'FACT_TYPES includes language');

// Stage 1 — atomic facts
fact('English — fluent', 'language', 'English');
fact('French — native', 'language', 'French');
fact('Photoshop', 'tool', 'Photoshop');
fact('Adobe Illustrator', 'tool', 'Adobe Illustrator');
fact('LISAA — Web & Motion Design', 'education', 'LISAA');
fact('Packaging', 'skill', 'Packaging');
fact('Branding', 'skill', 'Branding');
fact('Nike', 'client', 'Nike');
fact('Adobe', 'client', 'Adobe');
fact('Marvel', 'client', 'Marvel');
fact('Music', 'interest', 'Music');
fact('Movies', 'interest', 'Movies');

// Unknown / low confidence not forced
const drawing = extractFactsFromLine('Drawing');
ok(
  drawing.every((f) => f.type === 'unknown' || f.confidence < FACT_CONFIDENCE_THRESHOLD),
  'Drawing not forced into skill/client'
);

// Stage 2 — CV from facts only
const stage1 = extractFactsFromLines([
  'LISAA — Web & Motion Design',
  'Photoshop',
  'English — fluent',
  'Nike',
  'Packaging',
  'Music',
  'Random ambiguous fragment',
]);
const { accepted, pending } = partitionFactsByConfidence(stage1);
ok(accepted.length >= 5, `accepted facts (${accepted.length})`);
ok(pending.length >= 1, `pending facts (${pending.length})`);

const cv = buildCvFromFacts(stage1);
ok(cv.structured.metadata.factPipeline === true, 'structured metadata factPipeline');
ok(cv.structured.education.some((e) => /LISAA/i.test(e)), 'CV education has LISAA');
ok(cv.structured.tools.some((t) => /Photoshop/i.test(t)), 'CV tools has Photoshop');
ok(cv.structured.languages.some((l) => /English/i.test(l)), 'CV languages has English');
ok(cv.structured.clients.some((c) => /Nike/i.test(c)), 'CV clients has Nike');
ok(cv.structured.skills.some((s) => /Packaging/i.test(s)), 'CV skills has Packaging');
ok(cv.structured.interests.some((i) => /Music/i.test(i)), 'CV interests has Music');
ok(cv.reviewQueue.length >= 1, 'review queue has pending facts');
ok(
  !cv.structured.skills.some((s) => /^Random/i.test(s)),
  'ambiguous fragment not in skills'
);

// Full Yoaz fixture via section engine
const engine = runSectionEngineV2(yoazFixture, { rawText: yoazFixture });
ok(engine.structured.metadata.factPipeline === true, 'section engine uses fact pipeline');
ok(engine.structured.metadata.neverForceCategory === true, 'never force category flag');

const metaFacts = engine.structured.metadata.facts || [];
const findMeta = (type, frag) =>
  metaFacts.find(
    (f) => f.type === type && String(f.value).toLowerCase().includes(frag.toLowerCase())
  );

ok(findMeta('education', 'lisaa'), 'Yoaz facts include LISAA education');
ok(findMeta('tool', 'photoshop'), 'Yoaz facts include Photoshop tool');
ok(findMeta('language', 'english'), 'Yoaz facts include English language');
ok(findMeta('client', 'adobe') || findMeta('client', 'nike'), 'Yoaz facts include golden client (Adobe or Nike)');
ok(findMeta('skill', 'packaging'), 'Yoaz facts include Packaging skill');

process.exit(failed ? 1 : 0);
