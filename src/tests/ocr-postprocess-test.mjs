#!/usr/bin/env node
import { postProcessOcrText, looksLikeOcrText } from '../core/parsing/ocr-postprocess.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const noisy = 'EXPÉRlENCE\nMarie Dup0nt\ngraphiQue designer\nPhotosh0p · Illustrat0r';
ok(looksLikeOcrText('M a r i e   D u p o n t\nDesigner'), 'detects spaced-letter OCR');
const fixed = postProcessOcrText(noisy, { ocr: true });
ok(/EXPÉRIENCE/.test(fixed), 'section header repair');
ok(/graphique|Graphiste|Graphic/i.test(fixed), 'word hint graphique/graphiste/graphic');
ok(fixed.includes('Photoshop'), 'Photoshop fix');

const fs = await import('fs');
const path = await import('path');
const coreIndex = path.join(process.cwd(), 'src/core/index.js');
ok(fs.existsSync(coreIndex), 'src/core/index.js exists for Vercel static serve');

process.exit(failed ? 1 : 0);
