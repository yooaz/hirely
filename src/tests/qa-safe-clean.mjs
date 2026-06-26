#!/usr/bin/env node
/**
 * Safe clean — preserves content; does not create "Ce Frei Re" corruption.
 */
import { safeClean, strictClean, measureCleanLoss, isProtectedContentLine } from '../core/parsing/clean.js';
import { cleanExtraction } from '../core/parsing/rich-parser.js';
import { cleanTextWithRejected } from '../core/parsing/line-cleaner.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const spacedBad = 'C e   F r e i   R e';
const safeBad = safeClean(spacedBad);
ok(!/Ce Frei Re/i.test(safeBad), 'safeClean does not collapse short spaced tokens to Ce Frei Re');
ok(safeBad.includes('C e') || safeBad.includes('F r e i'), 'safeClean keeps spaced OCR letters');

const spacedGood = 'F r e e l a n c e   I l l u s t r a t o r   2 0 1 1 - 2 0 2 2';
const safeGood = safeClean(spacedGood);
ok(safeGood.includes('F r') || safeGood.includes('Freelance') || /illustrator/i.test(safeGood), 'safeClean keeps freelance title content');

const portfolio = 'Kraken Social Network Drawing';
ok(isProtectedContentLine(portfolio), 'project line protected');
ok(!cleanTextWithRejected(portfolio, { mode: 'safe' }).rejectedLines.includes(portfolio), 'safe mode keeps project line');

const client = 'Nike';
ok(isProtectedContentLine(client), 'client name protected');

const school = 'HEC Paris';
ok(isProtectedContentLine(school), 'school protected');

const garbage = '[body]';
const { rejectedLines } = cleanTextWithRejected(`Line one\n${garbage}\nMarvel`, { mode: 'safe' });
ok(rejectedLines.some((l) => /\[body\]/i.test(l)), 'safe mode drops [body] placeholder');

const rawCv = `Freelance Illustrator 2011-2022
Nike
Photoshop
Kraken Social Network Drawing
Drawing
[header]
yoaz@hotmail.fr`;
const cleaned = cleanExtraction(rawCv);
const loss = measureCleanLoss(rawCv, cleaned);
ok(loss.lossPct <= 20, `cleanExtraction retains content (loss ${loss.lossPct}%)`);
ok(/Freelance|Illustrator|2011/i.test(cleaned), 'experience line kept');
ok(/Nike/i.test(cleaned), 'client kept');
ok(/Kraken/i.test(cleaned), 'project kept');

const strict = strictClean(spacedBad);
ok(/Ce Frei Re/i.test(strict) || /Frei/i.test(strict), 'strictClean may still transform spaced letters (debug only)');

process.exit(failed ? 1 : 0);
