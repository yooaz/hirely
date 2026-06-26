#!/usr/bin/env node
/**
 * Universal CV Extraction Engine — acceptance (experience recall > 90%).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CV_BLOCK_ENGINE,
  CV_BLOCK_TYPES,
  UNIVERSAL_EXPERIENCE_RECONSTRUCTOR,
  UNIVERSAL_EXPERIENCE_RECALL_GOAL,
  detectDatesInText,
  detectCompanyInLine,
  detectRoleInLine,
  runCvBlockEngine,
  runUniversalExtractionEngine,
} from '../core/parsing/universal-extraction/index.js';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/universal-extraction-engine');
const OCR_FRAGMENTED = path.join(ROOT, 'tests/fixtures/yoaz-pdf-live/ocr-fragmented.txt');

const LABELED_CV = `Yohann Azancot
Graphic Designer & Illustrator
yoaz@hotmail.fr · Paris

Creative professional specializing in illustration and brand systems.

Experience
2011–2022 — Freelance Illustrator / Graphic Designer
McCann Paris — Lead Illustrator — 2014–2018
Publicis — Art Director — 2018–2020
Havas — Senior Designer — 2020–2022

Clients
Nike, Adobe, Louis Vuitton, Pantone

Education
LISAA — Web & Motion Design
Créapole — Visual Communication

Skills
Illustration, Brand identity, Art direction

Tools
Photoshop, Illustrator, InDesign, Figma

Languages
French — native
English — fluent
`;

/** Ground-truth experience rows we expect to recover */
const LABELED_EXPECTED = [
  { company: /freelance/i, role: /illustrator|designer/i },
  { company: /mccann/i, role: /illustrator/i },
  { company: /publicis/i, role: /art director/i },
  { company: /havas/i, role: /designer/i },
];

let failed = 0;
const checks = [];

function ok(cond, id, detail = '') {
  checks.push({ id, pass: !!cond, detail });
  if (!cond) {
    failed++;
    console.error('FAIL', id, detail);
  } else console.log('OK', id, detail || '');
}

function matchExpected(experiences, expected) {
  let hits = 0;
  const blob = experiences
    .map((e) => `${e.role} ${e.company} ${e.dates}`.toLowerCase())
    .join(' ');
  for (const exp of expected) {
    if (exp.company.test(blob) && exp.role.test(blob)) hits++;
  }
  return hits;
}

fs.mkdirSync(OUT_DIR, { recursive: true });

// Phase 2 — date detector
const d1 = detectDatesInText('2018-2020');
ok(d1.startDate === '2018' && d1.endDate === '2020', 'date_range_hyphen');

const d2 = detectDatesInText('2018 → Present');
ok(d2.startDate === '2018' && /present/i.test(d2.endDate), 'date_arrow_present');

const d3 = detectDatesInText('Jan 2020 - Mar 2022');
ok(d3.startDate === '2020' && d3.endDate === '2022', 'date_month_range');

const d4 = detectDatesInText('06/2019');
ok(d4.startDate === '2019', 'date_slash_month');

const d5 = detectDatesInText('2O18 - 2O2O');
ok(d5.startDate === '2018' && d5.endDate === '2020', 'date_ocr_repair');

// Phase 3 — company detector (no dictionary)
const c1 = detectCompanyInLine('Nike');
ok(c1.company === 'Nike' && c1.confidence >= 0.6, 'company_nike');

const c2 = detectCompanyInLine('Freelance Illustrator');
ok(/freelance/i.test(c2.company), 'company_freelance');

const c3 = detectCompanyInLine('Google');
ok(c3.company === 'Google', 'company_google');

// Phase 4 — role detector
const r1 = detectRoleInLine('Graphic Designer');
ok(/graphic designer/i.test(r1.role), 'role_graphic_designer');

const r2 = detectRoleInLine('Frontend Developer at Meta');
ok(/frontend developer/i.test(r2.role), 'role_frontend');

const r3 = detectRoleInLine('Art Director');
ok(/art director/i.test(r3.role), 'role_art_director');

// Phase 1 — block engine
const blocks = runCvBlockEngine(LABELED_CV);
ok(blocks.engine === CV_BLOCK_ENGINE, 'block_engine_id');
ok(blocks.blocks.length >= 6, 'block_count', `blocks=${blocks.blocks.length}`);
const types = new Set(blocks.blocks.map((b) => b.type));
ok(types.has(CV_BLOCK_TYPES.EXPERIENCE) || types.has(CV_BLOCK_TYPES.SKILLS), 'block_types_detected');

// Phase 5 — reconstruction
const universal = runUniversalExtractionEngine(LABELED_CV);
const exps = universal.structured.experiences || [];
ok(exps.length >= 3, 'reconstruction_count', `count=${exps.length}`);

const labeledHits = matchExpected(exps, LABELED_EXPECTED);
const labeledRecall = labeledHits / LABELED_EXPECTED.length;
ok(labeledRecall >= UNIVERSAL_EXPERIENCE_RECALL_GOAL, 'labeled_recall', `${Math.round(labeledRecall * 100)}%`);

// Section engine wiring
const section = runSectionEngineV2(LABELED_CV, { rawText: LABELED_CV, extractionMethod: 'text' });
ok(section.structured?.metadata?.universalBlockEngine === CV_BLOCK_ENGINE, 'section_engine_block_wired');
ok(
  section.structured?.metadata?.universalExtraction?.engine === UNIVERSAL_EXPERIENCE_RECONSTRUCTOR,
  'section_engine_recon_wired'
);
ok((section.structured?.experiences?.length || 0) >= 2, 'section_engine_experiences');

// Yoaz OCR fixture
let ocrRecall = 0;
let ocrCount = 0;
if (fs.existsSync(OCR_FRAGMENTED)) {
  const raw = fs.readFileSync(OCR_FRAGMENTED, 'utf8');
  const ocr = runUniversalExtractionEngine(raw);
  ocrCount = ocr.structured.experiences?.length || 0;
  const expectedOcr = 9;
  ocrRecall = Math.min(1, ocrCount / expectedOcr);
  ok(ocrCount >= 8, 'yoaz_ocr_recovery', `count=${ocrCount}`);
  ok(ocrRecall >= UNIVERSAL_EXPERIENCE_RECALL_GOAL, 'yoaz_recall', `${Math.round(ocrRecall * 100)}%`);
} else {
  ok(false, 'yoaz_fixture_missing');
}

const report = {
  feature: 'UNIVERSAL_CV_EXTRACTION_ENGINE',
  generatedAt: new Date().toISOString(),
  recallGoal: UNIVERSAL_EXPERIENCE_RECALL_GOAL,
  labeled: { expected: LABELED_EXPECTED.length, hits: labeledHits, recallPct: Math.round(labeledRecall * 100) },
  yoazOcr: { recovered: ocrCount, recallPct: Math.round(ocrRecall * 100) },
  checks,
  pass: failed === 0,
};

fs.writeFileSync(path.join(OUT_DIR, 'report.json'), JSON.stringify(report, null, 2));
console.log(failed ? '\nFAIL universal-extraction-engine' : '\nPASS universal-extraction-engine');
process.exit(failed ? 1 : 0);
