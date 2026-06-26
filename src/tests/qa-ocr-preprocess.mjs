#!/usr/bin/env node
/**
 * OCR preprocess — unit tests (no browser required).
 */
import {
  detectContentBounds,
  detectMultiColumn,
  getOcrDpiScale,
  otsuThreshold,
  OCR_TARGET_DPI,
} from '../core/extraction/ocr-preprocess.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const w = 100;
const h = 80;
const gray = new Float32Array(w * h).fill(255);
for (let y = 10; y < 70; y++) {
  for (let x = 15; x < 85; x++) {
    gray[y * w + x] = 30;
  }
}
const bounds = detectContentBounds(gray, w, h);
ok(bounds.left >= 8 && bounds.top >= 6, 'margin detection crops content island');
ok(bounds.right - bounds.left < w - 10, 'margin detection narrows width');
ok(bounds.bottom - bounds.top < h - 10, 'margin detection narrows height');

const scale = getOcrDpiScale(612, 792, OCR_TARGET_DPI);
ok(scale > 3 && scale < 6, `300dpi scale in range (${scale.toFixed(2)})`);
const bigScale = getOcrDpiScale(4000, 5000, OCR_TARGET_DPI);
ok(bigScale < scale, 'large page caps scale to max edge');

const merged = new Float32Array(w * h).fill(255);
for (let y = 8; y < h - 8; y++) {
  for (let x = 5; x < 42; x++) merged[y * w + x] = 40;
  for (let x = 58; x < 95; x++) merged[y * w + x] = 40;
}
const cols = detectMultiColumn(merged, w, h);
ok(cols.columnCount >= 2, 'two-column layout detected');
ok(cols.suggestedPsm === '1', 'two-column suggests PSM 1');

const uniform = new Float32Array(w * h).fill(255);
for (let y = 8; y < h - 8; y++) {
  for (let x = 20; x < 80; x++) uniform[y * w + x] = 50;
}
const single = detectMultiColumn(uniform, w, h);
ok(single.columnCount === 1, 'single column layout');

const sample = new Float32Array(400);
for (let i = 0; i < 200; i++) sample[i] = 25;
for (let i = 200; i < 400; i++) sample[i] = 230;
const t = otsuThreshold(sample);
ok(t >= 25 && t <= 230, `otsu splits bimodal gray (t=${t})`);

process.exit(failed ? 1 : 0);
