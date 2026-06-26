#!/usr/bin/env node
/**
 * P1 — PROJECTS_ENGINE QA.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import {
  PROJECTS_ENGINE,
  PROJECT_ANCHOR_TARGETS,
  parseProjectLine,
  detectProjectsFromText,
  runProjectsExtraction,
  auditProjectsExtraction,
  extractProjectClientAndTitle,
} from '../core/parsing/projects-engine.js';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';
import { buildResumeData, resumeDataToCvData } from '../core/resume-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const FIXTURE = path.join(ROOT, 'tests/fixtures/projects-creative-rich.txt');
const OUT = path.join(ROOT, 'tests/output/projects-engine/report.json');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const text = fs.readFileSync(FIXTURE, 'utf8');

for (const anchor of PROJECT_ANCHOR_TARGETS) {
  const parsed = parseProjectLine(anchor);
  ok(Boolean(parsed), `parse anchor: ${anchor}`);
  ok(parsed?.client && parsed?.title, `anchor fields: ${anchor}`);
}

const ps = parseProjectLine('PlayStation God of War Poster');
ok(ps?.client === 'PlayStation', `client PlayStation (${ps?.client})`);
ok(/god\s+of\s+war/i.test(ps?.title || ''), `title God of War (${ps?.title})`);

const adobe = parseProjectLine('Adobe Max Campaign · 2023 · Art Director');
ok(adobe?.client === 'Adobe', 'client Adobe');
ok(adobe?.year === '2023', 'year 2023');
ok(/art\s+director/i.test(adobe?.role || ''), 'role Art Director');

const marvel = extractProjectClientAndTitle('Marvel Black Panther Poster');
ok(marvel.client === 'Marvel', 'marvel client');
ok(/black\s+panther/i.test(marvel.title), 'marvel title');

const detected = detectProjectsFromText(text);
ok(detected.length >= 4, `detected ${detected.length} projects from fixture`);

const audit = auditProjectsExtraction(text);
ok(audit.engine === PROJECTS_ENGINE, 'audit engine id');
ok(audit.recallPct >= 75, `anchor recall ${audit.recallPct}%`);

const parsed = runSectionEngineV2(text, { rawText: text });
ok(
  parsed.structured?.metadata?.projectsExtraction?.engine === PROJECTS_ENGINE,
  'section engine wires projects extraction'
);

const rd = buildResumeData({
  importResult: { resumeData: parsed.structured },
  structured: parsed.structured,
  rawText: text,
  cleanedText: text,
});
ok((rd.projects || []).length >= 4, `resumeData.projects ${(rd.projects || []).length}`);
ok((rd.projects || []).some((p) => /playstation|god\s+of\s+war/i.test(p)), 'resume has PlayStation project');
ok((rd.projects || []).some((p) => /adobe/i.test(p) && /max|campaign/i.test(p)), 'resume has Adobe Max');
ok((rd.projects || []).some((p) => /marvel|black\s+panther/i.test(p)), 'resume has Marvel project');
ok((rd.projects || []).some((p) => /visa|fifa/i.test(p)), 'resume has Visa FIFA');

const cv = resumeDataToCvData(rd);
ok((cv.projects || []).length >= 4, `cvData.projects ${(cv.projects || []).length}`);

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
ok(/cvSection--projects/.test(html), 'template renders projects section');
ok(/god\s+of\s+war/i.test(html) && /marvel/i.test(html), 'template HTML includes project titles');

const forced = runProjectsExtraction({ experiences: [], projects: [], unsorted: [], identity: { title: 'Art Director' } }, text, {
  forceCreative: true,
});
ok((forced.projects || []).length >= 4, `forced extraction ${forced.projects.length} projects`);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      feature: 'PROJECTS_ENGINE',
      generatedAt: new Date().toISOString(),
      engine: PROJECTS_ENGINE,
      anchorTargets: PROJECT_ANCHOR_TARGETS,
      audit,
      resumeProjects: rd.projects,
      cvProjects: cv.projects,
      pipelineWired: Boolean(parsed.structured?.metadata?.projectsExtraction),
      pass: failed === 0,
    },
    null,
    2
  )
);

console.log(failed ? '\nFAIL projects-engine' : '\nPASS projects-engine');
process.exit(failed ? 1 : 0);
