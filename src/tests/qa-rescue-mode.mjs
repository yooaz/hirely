#!/usr/bin/env node
/**
 * Rescue mode — never blank CV; uncertain text → À classer.
 */
import { applyRescueMode, applySafeFallback, ensureExportableCv } from '../core/parsing/safe-fallback.js';
import { cvDataIsRenderable } from '../core/parsing/rich-parser.js';

let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

const raw = `Yohann Azancot
Graphic Designer
yoaz@hotmail.fr
+33 6 49 43 48 39
Freelance Illustrator 2011 — Present
LISAA — Web Design
Photoshop, Illustrator`;

const empty = applyRescueMode({}, { cleanedText: raw });
ok(!empty.name || /yohann/i.test(empty.name), 'rescue does not invent invalid name');
ok(empty.email && /yoaz@/i.test(empty.email), 'rescue extracts email');
ok((empty.toClassify || []).length >= 3, 'rescue fills À classer');
ok(cvDataIsRenderable(empty), 'rescue CV is renderable');

const broken = applySafeFallback(
  { name: '', experience: [], toClassify: [] },
  { cleanedText: raw, rawText: raw }
);
ok(cvDataIsRenderable(broken), 'safe fallback renderable');
ok((broken.toClassify || []).length >= 2, 'safe fallback keeps lines');

const exportable = ensureExportableCv({ name: '', toClassify: [] }, { cleanedText: 'Line one\nLine two is longer here\nLine three also here' });
ok((exportable.toClassify || []).length >= 1, 'ensureExportable never empty');

process.exit(failed ? 1 : 0);
