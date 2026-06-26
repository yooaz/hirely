#!/usr/bin/env node
/**
 * Section sanity — strict experience gate + UNSORTED fallback.
 */
import { classifyLineWithConfidence } from '../core/parsing/section-sanity.js';
import { collectSectionsOrderAgnostic } from '../core/parsing/section-mapper.js';
import { enrichBlocksFromTop } from '../core/parsing/rich-parser.js';
import { parseCV } from '../core/parsing/cv-parser.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const cases = [
  { line: 'Freelance Illustrator 2011-2022', bucket: 'experience', minConf: 80 },
  { line: 'Nike', bucket: 'clients', minConf: 80 },
  { line: 'Photoshop', bucket: 'tools', minConf: 80 },
  { line: 'Drawing', bucket: 'unsorted', maxConf: 79 },
  { line: 'Kraken Social Network Drawing', bucket: 'projects', minConf: 70 },
  { line: 'Elon Muse Cover', bucket: 'projects', minConf: 70 },
  { line: 'Personal Project', bucket: 'projects', minConf: 70 },
  { line: 'Random vague sentence without structure', bucket: 'unsorted', maxConf: 79 },
];

for (const c of cases) {
  const r = classifyLineWithConfidence(c.line);
  ok(r.bucket === c.bucket, `${c.line} → ${r.bucket} (${r.confidence}%) expected ${c.bucket}`);
  if (c.minConf != null) ok(r.confidence >= c.minConf, `${c.line} confidence >= ${c.minConf}`);
  if (c.maxConf != null) ok(r.confidence <= c.maxConf, `${c.line} confidence <= ${c.maxConf}`);
}

const MIXED = `Alex Doe
Designer

Nike
Photoshop
Drawing
Kraken Social Network Drawing
Freelance Illustrator 2011-2022
Something ambiguous maybe`;

const blocks = collectSectionsOrderAgnostic(MIXED, enrichBlocksFromTop);
ok(!(blocks.experience || []).includes('Nike'), 'Nike not in experience block');
ok(!(blocks.experience || []).includes('Photoshop'), 'Photoshop not in experience');
ok(!(blocks.experience || []).includes('Drawing'), 'Drawing not in experience');
ok((blocks.clients || []).some((l) => /nike/i.test(l)), 'Nike in clients');
ok((blocks.tools || []).some((l) => /photoshop/i.test(l)), 'Photoshop in tools');
ok((blocks.unsorted || []).some((l) => /^drawing$/i.test(l)), 'Drawing in unsorted (V2 precision)');
ok((blocks.projects || []).some((l) => /kraken/i.test(l)), 'Kraken in projects');
ok(
  (blocks.experience || []).some((l) => /freelance illustrator/i.test(l)),
  'Freelance line in experience'
);
ok((blocks.unsorted || []).length >= 1, 'ambiguous line in unsorted');

const cv = parseCV(MIXED);
ok(!cv.experience.some((e) => /^nike$/i.test(e)), 'parseCV: Nike not experience');
ok(!cv.experience.some((e) => /kraken/i.test(e)), 'parseCV: Kraken not experience');
ok(cv.clients.some((c) => /nike/i.test(c)), 'parseCV: Nike client');
ok(cv.projects.some((p) => /kraken/i.test(p)), 'parseCV: Kraken in projects');

process.exit(failed ? 1 : 0);
