#!/usr/bin/env node
/**
 * Native text trust — corrupt layer rejection for hybrid/timeout recovery.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { getDocument } from 'pdfjs-dist/legacy/build/pdf.mjs';
import { extractNativePdfLines } from '../core/extraction/pdf-lines-native.js';
import {
  isCorruptNativeText,
  isNativePageTrusted,
  isNativeTextRecoverable,
  nativeTrustAudit,
} from '../core/extraction/native-text-trust.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const pdfPath = path.join(root, 'tests/fixtures/yoaz-pdf-benchmark/document.pdf');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const pdf = await getDocument({ data: new Uint8Array(fs.readFileSync(pdfPath)) }).promise;
const { pages } = await extractNativePdfLines(pdf);
const allNative = pages.map((p) => p.lines.map((l) => l.text).join('\n')).join('\n\n');

ok(!isNativePageTrusted(pages[0]), 'page 1 image page not native-trusted');
ok(!isNativePageTrusted(pages[1]), 'page 2 corrupt native not trusted');
ok(isCorruptNativeText(pages[1].lines.map((l) => l.text).join('\n')), 'page 2 text marked corrupt');
ok(!isNativeTextRecoverable(allNative, pages.flatMap((p) => p.lines)), 'yoaz all-native not recoverable on timeout');
ok(!nativeTrustAudit(allNative).recoverable, 'nativeTrustAudit rejects yoaz corrupt layer');

const clean = 'Yohann Azancot\nyoaz@hotmail.fr\n+33649434839\nExperience\nFreelance Illustrator\n2018 — Present';
ok(isNativeTextRecoverable(clean), 'clean synthetic native recoverable');

process.exit(failed ? 1 : 0);
