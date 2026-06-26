#!/usr/bin/env node
/**
 * P0 — OCR text dedup without data loss.
 */
import {
  DEDUPE_ENGINE,
  dedupeClientList,
  dedupeProjectList,
  dedupeExperienceEntries,
  dedupeTextLinesBySimilarity,
  dedupeEntityStringList,
  semanticSimilarityForDedup,
  pickRicherStringLabel,
} from '../core/parsing/dedupe-engine.js';
import { dedupeExtractedLines, dedupePlainText } from '../core/extraction/extraction-audit.js';
import { dedupeFinalResumeData, auditFinalResumeDuplicates, DEDUPE_FINAL_RESUME } from '../core/validation/dedupe-final-resume.js';
import { isSectionLabelLeakage } from '../core/validation/section-label-leakage-guard.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

ok(DEDUPE_ENGINE === 'DEDUPE_ENGINE_V3', 'engine V3');
ok(DEDUPE_FINAL_RESUME === 'DEDUPE_FINAL_RESUME_V3', 'final dedupe V3');

ok(semanticSimilarityForDedup('Nike', 'Nike') === 1, 'exact Nike');
ok(semanticSimilarityForDedup('Nike', 'Graphic Designer — Nike — 2019') < 0.92, 'Nike not duplicate of experience line');
ok(semanticSimilarityForDedup('Adobe', 'Adobe Illustrator') < 0.92, 'Adobe kept separate from Adobe Illustrator');
ok(semanticSimilarityForDedup('McCann G. Agency', 'McCann Agency') >= 0.88, 'McCann OCR variants similar');
ok(
  pickRicherStringLabel('McCann G. Agency', 'McCann Agency') === 'McCann G. Agency',
  'keeps richest McCann label'
);
ok(semanticSimilarityForDedup('clients', 'Nike') === 0, 'section label never merges with content');
ok(isSectionLabelLeakage('Market Reviews'), 'Market Reviews is parser metadata');

const clients = dedupeClientList(['Nike', 'Nike', 'Adobe', 'Adobe Illustrator', 'McCann G. Agency', 'McCann Agency']);
ok(clients.filter((c) => /^nike$/i.test(c)).length === 1, 'Nike duplicate collapsed');
ok(clients.includes('Adobe Illustrator'), 'Adobe Illustrator preserved');
ok(clients.some((c) => /mccann/i.test(c)) && clients.filter((c) => /mccann/i.test(c)).length === 1, 'McCann variants → one richest');

const projects = dedupeProjectList([
  'Visual Communication',
  'Visual Communication',
  'Air Max Campaign',
  'Air Max campaign',
]);
ok(projects.filter((p) => /visual communication/i.test(p)).length === 1, 'Visual Communication duplicate → one');
ok(projects.filter((p) => /air max/i.test(p)).length === 1, 'Air Max near-duplicate → one');

const tools = dedupeEntityStringList(['Adobe Illustrator', 'Adobe Illustrator', 'Photoshop']);
ok(tools.length === 2, 'tools: Illustrator once + Photoshop');

const ocrLines = dedupeTextLinesBySimilarity([
  'Senior Designer — McCann — 2018–2020',
  'Senior Designer - McCann - 2018-2020',
  'Nike',
  'Nike',
  'Graphic Designer — Nike — 2019–Present',
  'clients',
  'Market Reviews',
  'Market Reviews',
]);
ok(ocrLines.includes('Nike'), 'Nike client line kept');
ok(ocrLines.filter((l) => /^nike$/i.test(l)).length === 1, 'Nike exact duplicate collapsed');
ok(ocrLines.filter((l) => /senior designer — mccann/i.test(l)).length === 1, 'McCann experience line once');
ok(!ocrLines.includes('clients'), 'section label stripped from line dedupe clusters');
ok(ocrLines.filter((l) => /market reviews/i.test(l)).length <= 1, 'Market Reviews duplicate → one');

const extracted = dedupeExtractedLines([
  { page: 1, line: 0, text: 'Nike', cleanedText: 'Nike' },
  { page: 1, line: 1, text: 'Nike', cleanedText: 'Nike' },
  { page: 1, line: 2, text: 'Graphic Designer — Nike — 2019', cleanedText: 'Graphic Designer — Nike — 2019' },
  { page: 1, line: 3, text: 'Adobe', cleanedText: 'Adobe' },
  { page: 1, line: 4, text: 'Adobe Illustrator', cleanedText: 'Adobe Illustrator' },
  { page: 2, line: 0, text: 'Nike', cleanedText: 'Nike' },
]);
const extTexts = extracted.lines.map((l) => l.cleanedText || l.text);
ok(extTexts.includes('Graphic Designer — Nike — 2019'), 'experience line with Nike kept');
ok(extTexts.includes('Adobe'), 'unique Adobe kept');
ok(extTexts.includes('Adobe Illustrator'), 'Adobe Illustrator kept');
ok(extTexts.filter((t) => t === 'Nike').length >= 1, 'Nike client line kept on page 1');
ok(extracted.removedLines >= 1, 'exact Nike duplicate merged on page');

const plain = dedupePlainText(
  [
    'Nike',
    'Nike',
    'McCann G. Agency',
    'McCann Agency',
    'Visual Communication',
    'Visual Communication',
  ].join('\n')
);
ok((plain.text.match(/^Nike$/gm) || []).length === 1, 'plain text Nike once');
ok((plain.text.match(/McCann/g) || []).length === 1, 'plain text McCann richest once');
ok((plain.text.match(/Visual Communication/g) || []).length === 1, 'plain text Visual Communication once');

const expDupes = dedupeExperienceEntries([
  { role: 'Designer', company: 'McCann G. Agency', dates: '2018–2020', bullets: ['Campaigns'] },
  { role: 'Designer', company: 'McCann Agency', dates: '2018-2020', bullets: [] },
  { role: 'Art Director', company: 'Nike', dates: '2019–Present', bullets: ['Retail'] },
  { role: 'Designer', company: 'Adobe', dates: '2020–2021', bullets: [] },
]);
ok(expDupes.filter((e) => /mccann/i.test(e.company)).length === 1, 'McCann experiences merged');
ok(expDupes.find((e) => /mccann/i.test(e.company))?.bullets?.length === 1, 'richest McCann bullets kept');
ok(expDupes.filter((e) => /nike/i.test(e.company)).length === 1, 'Nike experience kept');
ok(expDupes.filter((e) => /adobe/i.test(e.company)).length === 1, 'Adobe experience kept');

const frd = dedupeFinalResumeData({
  identity: { name: 'Alex' },
  experiences: expDupes,
  clients: clients,
  projects: projects,
  tools,
  skills: ['Illustration'],
  languages: [],
  education: [],
});
const dupAudit = auditFinalResumeDuplicates(frd);
ok(dupAudit.ok, `finalResumeData duplicate-free (${dupAudit.duplicates.length})`);
ok((frd.clients || []).length >= 3, `unique clients preserved (${(frd.clients || []).length})`);

console.log(failed ? '\nFAIL ocr-text-dedup' : '\nPASS ocr-text-dedup');
process.exit(failed ? 1 : 0);
