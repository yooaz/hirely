#!/usr/bin/env node
/**
 * Semantic sections — role/title without Experience: header; jobs from date lines only.
 */
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';
import {
  classifySemanticLine,
  isSemanticRoleLine,
} from '../core/parsing/semantic-line-classifier.js';
import { SEMANTIC_LINE } from '../core/parsing/semantic-line-types.js';

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const noHeaderCv = `Yohann Azancot
Graphic Designer
yoaz@hotmail.fr
Paris, France

2011–2014 McCann Paris
Lead Illustrator
Directed visual campaigns for luxury brands

2015–2018 Freelance
Senior Art Director
Brand identity and packaging

EDUCATION
ESAG Paris
Graphic Design

SKILLS
Illustrator, Photoshop, InDesign`;

ok(isSemanticRoleLine('Graphic Designer'), 'Graphic Designer is semantic role');
const roleHit = classifySemanticLine('Graphic Designer', { lineIndex: 1 });
ok(
  roleHit.semantic === SEMANTIC_LINE.IDENTITY_ROLE,
  `role line classified as IDENTITY_ROLE (${roleHit.semantic})`
);

const result = runSectionEngineV2(noHeaderCv, { rawText: noHeaderCv });
const { structured, sectionBlocks } = result;

ok(structured.metadata?.neverRegexFirstParse === true, 'neverRegexFirstParse metadata');
ok(
  /semantic/i.test(String(structured.metadata?.sectionParseArchitecture || structured.metadata?.parseMode || '')),
  'semantic parse architecture'
);

const title = String(structured.identity?.title || '').toLowerCase();
ok(
  title.includes('graphic') || title.includes('designer'),
  `title from role line without Experience header (${structured.identity?.title})`
);

ok(
  sectionBlocks.some((b) => String(b.classifyReason || '').startsWith('semantic')),
  'section blocks from semantic inference'
);
ok((structured.experiences || []).length >= 2, `experiences without Experience: header (${structured.experiences?.length})`);

console.log('\nSEMANTIC_SECTIONS QA OK — title:', structured.identity?.title, 'exp:', structured.experiences?.length);
