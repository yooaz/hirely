#!/usr/bin/env node
/**
 * V1 extraction honest mode — weak OCR must yield usable draft, not broken CV.
 */
import { createResumeFromText } from '../core/import/text-first-engine.js';
import { buildResumeData } from '../core/resume-data.js';
import {
  applyExtractionHonestMode,
  EXTRACTED_VERIFY_LABEL,
  PARTIAL_READ_WARNING,
  isWeakOcrQuality,
} from '../core/import/extraction-honest-mode.js';
import { bootstrapRawTextReview } from '../core/import/raw-text-review-mode.js';

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const badScan = `
Yohann Azancot
Graphic Designer
yoaz@hotmail.fr

PROFIL
Fraclancer Illustrator usrat/os

EXPERIENCE
McCann Paris — Art Director
NE TTT
Collaborated with Nike

FORMATION
LISAA — Design visuel — 2014–2016
|
•
NE TTT

COMPETENCES
Illustration
`;

ok(isWeakOcrQuality(42), 'weak OCR threshold');
ok(!isWeakOcrQuality(72), 'strong OCR not weak');

const honest = createResumeFromText(badScan, { ocrConfidence: 42 });
ok(honest.meta?.extractionHonestMode === true, 'honest mode flag set');
ok(honest.meta?.partialReadWarning === PARTIAL_READ_WARNING, 'partial read warning');
ok(honest.meta?.verifyContentLabel === EXTRACTED_VERIFY_LABEL, 'verify bucket label');
ok(String(honest.identity?.name || '').includes('Yohann'), 'name detected');
ok(
  !honest.education.some((e) => /^[\W|•]+$/.test(String(e.degree || e.school || ''))),
  'no garbage Formation rows'
);
ok(
  !honest.experiences.some((e) => (e.bullets || []).some((b) => /NE TTT/i.test(String(b)))),
  'no NE TTT in Experience'
);
ok(
  (honest.unsorted || []).some((l) => /NE TTT/i.test(String(l))),
  'uncertain lines in verify bucket'
);
ok((honest.unsorted || []).length > 0, 'verify bucket populated');

const aggressive = createResumeFromText(badScan);
ok(aggressive.meta?.extractionHonestMode !== true, 'no honest mode without low OCR score');

const repaired = buildResumeData({
  structured: {
    identity: { name: 'Yohann Azancot', title: 'Graphic Designer' },
    summary: 'NE TTT',
    experiences: [{ role: 'NE TTT', company: 'McCann', bullets: ['|', '•'] }],
    education: [{ degree: '|', school: 'LISAA', dates: '2014' }],
    skills: ['Illustration', 'NE TTT'],
    unsorted: [],
  },
  rawText: badScan,
  cleanedText: badScan,
  ocrConfidence: 35,
});
ok(repaired.meta?.extractionHonestMode === true, 'buildResumeData applies honest mode');
ok(
  !repaired.education.some((e) => String(e.degree || '').trim() === '|'),
  'buildResumeData strips garbage education'
);

const boot = bootstrapRawTextReview(honest, { ocrConfidence: 42 });
ok(boot.active, 'raw text review compatible with honest mode');
ok(
  boot.resumeData.meta?.rawTextReview?.label === EXTRACTED_VERIFY_LABEL ||
    boot.resumeData.meta?.verifyContentLabel === EXTRACTED_VERIFY_LABEL,
  'review UI uses extracted verify label'
);

const post = applyExtractionHonestMode(aggressive, { ocrConfidence: 40 });
ok(post.meta?.extractionHonestMode === true, 'post-hoc honest strip works');

console.log('qa-extraction-honest-mode: all passed');
