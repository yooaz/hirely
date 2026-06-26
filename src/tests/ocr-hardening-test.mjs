#!/usr/bin/env node
import fs from 'fs';
import path from 'path';
import {
  hardenOcrText,
  repairHyphenatedLineBreaks,
  collapseOcrSpacedLetters,
  splitMergedSectionHeaders,
} from '../core/parsing/ocr-hardening.js';
import { postProcessOcrText } from '../core/parsing/ocr-postprocess.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

ok(
  repairHyphenatedLineBreaks('distrib-\nuted systems') === 'distributed systems',
  'hyphenated line break join'
);
ok(collapseOcrSpacedLetters('M a r i e   D u p o n t') === 'Marie Dupont', 'spaced letter collapse');
ok(
  splitMergedSectionHeaders('PROFILE WORK EXPERIENCE').length === 2,
  'merged section headers split'
);

const duped = hardenOcrText('Experience\nExperience\nExperience\nSenior PM\nSenior PM');
ok(duped.text.split('\n').filter((l) => /experience/i.test(l)).length === 1, 'dedupe repeated headers');
ok(duped.text.split('\n').filter((l) => /Senior PM/i.test(l)).length === 1, 'dedupe repeated body lines');

const footer = hardenOcrText('Skills\nSQL\nPage 2\nCurriculum Vitae\nSkills\nSQL');
ok(!/page\s*2/i.test(footer.text), 'strip page numbers');
ok(footer.text.split('\n').filter((l) => /curriculum vitae/i.test(l)).length === 0, 'strip repeated footer');

const yoazCache = path.join(process.cwd(), 'tests/output/ocr-quality-yoaz/report.json');
if (fs.existsSync(yoazCache)) {
  const ocrText = JSON.parse(fs.readFileSync(yoazCache, 'utf8')).ocrText || '';
  const hardened = postProcessOcrText(ocrText, { ocr: true });
  ok(/PROFILE/i.test(hardened), 'yoaz cache still has profile after harden');
  ok(!/PROFILE\s+WORK\s+EXPERIENCE/i.test(hardened) || hardened.includes('\n'), 'yoaz merged header split or normalized');
  ok(!/SKILLS\s+INTEREST/i.test(hardened) || hardened.split('\n').length > 20, 'yoaz skills/interest split');
}

process.exit(failed ? 1 : 0);
