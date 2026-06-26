#!/usr/bin/env node
/**
 * P2 — Fact classifier regression: strict types, confidence gate, no misrouting.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  extractFactsFromLine,
  extractFactsFromSectionBlocks,
} from '../core/parsing/fact-extraction.js';
import { buildCvFromFacts } from '../core/parsing/cv-from-facts.js';
import { classifyFactStrict, ALLOWED_FACT_TYPES } from '../core/parsing/fact-classifier.js';
import { FACT_CONFIDENCE_THRESHOLD } from '../core/parsing/fact-types.js';
import { SECTION_IDS } from '../core/parsing/section-types-v2.js';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const creativeFixture = readFileSync(join(root, 'tests/fixtures/creative-cv/fixture.txt'), 'utf8');

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

function classified(line, opts = {}) {
  const facts = extractFactsFromLine(line, opts);
  return facts[0] || null;
}

ok(FACT_CONFIDENCE_THRESHOLD === 0.8, 'threshold is 80%');
ok(ALLOWED_FACT_TYPES.includes('language'), 'language in allowed types');

// Line specialty beats wrong section hint
ok(classified('Packaging', { hintType: 'client' })?.type === 'skill', 'skill not client (Packaging)');
ok(classified('English — fluent', { hintType: 'tool' })?.type === 'language', 'language not tool');
ok(classified('Photoshop', { hintType: 'client' })?.type === 'tool', 'tool not client (Photoshop)');
ok(classified('LISAA — Web & Motion Design', { hintType: 'experience' })?.type === 'education', 'education not experience');

// Language lines stay atomic (no bare "fluent")
const langFacts = extractFactsFromLine('French — native');
ok(langFacts.length === 1, 'one language fact per proficiency line');
ok(langFacts[0]?.value.includes('French'), 'language value keeps French');
ok(!langFacts.some((f) => f.value === 'fluent' || f.value === 'native'), 'no bare proficiency token');

const toolBlockLangs = extractFactsFromSectionBlocks([
  { type: SECTION_IDS.TOOLS, lines: ['English — fluent', 'French — native'], classifiedConfidence: 92 },
]);
ok(
  !toolBlockLangs.some((f) => f.type === 'tool'),
  'languages in tools block are not tools'
);
ok(
  toolBlockLangs.every((f) => f.type === 'language' || f.type === 'unknown'),
  'tools block language lines are language or unknown'
);
ok(
  !toolBlockLangs.some((f) => /^fluent$/i.test(f.value) || /^native$/i.test(f.value)),
  'no split proficiency tokens in tools block'
);

// Skills block mislabeled as clients
const clientBlockSkills = extractFactsFromSectionBlocks([
  {
    type: SECTION_IDS.CLIENTS,
    lines: ['Packaging', 'Branding', 'Typography'],
    classifiedConfidence: 92,
  },
]);
ok(clientBlockSkills.every((f) => f.type === 'skill'), 'skills in clients block stay skill');
const cvSkills = buildCvFromFacts(clientBlockSkills);
ok(cvSkills.structured.clients.length === 0, 'skills not in clients CV section');
ok(cvSkills.structured.skills.length === 3, 'skills land in skills section');

// Low confidence → suggestions not CV
const garbage = extractFactsFromSectionBlocks([
  { type: SECTION_IDS.CLIENTS, lines: ['xyz random fragment'], classifiedConfidence: 92 },
]);
const cvGarbage = buildCvFromFacts(garbage);
ok(cvGarbage.structured.clients.length === 0, 'ambiguous text not in clients CV');
ok(cvGarbage.reviewQueue.length >= 1, 'ambiguous text in review queue');

// Prose summary not forced into skills
const summaryLine =
  'Creative professional specializing in illustration, graphic design and visual storytelling, with experience delivering posters, packaging, identities and visual assets for cultural and commercial projects.';
const summaryFact = classified(summaryLine);
ok(summaryFact?.type === 'summary' || summaryFact?.confidence < FACT_CONFIDENCE_THRESHOLD, 'prose not high-confidence skill');

// Adobe brand vs Photoshop tool
ok(classified('Adobe', { hintType: 'tool' })?.type === 'client', 'Adobe is client not tool');
ok(classified('Adobe Photoshop')?.type === 'tool', 'Adobe Photoshop is tool');

// Fact shape
const shape = classifyFactStrict({
  type: 'skill',
  value: 'Branding',
  confidence: 0.9,
  sourceLine: 'Branding',
});
ok(shape.type && shape.value && typeof shape.confidence === 'number' && shape.sourceLine, 'fact shape complete');

// Creative fixture end-to-end
const engine = runSectionEngineV2(creativeFixture, { rawText: creativeFixture });
const s = engine.structured;
ok(!(s.clients || []).some((c) => /packaging|branding|typography/i.test(c)), 'no skills in clients');
ok(!(s.tools || []).some((t) => /^english$|^french$|^fluent$|^native$/i.test(t)), 'no languages in tools');
ok(!(s.languages || []).some((l) => /^fluent$/i.test(l) || /^native$/i.test(l)), 'no bare proficiency in languages');
ok((s.languages || []).some((l) => /French/i.test(l)), 'creative CV has French');
ok((s.languages || []).some((l) => /English/i.test(l)), 'creative CV has English');
ok((s.education || []).some((e) => /LISAA/i.test(e)), 'education has LISAA');
ok(!(s.skills || []).some((sk) => sk.length > 120), 'no prose blobs in skills');

process.exit(failed ? 1 : 0);
