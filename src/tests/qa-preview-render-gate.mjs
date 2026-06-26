#!/usr/bin/env node
/**
 * Preview render gate — blocks premium template on unsafe extraction garbage.
 */
import {
  assessPreviewRenderGate,
  looksLikeMergedExtractionBlob,
  isRawBlobExperience,
  sanitizeCvDataForCorrection,
} from '../core/validation/preview-render-gate.js';
import { fallbackRawTextCvData } from '../core/import/simple-import-mode.js';

let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

const merged =
  'Yohann Azancot yoaz@hotmail.fr +33649434839 Experience Freelance Illustrator Education LISAA Languages French English Skills Photoshop';
ok(looksLikeMergedExtractionBlob(merged), 'detects merged extraction blob');

const blobCv = fallbackRawTextCvData(merged, merged);
ok(blobCv.name === 'Nom à vérifier', 'fallback uses placeholder name');
const gate = assessPreviewRenderGate(blobCv, { rawTextLength: merged.length });
ok(gate.blockPremiumRender === true, 'blocks premium preview for placeholder + blob');
ok(gate.allowPremiumPreview === false, 'disallow premium preview');
ok(gate.issues.some((i) => i.code === 'unsafe_name'), 'flags unsafe name');
ok(isRawBlobExperience(blobCv), 'detects raw blob experience');

const clean = {
  name: 'Yohann Azancot',
  title: 'Graphic Designer',
  summary: 'Creative professional specializing in illustration.',
  experience: [
    { role: 'Freelance Illustrator', company: 'Independent', dates: '2011 — Present', bullets: [] },
    { role: 'Graphic Designer', company: 'Agency', dates: '2008 — 2011', bullets: [] },
  ],
  education: ['LISAA — Web Design'],
  skills: ['Illustration'],
};
const cleanGate = assessPreviewRenderGate(clean, { bridgeLocked: true, rawTextLength: 400 });
ok(cleanGate.allowPremiumPreview === true, 'allows premium preview for structured bridge-locked cv');

const sanitized = sanitizeCvDataForCorrection(blobCv);
ok(!sanitized.name, 'sanitized cv withholds placeholder name');
ok((sanitized.experience || []).length === 0, 'sanitized cv clears blob experience');

process.exit(failed ? 1 : 0);
