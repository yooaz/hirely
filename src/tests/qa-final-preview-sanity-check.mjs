#!/usr/bin/env node
/**
 * P0 — Final preview sanity check before CV render.
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
  FINAL_PREVIEW_SANITY_CHECK_V1,
  PREVIEW_SANITY_RULES,
  applyFinalPreviewSanityCheck,
  auditFinalPreviewSanity,
} from '../core/validation/final-preview-sanity-check.js';
import { isSectionLabelLeakage } from '../core/validation/section-label-leakage-guard.js';
import { isMicroGarbageOnlyLine } from '../core/validation/ocr-micro-garbage-cleanup.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/final-preview-sanity-check/report.json');

let failed = 0;
const checks = [];

function record(id, pass, detail = '') {
  checks.push({ id, pass, detail });
  if (!pass) {
    failed++;
    console.error(`FAIL ${id}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`PASS ${id}`);
  }
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

function flattenPreviewLines(fr = {}) {
  const lines = [];
  if (fr.summary) lines.push(fr.summary);
  for (const field of ['education', 'skills', 'tools', 'languages', 'clients', 'projects']) {
    lines.push(...(fr[field] || []));
  }
  for (const exp of fr.experiences || []) {
    if (typeof exp === 'string') lines.push(exp);
    else {
      lines.push(exp.role, exp.company, exp.dates, exp.description, ...(exp.bullets || []));
    }
  }
  for (const field of ['name', 'title', 'phone', 'email']) {
    lines.push(fr.identity?.[field]);
  }
  return lines.map((x) => String(x || '').trim()).filter(Boolean);
}

record('policy_version', FINAL_PREVIEW_SANITY_CHECK_V1 === 'FINAL_PREVIEW_SANITY_CHECK_V1');
record('rules_count', PREVIEW_SANITY_RULES.length === 7, String(PREVIEW_SANITY_RULES.length));

const dirty = {
  identity: {
    name: 'McCann Paris',
    title: 'Art Director',
    email: 'user@test.com',
    phone: '2018 2020',
  },
  summary: 'Creative leader',
  experiences: [{ role: 'Designer', company: 'Studio', dates: '2020–2022' }],
  languages: ['French native', 'Native am', 'am'],
  skills: ['Branding', 'Skills', 'Branding'],
  tools: ['Photoshop', 'co'],
  clients: ['Nike'],
  education: ['', 'ENSAD — MA'],
};

const direct = applyFinalPreviewSanityCheck(dirty);
record('queues_fake_phone', direct.reviewItems.some((i) => String(i.field || '').includes('phone')));
record('queues_company_name', direct.reviewItems.some((i) => String(i.field || '').includes('name')));
record('queues_partial_language', direct.reviewItems.some((i) => i.field === 'languages'));
record('strips_polluted_language', !direct.finalResumeData.languages.some((l) => /native am/i.test(l)));
record('strips_parser_label_skills', !direct.finalResumeData.skills.some((s) => /^skills$/i.test(s)));
record('dedupes_skills', direct.finalResumeData.skills.filter((s) => s === 'Branding').length === 1);
record('no_ocr_co_in_tools', !direct.finalResumeData.tools.includes('co'));
record('preview_audit_clean', auditFinalPreviewSanity(direct.finalResumeData).pass);

const OCR_CV = [
  'Sophie Martin',
  'Graphic Designer',
  'sophie@studio.fr',
  '+33 6 12 34 56 78',
  'Languages',
  'French native',
  'Native am',
  'English fluent',
  'Skills',
  'Branding',
  'co',
].join('\n');

const imported = await runHirelyImportFromText(OCR_CV, { source: 'qa-preview-sanity', extractionMethod: 'paste' });
const sanitized = sanitizeResumeForDisplay(imported?.resumeData || {}, { existingReview: imported?.reviewQueue || [] });
const built = buildFinalResumeData(sanitized, {
  existingReview: imported?.reviewQueue || [],
  rawText: OCR_CV,
  cleanedText: OCR_CV,
  silent: true,
});

const fr = built.finalResumeData;
record('pipeline_builds_final', !!fr);
record('pipeline_preview_sanity_meta', !!fr?.quality?.previewSanity);
record('pipeline_review_items', (built.reviewItems || []).length > 0);

const previewLines = flattenPreviewLines(fr);
record(
  'preview_no_parser_labels',
  !previewLines.some((line) => isSectionLabelLeakage(line)),
  previewLines.filter(isSectionLabelLeakage).join(' | ')
);
record(
  'preview_no_micro_garbage',
  !previewLines.some((line) => isMicroGarbageOnlyLine(line)),
  previewLines.filter(isMicroGarbageOnlyLine).join(' | ')
);
record('preview_no_native_am', !previewLines.some((line) => /\bnative am\b/i.test(line)));

const T = loadHirelyTemplates();
const cv = resumeDataToCvData(fr, { skipNormalize: true });
const html = T.render(cv, 'ats');
record('template_render_ok', html.length > 200);
record('template_no_skills_label_body', !/cvSectionBody[^>]*>\s*Skills\s*</i.test(html));

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      policy: FINAL_PREVIEW_SANITY_CHECK_V1,
      rules: [...PREVIEW_SANITY_RULES],
      checks,
      pipeline: {
        reviewCount: (built.reviewItems || []).length,
        previewSanity: fr?.quality?.previewSanity || null,
        previewLineCount: previewLines.length,
      },
      pass: failed === 0,
    },
    null,
    2
  )
);

console.log(`\nReport: ${OUT}`);
process.exit(failed === 0 ? 0 : 1);
