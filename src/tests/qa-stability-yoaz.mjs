#!/usr/bin/env node
/**
 * Stability acceptance — parser retention, experience, identity (Yoaz fixture).
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { cleanupOcrText } from '../core/parsing/ocr-cleanup.js';
import { cleanExtraction } from '../core/parsing/rich-parser.js';
import { runProductionExtractionPipeline } from '../core/pipeline/production-pipeline.js';
import { auditPipeline } from '../core/validation/audit.js';
import { measureTextRetention } from '../core/extraction/stages/extraction-archive.js';
import { NAME_UNCERTAIN_LABEL } from '../core/parsing/parser-recovery.js';
import { resumeDataFromCvData } from '../core/resume-data.js';
import { repairResumeDataFromRaw } from '../core/parsing/import-repair.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const fixturePath = join(root, 'tests/fixtures/yoaz-cv/fixture.txt');
const sample = existsSync(fixturePath)
  ? readFileSync(fixturePath, 'utf8')
  : `
Yohann Azancot
Graphic Designer · Illustrator
yoaz@hotmail.fr
WORK EXPERIENCE
Freelancer Illustrator, Graphic Designer
2011-2022
McCann G. Agency
2011
Internship
EDUCATION
LISAA
SKILLS
Illustration, Graphic design
`;

const cleaned = cleanupOcrText(sample);
const richClean = cleanExtraction(sample, { mode: 'strict' });
const pipe = await runProductionExtractionPipeline(richClean, { extractionMethod: 'paste' });
let cv = pipe.validatedCVData || {};
let rd = repairResumeDataFromRaw(resumeDataFromCvData(cv), {
  rawText: pipe.rawText || sample,
  cleanedText: pipe.cleanedText || richClean,
});
cv = {
  ...cv,
  name: rd.identity?.name,
  title: rd.identity?.title,
  phone: rd.identity?.phone,
  experience: (rd.experiences || []).map((e) =>
    [e.role, e.company, e.dates || e.startDate].filter(Boolean).join(' — ')
  ),
  education: rd.education,
  skills: rd.skills,
  unsorted: rd.unsorted,
};

const audit = auditPipeline(sample, richClean, cv);
const retention = measureTextRetention(sample, richClean, cv);

const parserRetention = 100 - (audit.stages.json.charLossPct ?? 100);
const pipelineLoss = audit.stages.final.charLossPct ?? 100;

console.log('parserRetention%', parserRetention);
console.log('pipelineLoss%', pipelineLoss);
console.log('retentionFromClean%', retention.retentionFromClean);
console.log('experience', rd.experiences?.length, 'unsorted', rd.unsorted?.length);
console.log('name', rd.identity?.name, 'title', rd.identity?.title);

ok(richClean.length > 0, 'cleanText > 0');
ok(parserRetention >= 80, `parser retains >= 80% (${parserRetention}%)`);
ok(pipelineLoss < 20, `pipeline loss < 20% (${pipelineLoss}%)`);
ok(retention.retentionFromClean >= 80, `clean retention >= 80% (${retention.retentionFromClean}%)`);
ok(
  (rd.experiences || []).length > 0 ||
    (rd.unsorted || []).some((l) => /\b(freelanc|mccann|graphic designer)\b/i.test(l)),
  'experience structured or queued in unsorted'
);
ok(!/\b(print\s*logo|vector\s*art|nature\s*music)\b/i.test(rd.identity?.title || ''), 'no random keyword title');
ok(!/\b(19|20)\d{2}\s*[-–—]/.test(rd.identity?.phone || ''), 'no date as phone');
ok(
  rd.identity?.name === NAME_UNCERTAIN_LABEL || /azancot/i.test(rd.identity?.name || ''),
  'name safe'
);

console.log('\nStability Yoaz QA OK');
