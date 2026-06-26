#!/usr/bin/env node
/**
 * Unit tests — section mapping (order-independent rubriques).
 */
import { parseCV } from '../core/parsing/cv-parser.js';
import { collectSectionsOrderAgnostic } from '../core/parsing/section-mapper.js';
import { enrichBlocksFromTop } from '../core/parsing/rich-parser.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

/** Education and skills BEFORE experience — must still map correctly. */
const UNORDERED_CV = `Jean Martin
Data Analyst
jean.martin@email.com

Education
Master Statistics — Sorbonne — 2018

Skills
Python, SQL, Tableau, Machine learning

Experience
Data Analyst — FinTech Co — 2019 – Present
- Built dashboards used by leadership weekly.

Languages
French — native
English — fluent`;

const blocks = collectSectionsOrderAgnostic(UNORDERED_CV, enrichBlocksFromTop);
ok((blocks.education || []).length >= 1, 'education block populated');
ok((blocks.experience || []).length >= 1, 'experience block populated');
ok((blocks.skills || []).length >= 1, 'skills block populated');

const cv = parseCV(UNORDERED_CV);
ok(/jean/i.test(cv.name || ''), `name: ${cv.name}`);
ok((cv.experience || []).length >= 1, 'parseCV experience');
ok((cv.education || []).length >= 1, 'parseCV education');
ok((cv.skills || []).length + (cv.tools || []).length >= 2, 'parseCV skills/tools from unordered CV');

process.exit(failed ? 1 : 0);
