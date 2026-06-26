#!/usr/bin/env node
/**
 * PHOTO_SYSTEM_V2 — audit QA (safe zones, auto crop, no overlap).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  PHOTO_SYSTEM_V2,
  PHOTO_SAFE_ZONE,
  inferPortraitFocusPoint,
  computeSquareCropRect,
  buildPhotoImgHtml,
  sanitizePhotoCrop,
} from '../ui/pro/photo-system-v2.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
const css = fs.readFileSync(path.join(ROOT, 'src/ui/pro/photo-system-v2.css'), 'utf8');
const proJs = fs.readFileSync(path.join(ROOT, 'src/ui/pro/pro-cv-features.js'), 'utf8');

ok(PHOTO_SYSTEM_V2 === 'PHOTO_SYSTEM_V2', 'engine version');
ok(PHOTO_SAFE_ZONE.maxSizePx === 88, 'safe zone max 88px');
ok(PHOTO_SAFE_ZONE.textGapPx >= 12, 'text gap safe zone');

const portrait = inferPortraitFocusPoint(800, 1200);
ok(portrait.y === PHOTO_SAFE_ZONE.portraitFocusY, 'portrait face focus Y');

const rect = computeSquareCropRect(1000, 1500, { x: 50, y: 38 }, 1);
ok(rect.size > 0 && rect.sx >= 0 && rect.sy >= 0, 'square crop rect');

const markup = buildPhotoImgHtml('data:image/jpeg;base64,abc', { x: 40, y: 60, zoom: 2 });
ok(markup.includes('cvPhotoWrap--safe'), 'safe wrap class');
ok(!markup.includes('transform:scale'), 'no scale transform');
ok(markup.includes('object-position:40% 60%'), 'object position preserved');

const sanitized = sanitizePhotoCrop({ zoom: 2.5, x: 120, y: -5 });
ok(sanitized.zoom === 1 && sanitized.x === 100 && sanitized.y === 0, 'sanitize crop');

ok(/overflow:\s*hidden/.test(css), 'overflow hidden on wrap');
ok(/transform:\s*none/.test(css), 'transform none in CSS');
ok(html.includes('photo-system-v2.js'), 'index loads photo-system-v2.js');
ok(html.includes('photo-system-v2.css'), 'index links photo-system-v2.css');
ok(html.includes('HirelyPhotoSystemV2'), 'getPhotoHtml uses V2');
ok(!/transform:scale\(\$\{crop\.zoom\}\)/.test(html), 'index getPhotoHtml no scale');
ok(proJs.includes('autoCropPhotoDataUrl'), 'pro upload auto crop');
ok(!/img\.style\.transform = `scale/.test(proJs), 'applyPhotoCropStyle no scale');

console.log(failed ? `\n${failed} check(s) failed` : '\nAll PHOTO_SYSTEM_V2 checks passed');
process.exit(failed ? 1 : 0);
