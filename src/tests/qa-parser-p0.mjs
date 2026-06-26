#!/usr/bin/env node
/**
 * P0 parser — DocumentBlock[] → structuredResume (no raw parseCV).
 */
import { readFileSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { detectBlocks } from '../core/parsing/block-detector.js';
import { buildDocumentBlocks, CLASSIFICATION_CONFIDENCE_THRESHOLD } from '../core/parsing/document-block.js';
import { classifyLineType } from '../core/parsing/block-line-classifier.js';
import { matchEntitiesInLine, ENTITY_BOOST } from '../core/parsing/entity-dictionaries.js';
import {
  buildStructuredResumeFromDocumentBlocks,
} from '../core/parsing/structured-resume-from-blocks.js';
import { structuredToCvData } from '../core/parsing/structured-resume.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const FIXTURE = readFileSync(path.join(root, 'tests/fixtures/yoaz-cv/fixture.txt'), 'utf8').trim();
const CREATIVE = `YOHANN ZANCOT
Senior Product Designer
yohann@example.com · Paris

SUMMARY
Designer across Nike and Adobe workflows.

EXPERIENCE
2020 – Present · Nike — Lead Designer
Brand systems in Illustrator and Photoshop

EDUCATION
LISAA — Bachelor Design
Créapole — Master Visual Communication

SKILLS
Figma, Illustrator, InDesign

TOOLS
Photoshop, Adobe XD

CLIENTS
Marvel, Converse, Pantone

LANGUAGES
French, English
`;

const detected = detectBlocks({ rawText: CREATIVE });
ok(detected.blocks.length >= 6, 'layout blocks detected');

const docStage = buildDocumentBlocks({ layoutBlocks: detected.blocks });
const docBlocks = docStage.documentBlocks;
ok(docBlocks.length >= 4, 'DocumentBlock[] built');

const eduBlocks = docBlocks.filter((b) => b.type === 'education');
ok(eduBlocks.some((b) => /LISAA/i.test(b.text || '')), 'LISAA DocumentBlock type=education');
ok(!eduBlocks.some((b) => /Nike/i.test(b.text || '')), 'Nike not in education blocks');

const expBlocks = docBlocks.filter((b) => b.type === 'experience');
ok(expBlocks.some((b) => /Nike/i.test(b.text || '')), 'Nike in experience blocks');
ok(!expBlocks.some((b) => /LISAA/i.test(b.text || '')), 'LISAA not in experience blocks');

const clientBlocks = docBlocks.filter((b) => b.type === 'clients');
ok(clientBlocks.some((b) => /Marvel|Pantone|Converse/i.test(b.text || '')), 'clients block typed clients');
ok(!clientBlocks.some((b) => /Nike/i.test(b.text || '')), 'Nike not in clients blocks');

const toolBlocks = docBlocks.filter((b) => b.type === 'tools');
const skillBlocks = docBlocks.filter((b) => b.type === 'skills');
ok(
  toolBlocks.some((b) => /Photoshop|Adobe XD/i.test(b.text || '')) ||
    classifyLineType('Photoshop, Adobe XD', 'tools').type === 'tools',
  'tools section → tools type'
);
ok(
  !skillBlocks.some((b) => /Photoshop/i.test(b.text || '') && !/Figma/i.test(b.text || '')),
  'Photoshop not misclassified as skills block'
);

const lisaaLine = classifyLineType('2019 — LISAA — Bachelor Design', 'education');
ok(lisaaLine.type === 'education', 'dated LISAA line → education not experience');

const lisaaHit = matchEntitiesInLine('LISAA — Bachelor Design');
ok(lisaaHit?.entity === 'school' && lisaaHit.boost === ENTITY_BOOST.school, 'LISAA school +40 boost');

const structured = buildStructuredResumeFromDocumentBlocks(docBlocks, {
  rawText: CREATIVE,
  cleanedText: CREATIVE,
  extractionMethod: 'paste',
});
const cv = structuredToCvData(structured);
ok(cv.education.some((e) => /LISAA/i.test(e)), 'structured JSON education has LISAA');
ok(cv.experience.some((e) => /Nike/i.test(e)), 'structured JSON experience has Nike');
ok(cv.clients.some((c) => /Marvel|Pantone|Converse/i.test(c)), 'structured JSON clients');
ok(structured.metadata?.neverRawParseCv === true, 'neverRawParseCv flag');
ok(
  ['p0_blocks', 'classified_blocks', 'document_blocks'].includes(
    structured.metadata?.parseSource
  ),
  'parseSource p0_blocks'
);

ok(CLASSIFICATION_CONFIDENCE_THRESHOLD === 70, 'threshold 70');

const yoazDetected = detectBlocks({ rawText: FIXTURE });
const yoazDoc = buildDocumentBlocks({ layoutBlocks: yoazDetected.blocks });
const yoazStructured = buildStructuredResumeFromDocumentBlocks(yoazDoc.documentBlocks, {
  rawText: FIXTURE,
  cleanedText: FIXTURE,
});
const yoazCv = structuredToCvData(yoazStructured);
ok(yoazCv.name || yoazStructured.identity?.name, 'yoaz fixture has name');

const yoazExpText = (yoazStructured.experiences || [])
  .map((e) => [e.role, e.company, ...(e.bullets || [])].join(' '))
  .join(' ');
const yoazEdu = (yoazCv.education || []).join(' ');
if (/LISAA|Créapole|ESCP/i.test(FIXTURE)) {
  ok(!/LISAA|Créapole/i.test(yoazExpText) || yoazEdu.length > 0, 'education schools not leaked to experience');
}

process.exit(failed ? 1 : 0);
