#!/usr/bin/env node
/**
 * OCR cleanup pipeline acceptance tests (pre createResumeFromText).
 */
import {
  applyOcrCleanupPipeline,
  repairFusedYearRangesInLine,
  repairContextualOcrWords,
  dedupeEducationEntries,
  isEducationGarbageLine,
  VERIFY_CONTENT_LABEL,
} from '../core/import/ocr-cleanup-pipeline.js';
import { createResumeFromText } from '../core/import/text-first-engine.js';

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
201223 Nike campaigns

EXPERIENCE
McCann Paris — Art Director
201223
Collaborated with Nike

FORMATION
LISAA — Design visuel — 2014–2016
LISAA — Design visuel — 2014–2016
|
•
NE TTT

COMPETENCES
Illustration, Brand design

OUTILS
Figma, Photoshop
`;

ok(repairFusedYearRangesInLine('201223') === '2012–2023', '201223 → 2012–2023');
ok(repairFusedYearRangesInLine('201203') === '201203', '201203 left unchanged (unsafe)');
ok(repairFusedYearRangesInLine('20122023') === '2012–2023', '8-digit fused years');

ok(repairContextualOcrWords('usrat/os illustrator').includes('Illustrator'), 'usrat/os → Illustrator in context');
ok(repairContextualOcrWords('Fraclancer').includes('Freelancer'), 'Fraclancer → Freelancer');

const cleaned = applyOcrCleanupPipeline(dirty);
ok(cleaned.text.includes('Freelancer'), 'pipeline fixes Fraclancer');
ok(cleaned.text.includes('2012–2023'), 'pipeline fixes fused years');
ok(!cleaned.text.includes('NE TTT'), 'noise dropped from main text');
ok(cleaned.text.split('\n').filter((l) => l === 'LISAA — Design visuel — 2014–2016').length === 1, 'deduped lines');

ok(isEducationGarbageLine('|'), 'pipe is education garbage');
ok(isEducationGarbageLine('•'), 'bullet-only is garbage');
ok(!isEducationGarbageLine('LISAA — Design visuel — 2014–2016'), 'real education kept');

const deduped = dedupeEducationEntries([
  { degree: 'MA Design', school: 'LISAA', dates: '2014–2016' },
  { degree: 'MA Design', school: 'LISAA', dates: '2014–2016' },
  { degree: 'BTS', school: 'ENSA', dates: '2012' },
]);
ok(deduped.length === 2, 'education entries deduped');

const resume = createResumeFromText(dirty);
ok(resume.education.length >= 1, 'education parsed');
ok(
  resume.education.filter((e) => /LISAA/i.test(`${e.degree} ${e.school}`)).length === 1,
  'no duplicated LISAA education blocks'
);
ok(
  !resume.education.some((e) => /^[\W|•]+$/.test(String(e.degree || ''))),
  'no garbage symbols in Formation'
);
ok(
  resume.skills.some((s) => /Illustration/i.test(s)) || resume.skills.length >= 1,
  'skills section populated'
);
ok(
  resume.unsorted.some((u) => /vérifier/i.test(u)) ||
    resume.meta?.verifyContent?.length ||
    !cleaned.uncertainLines.length,
  'uncertain routed or none'
);
ok(resume.meta?.ocrCleanupPipeline === true, 'pipeline meta stamped');

console.log(`\nOCR cleanup pipeline QA OK (${VERIFY_CONTENT_LABEL})`);
