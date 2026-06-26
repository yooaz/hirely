#!/usr/bin/env node
/**
 * P0 — Final CV must never expose parser/internal section labels as content.
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
  FORBIDDEN_CV_CONTENT_LABELS,
  isSectionLabelLeakage,
  auditSectionLabelLeakage,
  sanitizeFinalCvLabelsBeforeCommit,
  SECTION_LABEL_LEAKAGE_GUARD,
} from '../core/validation/section-label-leakage-guard.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/final-cv-label-leakage/report.json');

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
    lines.push(exp.role, exp.company, exp.description, ...(exp.bullets || []));
  }
  for (const field of ['name', 'title', 'location']) {
    lines.push(fr.identity?.[field]);
  }
  return lines.map((x) => String(x || '').trim()).filter(Boolean);
}

function isForbiddenContentLine(line) {
  const norm = String(line || '')
    .replace(/^[-•*#]+\s*/, '')
    .replace(/[:：|]+\s*$/, '')
    .trim()
    .toLowerCase();
  return FORBIDDEN_CV_CONTENT_LABELS.includes(norm) || isSectionLabelLeakage(line);
}

/** Strip template section titles — allowed as controlled headings only. */
function htmlContentOnlyLines(html) {
  let body = String(html || '')
    .replace(/<h[1-6][^>]*class="[^"]*cvSectionTitle[^"]*"[^>]*>[\s\S]*?<\/h[1-6]>/gi, '')
    .replace(/<script[\s\S]*?<\/script>/gi, '')
    .replace(/<style[\s\S]*?<\/style>/gi, '');
  return body
    .replace(/<[^>]+>/g, '\n')
    .split('\n')
    .map((x) => x.trim())
    .filter(Boolean);
}

ok(SECTION_LABEL_LEAKAGE_GUARD === 'SECTION_LABEL_LEAKAGE_GUARD_V2', 'guard V2 active');
for (const label of FORBIDDEN_CV_CONTENT_LABELS) {
  ok(isSectionLabelLeakage(label), `forbidden label detected: ${label}`);
}

const commitProbe = sanitizeFinalCvLabelsBeforeCommit({
  identity: { name: 'identity', title: 'Designer' },
  summary: 'summary',
  skills: ['skills'],
  experiences: [{ role: 'experiences', company: 'Nike', bullets: ['tools'] }],
});
ok(auditSectionLabelLeakage(commitProbe).violations.length === 0, 'sanitizeFinalCvLabelsBeforeCommit strips all labels');
ok((commitProbe.metaSafe?.debug?.sectionLabelLeakage?.rejected || []).length > 0, 'rejected labels land in debug only');

const Templates = loadHirelyTemplates();
const audits = [];

for (const fixture of FIXTURES) {
  const raw = fs.readFileSync(path.join(ROOT, fixture.file), 'utf8');
  const imported = await runHirelyImportFromText(raw, {
    source: fixture.id,
    extractionMethod: 'paste',
  });
  const sanitized = sanitizeResumeForDisplay(imported.resumeData || {});
  const built = buildFinalResumeData(sanitized, { silent: true });
  const fr = built.finalResumeData || {};
  const cv = built.cvData || resumeDataToCvData(fr, { skipNormalize: true });

  const contentHits = collectContentLines(fr).filter((line) => isForbiddenContentLine(line));
  const cvHits = [
    cv.summary,
    ...(cv.skills || []),
    ...(cv.tools || []),
    ...(cv.clients || []),
    ...(cv.education || []),
    ...(cv.languages || []),
    ...(cv.experience || []).flatMap((e) =>
      typeof e === 'string' ? [e] : [e?.role, e?.company, ...(e?.bullets || [])]
    ),
  ]
    .map((x) => String(x || '').trim())
    .filter(Boolean)
    .filter((line) => isForbiddenContentLine(line));

  const templateHits = [];
  for (const templateId of TEMPLATE_IDS) {
    const html = Templates.render(cv, templateId);
    const hits = htmlContentOnlyLines(html).filter((line) => isForbiddenContentLine(line));
    templateHits.push({ templateId, hits });
    ok(hits.length === 0, `${fixture.id}/${templateId} preview HTML label-free (${hits.join('; ') || 'clean'})`);
  }

  ok(contentHits.length === 0, `${fixture.id} finalResumeData label-free (${contentHits.join('; ') || 'clean'})`);
  ok(cvHits.length === 0, `${fixture.id} cvData/pdf path label-free (${cvHits.join('; ') || 'clean'})`);

  audits.push({
    id: fixture.id,
    contentHits,
    cvHits,
    templateHits,
    rejected: fr.metaSafe?.sectionLabelLeakageRejected || [],
    debug: fr.metaSafe?.debug?.sectionLabelLeakage || null,
  });
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      guard: SECTION_LABEL_LEAKAGE_GUARD,
      forbidden: FORBIDDEN_CV_CONTENT_LABELS,
      audits,
      pass: failed === 0,
    },
    null,
    2
  )
);

console.log(failed ? '\nFAIL final-cv-label-leakage' : '\nPASS final-cv-label-leakage');
process.exit(failed ? 1 : 0);
