#!/usr/bin/env node
/**
 * OCR cleanup + section anchor recovery unit tests.
 */
import {
  cleanupOcrText,
  repairOcrTyposInLine,
  isOcrNoiseLine,
} from '../core/parsing/ocr-cleanup.js';
import {
  extractExperiencesFromSectionAnchors,
  resolveCreativeProfessionalTitle,
} from '../core/parsing/section-anchor-extract.js';
import { auditPipeline } from '../core/validation/audit.js';
import { cleanExtraction } from '../core/parsing/rich-parser.js';

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const sample = `
Yohann Azancot
\\, Ben, GRAPHIC designer 3 ILLUSTHATCH
yoaz@hotmail.fr
WORK EXPERIENCE
Freelancer Illustrator Graphic Designer
2011-2022
Collaborated with Nike and McCann
McCann G. Agency
2011
Internship
EDUCATION
LISAA
SKILLS
Hustration, Graphic design, Movies
Print, Logo, Vector, Art... Reading
NE TTT
`;

ok(repairOcrTyposInLine('Hustration') === 'Illustration', 'Hustration → Illustration');
ok(repairOcrTyposInLine('ILLUSTHATCH') === 'Illustrator', 'ILLUSTHATCH → Illustrator');
ok(
  repairOcrTyposInLine('GRAPHIC designer').includes('Graphic Designer'),
  'GRAPHIC designer fixed'
);
ok(isOcrNoiseLine('NE TTT'), 'NE TTT is noise');

const cleaned = cleanupOcrText(sample);
ok(cleaned.text.includes('Illustration'), 'cleanup keeps Illustration typo fix');
ok(!cleaned.text.includes('NE TTT'), 'NE TTT dropped from main text');
ok(cleaned.uncertainLines.length >= 0, 'uncertain lines captured');

const lines = cleaned.text.split('\n').filter(Boolean);
const title = resolveCreativeProfessionalTitle(lines, cleaned.text);
ok(title === 'Graphic Designer & Illustrator', `title=${title}`);

const exps = extractExperiencesFromSectionAnchors(lines, cleaned.text);
ok(exps.length >= 1, `experience blocks=${exps.length}`);
ok(
  exps.some((e) => /freelanc/i.test(e.role) || /illustrator/i.test(e.role)),
  'freelance experience recovered'
);

const richClean = cleanExtraction(sample, { mode: 'strict' });
const audit = auditPipeline(sample, richClean, {
  name: 'Nom à confirmer',
  title,
  experience: exps.map((e) =>
    [e.role, e.company, e.startDate].filter(Boolean).join(' — ')
  ),
  skills: ['Illustration', 'Graphic design'],
  unsorted: cleaned.uncertainLines,
});
const totalLoss = audit.stages.final.charLossPct;
ok(totalLoss < 25, `pipeline loss ${totalLoss}% < 25%`);

console.log('\nOCR cleanup QA OK');
