#!/usr/bin/env node
/**
 * PDF OCR cache — key, store rules, second import hits cache.
 */
import {
  clearPdfOcrCache,
  getPdfOcrCacheKey,
  getOrRunCachedPdfOcr,
  getCachedPdfOcrIfReady,
  resolveOcrPreprocessingMode,
} from '../core/extraction/pdf-ocr-cache-store.js';

let failed = 0;
let runs = 0;

function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

const file = {
  name: 'sample.pdf',
  size: 4096,
  lastModified: 1700000000000,
};

clearPdfOcrCache();

const ctx = { pageCount: 3, preprocessingMode: resolveOcrPreprocessingMode({ bestPass: true }) };
const key = getPdfOcrCacheKey(file, ctx);
ok(key.includes('sample.pdf|4096|'), 'cache key includes file fingerprint');
ok(key.endsWith('|3|bestpass'), 'cache key includes pageCount and mode');

const run = async () => {
  runs += 1;
  return { text: `cached-text-${runs}`, lines: [{ text: 'line', confidence: 88 }] };
};

const first = await getOrRunCachedPdfOcr(file, ctx, run);
ok(runs === 1, 'first import runs OCR once');
ok(first.text === 'cached-text-1', 'first import returns OCR text');

const second = await getOrRunCachedPdfOcr(file, ctx, run);
ok(runs === 1, 'second import uses cache — OCR not rerun');
ok(second.text === 'cached-text-1', 'second import returns cached text');

const ready = getCachedPdfOcrIfReady(file, ctx);
ok(ready?.text === 'cached-text-1', 'getCachedPdfOcrIfReady returns stored text');

clearPdfOcrCache(file);
const third = await getOrRunCachedPdfOcr(file, ctx, run);
ok(runs === 2, 'after clear, OCR runs again');
ok(third.text === 'cached-text-2', 'third import fresh OCR');

// Empty result must not overwrite successful cache
clearPdfOcrCache(file);
await getOrRunCachedPdfOcr(file, ctx, async () => ({
  text: 'good text here',
  lines: [{ text: 'a', confidence: 90 }],
}));
runs = 0;
const kept = await getOrRunCachedPdfOcr(file, ctx, async () => {
  runs += 1;
  return { text: '', lines: [] };
});
ok(runs === 0, 'cache hit — empty runner not invoked');
ok(kept.text === 'good text here', 'successful cache not replaced by empty attempt');

// Force retry bypasses cache
globalThis.HIRELY_FORCE_PDF_OCR_RETRY = true;
runs = 0;
await getOrRunCachedPdfOcr(file, ctx, async () => {
  runs += 1;
  return { text: 'retry-text', lines: [] };
});
ok(runs === 1, 'force retry reruns OCR');
ok(getCachedPdfOcrIfReady(file, ctx)?.text === 'retry-text', 'retry stores new text');

clearPdfOcrCache(file);
let emptyRuns = 0;
await getOrRunCachedPdfOcr(file, ctx, async () => {
  emptyRuns += 1;
  return { text: '', lines: [] };
});
emptyRuns = 0;
await getOrRunCachedPdfOcr(file, ctx, async () => {
  emptyRuns += 1;
  return { text: 'filled-after-empty', lines: [{ text: 'x', confidence: 70 }] };
});
ok(emptyRuns === 1, 'empty OCR is not cached — next import reruns');
ok(getCachedPdfOcrIfReady(file, ctx)?.text === 'filled-after-empty', 'successful run stored after empty miss');

clearPdfOcrCache();

console.log(failed ? `\n${failed} failed` : '\nAll OCR cache checks passed');
process.exit(failed ? 1 : 0);
