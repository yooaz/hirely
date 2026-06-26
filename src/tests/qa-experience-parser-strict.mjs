#!/usr/bin/env node
/**
 * Strict experience parser — OCR-shaped creative CV, no hallucination.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  parseStrictExperiencesFromLines,
  lineIsSkillOrTagOnly,
  qualifiesStrictExperience,
} from '../core/parsing/experience-parser.js';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';
import { parseCV } from '../core/parsing/rich-parser.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const yoazOcr = `
Yohann Azancot
Graphic Designer & Illustrator
yoaz@hotmail.fr
+33 6 49 43 48 39
Portfolio
WORK EXPERIENCE
Freelancer Illustrator, Graphic Designer
2011-2022
McCann G. Agency
2011
Internship
PROFILE WORK EXPERIENCE
Music
LEA
product design, video game, architecture
Adobe
Packaging
EDUCATION
LISAA
Créapole
SKILLS
Illustration, Graphic design
`;

const lines = yoazOcr.split('\n').map((l) => l.trim()).filter(Boolean);
const { experiences, unclassified } = parseStrictExperiencesFromLines(lines);

ok(experiences.length >= 2 && experiences.length <= 4, `experience count ${experiences.length} (not hallucinated flood)`);
ok(
  experiences.some((e) => /\bfreelanc/i.test(e.role) && /2011/.test(e.startDate || e.dates || '')),
  'freelance illustrator with 2011 dates'
);
ok(
  experiences.some((e) => /\bmccann/i.test(e.company) && /2011/.test(e.startDate || e.dates || '')),
  'McCann agency with 2011'
);

const badRoles = experiences.filter(
  (e) =>
    /^(music|portfolio|adobe|packaging|lea|product design|architecture|graphic design)$/i.test(
      String(e.role || '').trim()
    ) ||
    /^(music|portfolio|adobe|packaging)$/i.test(String(e.company || '').trim())
);
ok(badRoles.length === 0, 'no skill/tag lines as experiences');

ok(lineIsSkillOrTagOnly('Music'), 'Music is tag-only');
ok(lineIsSkillOrTagOnly('Adobe'), 'Adobe is tag-only');
ok(!qualifiesStrictExperience({ role: 'Music', company: '', startDate: '' }), 'Music alone invalid');

const unclassifiedLow = unclassified.map((l) => l.toLowerCase());
ok(
  unclassifiedLow.some((l) => l === 'music' || l.includes('music')),
  'Music in unclassified'
);

const parsed = parseCV(yoazOcr);
const expStrings = (parsed.experience || []).join('\n').toLowerCase();
ok(!/\bmusic\b/.test(expStrings) || !/music.*2011/.test(expStrings), 'parseCv does not emit Music as job');

const engine = runSectionEngineV2(yoazOcr, { rawText: yoazOcr });
const engExp = engine.structured?.experiences || [];
const unsortedCareer = (engine.structured?.unsorted || []).join('\n');
const careerPreserved =
  engExp.length >= 1 || /\b(freelanc|intern|mccann|2011|agency)\b/i.test(unsortedCareer);
ok(
  careerPreserved,
  `section engine career preserved (exp=${engExp.length}, unsorted has career text)`
);
ok(
  !engExp.some((e) => /^music$/i.test(e.role) || /^adobe$/i.test(e.company)),
  'section engine no tag hallucinations'
);

const fixturePath = join(root, 'tests/fixtures/yoaz-cv/fixture.txt');
if (existsSync(fixturePath)) {
  const full = readFileSync(fixturePath, 'utf8');
  const allLines = full.split('\n').map((l) => l.trim()).filter(Boolean);
  const expIdx = allLines.findIndex((l) => /^experience$/i.test(l));
  const eduIdx = allLines.findIndex((l, i) => i > expIdx && /^education$/i.test(l));
  const expLines = expIdx >= 0 ? allLines.slice(expIdx + 1, eduIdx > expIdx ? eduIdx : undefined) : allLines;
  const fullStrict = parseStrictExperiencesFromLines(expLines, { experienceSectionLines: expLines });
  ok(fullStrict.experiences.length >= 2, `full yoaz fixture jobs (${fullStrict.experiences.length})`);
}

console.log('\nEXPERIENCE PARSER STRICT QA OK');
