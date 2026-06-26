#!/usr/bin/env node
/**
 * P0 — CLIENT_DETECTION_ENGINE QA.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import {
  CLIENT_DETECTION_ENGINE,
  CLIENT_ANCHOR_TARGETS,
  parseClientListLine,
  detectClientsFromText,
  runClientDetection,
  auditClientDetection,
} from '../core/parsing/client-detection-engine.js';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';
import { buildResumeData, resumeDataToCvData } from '../core/resume-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const FIXTURE = path.join(ROOT, 'tests/fixtures/creative-cv/fixture.txt');
const OUT = path.join(ROOT, 'tests/output/client-detection/report.json');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const text = fs.readFileSync(FIXTURE, 'utf8');

const bullet =
  '- Collaborated with recognized brands and cultural clients including Nike, Louis Vuitton, Marvel, Cadillac, Fortune, Converse, Pantone, Adobe, Arte and McCann.';
const listed = parseClientListLine(bullet);
ok(listed.includes('Nike'), 'parse list: Nike');
ok(listed.includes('Adobe'), 'parse list: Adobe');
ok(listed.includes('Marvel'), 'parse list: Marvel');
ok(!listed.some((c) => /mccann\./i.test(c)), 'parse list: no trailing punctuation blob');

const workedFor = `Worked for:\nNike\nAdobe\nMarvel\nApple\nGoogle\nMeta\nSony\nCadillac`;
const wf = detectClientsFromText(workedFor);
for (const brand of ['Nike', 'Adobe', 'Marvel', 'Apple', 'Google', 'Meta', 'Sony', 'Cadillac']) {
  ok(wf.some((c) => c.toLowerCase() === brand.toLowerCase()), `worked-for: ${brand}`);
}

const audit = auditClientDetection(text);
ok(audit.engine === CLIENT_DETECTION_ENGINE, 'audit engine id');
ok(audit.recallPct >= 50, `fixture anchor recall ${audit.recallPct}%`);
ok(audit.detected.includes('Nike') || audit.found.includes('Nike'), 'fixture Nike');

const parsed = runSectionEngineV2(text, { rawText: text });
ok(
  parsed.structured?.metadata?.clientDetection?.engine === CLIENT_DETECTION_ENGINE,
  'section engine wires client detection'
);

const rd = buildResumeData({
  importResult: { resumeData: parsed.structured },
  structured: parsed.structured,
  rawText: text,
  cleanedText: text,
});
ok((rd.clients || []).length >= 8, `resumeData.clients ${(rd.clients || []).length}`);
ok((rd.clients || []).some((c) => /^nike$/i.test(c)), 'resumeData has Nike');
ok((rd.clients || []).some((c) => /^adobe$/i.test(c)), 'resumeData has Adobe');

const cv = resumeDataToCvData(rd);
ok((cv.clients || []).length >= 6, `cvData.clients ${(cv.clients || []).length}`);

const code = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates.js'), 'utf8');
const sb = { console };
sb.window = sb.globalThis = sb;
vm.createContext(sb);
vm.runInContext(code, sb);
sb.initHirelyTemplates({
  esc: (s) => String(s || ''),
  sectionLabel: (k) => k,
  cvBlock: (t, h) => h || '',
  cvSkillsHtml: () => '',
  getPhotoHtml: () => '',
});
const html = sb.HirelyTemplates.render(cv, 'portfolio-artist');
ok(/cvSection--clients/.test(html), 'template renders clients section');
ok(/nike/i.test(html) && /marvel/i.test(html), 'template HTML includes client brands');

const forced = runClientDetection({ experiences: [], clients: [], unsorted: [] }, text, {
  forceCreative: true,
});
ok((forced.clients || []).length >= 8, `forced detection ${forced.clients.length} clients`);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      feature: 'CLIENT_DETECTION_ENGINE',
      generatedAt: new Date().toISOString(),
      engine: CLIENT_DETECTION_ENGINE,
      anchorTargets: CLIENT_ANCHOR_TARGETS,
      audit,
      resumeClients: rd.clients,
      cvClients: cv.clients,
      pipelineWired: Boolean(parsed.structured?.metadata?.clientDetection),
      pass: failed === 0,
    },
    null,
    2
  )
);

console.log(failed ? '\nFAIL client-detection' : '\nPASS client-detection');
process.exit(failed ? 1 : 0);
