#!/usr/bin/env node
/**
 * P0 — No placeholder / uncertain copy in final CV preview or PDF.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { resumeDataToCvData } from '../core/resume-data.js';
import {
  FINAL_CV_FORBIDDEN_PLACEHOLDERS,
  FINAL_CV_PLACEHOLDER_GUARD,
  isFinalCvPlaceholder,
  auditFinalCvPlaceholders,
  sanitizeFinalCvPlaceholdersBeforeCommit,
} from '../core/validation/final-cv-placeholder-guard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/no-placeholder-content/report.json');

const FIXTURES = [
  { id: 'creative-cv', file: 'tests/fixtures/creative-cv/fixture.txt' },
  { id: 'yoaz-cv', file: 'tests/fixtures/yoaz-cv/fixture.txt' },
  { id: 'creative-experience-rich', file: 'tests/fixtures/creative-experience-rich.txt' },
  { id: 'designer-cv-rich', file: 'tests/fixtures/designer-cv-rich.txt' },
];

const TEMPLATE_IDS = ['ats', 'agency-designer', 'luxury-minimal'];

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
  );
}

function loadHirelyTemplates() {
  const code = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates.js'), 'utf8');
  const sandbox = { console };
  sandbox.window = sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  sandbox.initHirelyTemplates({
    esc,
    sectionLabel: (k) =>
      ({
        profile: 'Profile',
        experience: 'Experience',
        education: 'Education',
        skills: 'Skills',
        clients: 'Clients',
        tools: 'Tools',
        languages: 'Languages',
        projects: 'Projects',
      })[k] || k,
    cvBlock: (title, html) =>
      html
        ? `<section class="cvSection"><h3 class="cvSectionTitle">${title}</h3><div class="cvSectionBody">${html}</div></section>`
        : '',
    cvSkillsHtml: (skills) => `<p class="cvSkillLine">${skills.map(esc).join(' · ')}</p>`,
    getPhotoHtml: () => '',
  });
  return sandbox.HirelyTemplates;
}

function collectContentLines(fr = {}) {
  const lines = [];
  if (fr.summary) lines.push(fr.summary);
  for (const field of ['education', 'skills', 'tools', 'languages', 'clients', 'projects', 'suggestions']) {
    lines.push(...(fr[field] || []));
  }
  for (const exp of fr.experiences || []) {
    lines.push(exp.role, exp.company, exp.dates, exp.description, ...(exp.bullets || []));
    lines.push([exp.role, exp.company, exp.dates].filter(Boolean).join(' — '));
  }
  for (const field of ['name', 'title', 'location']) {
    lines.push(fr.identity?.[field]);
  }
  return lines.map((x) => String(x || '').trim()).filter(Boolean);
}

function htmlHasPlaceholder(html) {
  const body = String(html || '')
    .replace(/<h[1-6][^>]*class="[^"]*cvSectionTitle[^"]*"[^>]*>[\s\S]*?<\/h[1-6]>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '')
    .replace(/<[^>]+>/g, '\n');
  const lines = body.split('\n').map((x) => x.trim()).filter(Boolean);
  return lines.filter((line) => isFinalCvPlaceholder(line) || /\bà\s+confirmer\b/i.test(line));
}

ok(FINAL_CV_PLACEHOLDER_GUARD === 'FINAL_CV_PLACEHOLDER_GUARD_V1', 'guard active');
for (const label of FINAL_CV_FORBIDDEN_PLACEHOLDERS) {
  ok(isFinalCvPlaceholder(label), `detects placeholder: ${label}`);
}
ok(isFinalCvPlaceholder('Company à confirmer - 2011-2014'), 'detects composite company placeholder line');
ok(!isFinalCvPlaceholder('McCann Paris'), 'allows real company');

const synthetic = sanitizeFinalCvPlaceholdersBeforeCommit({
  identity: { name: 'Nom à confirmer', title: 'Designer' },
  summary: 'Information non détectée',
  experiences: [
    {
      role: 'Art Director',
      company: 'Company à confirmer',
      dates: '2011-2014',
      bullets: ['Campaign work'],
    },
    { role: 'Role à confirmer', company: 'Nike', dates: '2015-2018', bullets: [] },
    { role: 'Designer', company: 'McCann', dates: '2019-2022', bullets: ['Packaging'] },
  ],
  skills: ['Illustration', 'skills'],
});

ok(synthetic.finalResumeData.experiences.length === 1, 'keeps only real experience');
ok(synthetic.finalResumeData.experiences[0].company === 'McCann', 'keeps McCann experience');
ok(auditFinalCvPlaceholders(synthetic.finalResumeData).violations.length === 0, 'synthetic finalResumeData clean');
ok(synthetic.reviewItems.length >= 2, 'queues placeholder experiences for review');
ok(
  synthetic.reviewItems.some((r) => r.reason === 'Entreprise à confirmer'),
  'review item uses Entreprise à confirmer reason'
);
ok(!collectContentLines(synthetic.finalResumeData).some((l) => isFinalCvPlaceholder(l)), 'no placeholder lines in content');

const Templates = loadHirelyTemplates();
const audits = [];

for (const fixture of FIXTURES) {
  const raw = fs.readFileSync(path.join(ROOT, fixture.file), 'utf8');
  const imported = await runHirelyImportFromText(raw, {
    source: fixture.id,
    extractionMethod: 'paste',
  });
  const sanitized = sanitizeResumeForDisplay(imported.resumeData || {});
  const built = buildFinalResumeData(sanitized, {
    silent: true,
    existingReview: imported.reviewQueue || [],
  });
  const fr = built.finalResumeData || {};
  const cv = built.cvData || resumeDataToCvData(fr, { skipNormalize: true });

  const contentHits = collectContentLines(fr).filter(
    (line) => isFinalCvPlaceholder(line) || /\bà\s+confirmer\b/i.test(line)
  );
  const cvHits = collectContentLines({
    identity: { name: cv.name, title: cv.title, location: cv.location },
    summary: cv.summary,
    experiences: (cv.experience || []).map((e) =>
      typeof e === 'string' ? { description: e } : e
    ),
    skills: cv.skills,
    tools: cv.tools,
    clients: cv.clients,
    education: cv.education,
    languages: cv.languages,
    projects: cv.projects,
  }).filter((line) => isFinalCvPlaceholder(line) || /\bà\s+confirmer\b/i.test(line));

  const templateHits = [];
  for (const templateId of TEMPLATE_IDS) {
    const html = Templates.render(cv, templateId);
    const hits = htmlHasPlaceholder(html);
    templateHits.push({ templateId, hits });
    ok(hits.length === 0, `${fixture.id}/${templateId} preview HTML placeholder-free (${hits.join('; ') || 'clean'})`);
  }

  ok(contentHits.length === 0, `${fixture.id} finalResumeData placeholder-free (${contentHits.join('; ') || 'clean'})`);
  ok(cvHits.length === 0, `${fixture.id} cvData/pdf path placeholder-free (${cvHits.join('; ') || 'clean'})`);

  audits.push({
    id: fixture.id,
    contentHits,
    cvHits,
    templateHits,
    reviewItems: (built.reviewItems || []).length,
    rejected: fr.metaSafe?.finalCvPlaceholderRejected || [],
  });
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      guard: FINAL_CV_PLACEHOLDER_GUARD,
      forbidden: FINAL_CV_FORBIDDEN_PLACEHOLDERS,
      audits,
      pass: failed === 0,
    },
    null,
    2
  )
);

console.log(failed ? '\nFAIL no-placeholder-content' : '\nPASS no-placeholder-content');
process.exit(failed ? 1 : 0);
