#!/usr/bin/env node
/**
 * TEMPLATE ISOLATION — every template renders from resume object with partial data.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { PRODUCTION_TEMPLATE_IDS } from '../ui/templates/production-template-ids.mjs';
import { buildTemplateInputFromResume } from '../ui/templates/template-isolation.js';
import { createResumeFromText } from '../core/import/text-first-engine.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/template-isolation/report.json');

const PARTIAL_TEXT = `Jane Doe
Designer
jane@example.com

Profil
Creative professional with mixed import lines.`;

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
  );
}

function loadTemplates() {
  const code = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates.js'), 'utf8');
  const sandbox = { console, globalThis: {} };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const deps = {
    esc,
    sectionLabel: (k) =>
      ({
        experience: 'Experience',
        education: 'Education',
        skills: 'Skills',
        clients: 'Clients',
        tools: 'Tools',
        languages: 'Languages',
        projects: 'Projects',
        profile: 'Profile',
      }[k] || k),
    cvBlock: (title, html) =>
      html ? `<section class="cvSection"><h3 class="cvSectionTitle">${title}</h3><div class="cvSectionBody">${html}</div></section>` : '',
    cvSkillsHtml: (skills) =>
      `<p class="cvSkillLine">${skills.map(esc).join(' · ')}</p>`,
    getPhotoHtml: () => '',
  };
  sandbox.initHirelyTemplates(deps);
  return sandbox.HirelyTemplates;
}

let failed = 0;
const checks = [];
function ok(cond, id, detail = '') {
  checks.push({ id, pass: !!cond, detail });
  if (!cond) {
    failed++;
    console.error('FAIL', id, detail);
  } else console.log('OK', id, detail || '');
}

function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const resume = createResumeFromText(PARTIAL_TEXT);
  const cv = buildTemplateInputFromResume(resume);

  ok(cv && typeof cv === 'object', 'template_input_object');
  ok(cv._templateIsolation === true, 'template_isolation_flag');
  ok(cv.sectionConfidence === undefined, 'no_section_confidence');
  ok(cv.atsScore === undefined, 'no_ats_score');
  ok(String(cv.name || '').length > 0, 'partial_name', cv.name);
  ok(!(cv.skills || []).length, 'skills_optional');
  ok(!(cv.education || []).length, 'education_optional');

  const lowConfProfile = {
    ...cv,
    sectionConfidence: { skills: 12, education: 8, experience: 5, summary: 20 },
    atsScore: 41,
    ocrScore: 22,
    parserConfidence: 0.31,
  };

  const tpl = loadTemplates();
  const renders = {};
  for (const id of PRODUCTION_TEMPLATE_IDS) {
    const html = tpl.render(lowConfProfile, id);
    renders[id] = html;
    ok(html && html.length > 120, `render_${id}`, String(html.length));
    ok(!/cvEmptyState/.test(html), `no_empty_${id}`);
  }

  const report = {
    feature: 'TEMPLATE_ISOLATION',
    generatedAt: new Date().toISOString(),
    templateCount: PRODUCTION_TEMPLATE_IDS.length,
    checks,
    pass: failed === 0,
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(failed ? '\nFAIL template-isolation' : '\nPASS template-isolation');
  process.exit(failed ? 1 : 0);
}

main();
