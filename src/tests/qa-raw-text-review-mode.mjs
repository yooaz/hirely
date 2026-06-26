#!/usr/bin/env node
/**
 * Raw text review mode — bad OCR must not pollute Formation / Experience.
 */
import { createResumeFromText } from '../core/import/text-first-engine.js';
import {
  bootstrapRawTextReview,
  getRawTextVerifyItems,
  applyRawTextVerifyAction,
  resumeDataForCleanPreview,
  shouldActivateRawTextReviewMode,
  RAW_TEXT_VERIFY_LABEL,
} from '../core/import/raw-text-review-mode.js';

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const dirty = `
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

const resume = createResumeFromText(dirty);
ok(shouldActivateRawTextReviewMode({ ocrConfidence: 42, resumeData: resume }), 'activates on low OCR + verify lines');

const boot = bootstrapRawTextReview(resume, { ocrConfidence: 42 });
ok(boot.active, 'bootstrap active');
ok(boot.queueLength > 0, 'verify queue populated');
ok(
  !boot.resumeData.education.some((e) => /^[\W|•]+$/.test(String(e.degree || e.school || ''))),
  'garbage stripped from Formation'
);
ok(
  !boot.resumeData.experiences.some((e) =>
    (e.bullets || []).some((b) => /NE TTT/i.test(String(b)))
  ),
  'garbage stripped from Experience bullets'
);

const items = getRawTextVerifyItems(boot.resumeData);
ok(items.length > 0, 'UI items from queue');
ok(items.some((it) => /NE TTT/i.test(it.text)), 'NE TTT in verify queue');

const preview = resumeDataForCleanPreview(boot.resumeData);
ok(
  !preview.education.some((e) => /^[\W|•]+$/.test(String(e.degree || ''))),
  'preview Formation clean'
);
ok(
  !preview.experiences.some((e) => (e.bullets || []).some((b) => /NE TTT/i.test(String(b)))),
  'preview Experience clean'
);

const afterDelete = applyRawTextVerifyAction(
  boot.resumeData,
  items.find((it) => /NE TTT/i.test(it.text))?.id,
  'delete'
);
ok(getRawTextVerifyItems(afterDelete).every((it) => !/NE TTT/i.test(it.text)), 'delete removes line');

const moveItem = getRawTextVerifyItems(boot.resumeData)[0];
const afterMove = applyRawTextVerifyAction(boot.resumeData, moveItem.id, 'move', 'skill');
ok((afterMove.skills || []).length >= 1, 'move adds to skills');

ok(boot.resumeData.meta.rawTextReview.label === RAW_TEXT_VERIFY_LABEL || boot.resumeData.meta.verifyContentLabel, 'verify label set');

console.log('qa-raw-text-review-mode: all passed');
