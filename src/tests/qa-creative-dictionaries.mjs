#!/usr/bin/env node
/**
 * Creative dictionaries — preservation, no auto-correct, coverage report.
 */
import {
  ALL_CREATIVE_ENTITIES,
  CREATIVE_DICTIONARY_ANCHORS,
  generateCreativeDictionaryCoverageReport,
  printCreativeDictionaryCoverageReport,
} from '../data/dictionaries/creative/index.js';
import { postProcessOcrText } from '../core/parsing/ocr-postprocess.js';
import { isGarbageLine } from '../data/dictionaries/garbagePatterns.js';
import { maskCreativeEntities, unmaskCreativeEntities } from '../core/parsing/creative-entity-guard.js';
import { parseCV, normalizeCvData } from '../core/parsing/rich-parser.js';

const SAMPLE_CV = `
Yohann Azancot
Graphic Designer & Illustrator

Clients: Nike, Louis Vuitton, Marvel, Converse, Pantone, PlayStation, Cadillac, Adobe, McCann, Arte
Tools: Affinity Designer, Illustrator, Photoshop, InDesign, Behance
Education: LISAA — Web & Motion · Créapole — Visual Communication
`;

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

ok(ALL_CREATIVE_ENTITIES.length >= 80, `dictionary size ${ALL_CREATIVE_ENTITIES.length}`);

for (const anchor of CREATIVE_DICTIONARY_ANCHORS) {
  ok(
    ALL_CREATIVE_ENTITIES.some((t) => t.toLowerCase() === anchor.toLowerCase()),
    `anchor in dictionary: ${anchor}`
  );
}

const noisy = `Cl1ents: N1ke, Lou1s Vu1tton, Marve1, Aff1n1ty Des1gner, Photosh0p, LISAA, Creapole`;
const fixed = postProcessOcrText(noisy, { ocr: true });
ok(fixed.includes('Nike') || fixed.includes('N1ke'), 'Nike family preserved through OCR');
ok(!fixed.includes('Lou1s') || fixed.includes('Louis Vuitton'), 'Louis Vuitton OCR hint or preserved');
ok(fixed.includes('Photoshop') || fixed.includes('Photosh0p'), 'Photoshop handled');
ok(!isGarbageLine('Clients: Nike, Adobe, Pantone'), 'client line not garbage');

const { masked, originals } = maskCreativeEntities('Louis Vuitton & Nike');
ok(masked.includes('\uE000CRE'), 'entities masked');
const restored = unmaskCreativeEntities(masked.replace(/Vuitton/g, 'VUITTON'), originals);
ok(restored.includes('Louis'), 'unmask restores original casing');

const report = generateCreativeDictionaryCoverageReport(SAMPLE_CV);
ok(report.anchorsFound >= 12, `anchors found ${report.anchorsFound}/${report.anchorsTotal}`);
ok(report.uniqueEntitiesInText >= 10, `entities in sample ${report.uniqueEntitiesInText}`);
ok(report.categories.creativeSoftware.matchedCount >= 4, 'software matches');
ok(report.categories.schools.matchedCount >= 1, 'school matches');

const parsed = normalizeCvData(parseCV(SAMPLE_CV));
ok(
  (parsed.clients || []).some((c) => /nike|louis|marvel/i.test(c)) ||
    (parsed.skills || []).some((s) => /illustrator|photoshop/i.test(s)),
  'parser keeps creative entities in clients/skills'
);

printCreativeDictionaryCoverageReport(report);

console.log(failed ? `\n${failed} FAILED` : '\nCreative dictionary QA passed');
process.exit(failed ? 1 : 0);
