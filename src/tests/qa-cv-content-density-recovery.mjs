#!/usr/bin/env node
/**
 * P0 — CV content density recovery (rawText → finalResumeData + reviewQueue).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  applyContentDensityRecovery,
  auditContentDensity,
  parseRawSectionLines,
  CONTENT_DENSITY_MIN_PCT,
  lineAccountedInOutput,
  buildAccountedBlob,
} from '../core/validation/content-density-recovery.js';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { resumeDataToCvData } from '../core/resume-data.js';
import { loadHirelyTemplates } from './lib/pdf-hardening-suite.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/cv-content-density-recovery');
const REPORT_JSON = path.join(OUT_DIR, 'report.json');

const RICH_RAW = [
  'Sophie Martin',
  'Senior Graphic Designer',
  'sophie@studio.example.com',
  '+33 6 12 34 56 78',
  'Paris, France',
  '',
  'PROFILE',
  'Creative lead for luxury and culture brands across Europe.',
  '',
  'EXPERIENCE',
  'McCann Paris — Art Director — 2019–2022',
  'Led campaigns for Chanel and Dior.',
  'Publicis — Illustrator — 2017–2019',
  'Havas — Illustrator — 2015–2017',
  '',
  'EDUCATION',
  'LISAA Paris — Bachelor Design — 2012',
  'École Estienne — Graphic Design — 2010',
  '',
  'SKILLS',
  'Branding, typography, art direction',
  '',
  'TOOLS',
  'Photoshop, Illustrator, InDesign, After Effects',
  '',
  'CLIENTS',
  'Chanel, Dior, LVMH, Hermès, Nike',
  '',
  'PROJECTS',
  'Luxury fragrance launch — print and digital',
  'Museum identity system — signage and posters',
  '',
  'PORTFOLIO',
  'behance.net/sophiemartin',
].join('\n');

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

record('density_min_55', CONTENT_DENSITY_MIN_PCT === 55);

const parsed = parseRawSectionLines(RICH_RAW);
record('parse_experience_lines', parsed.experience.length >= 3, `count=${parsed.experience.length}`);
record('parse_clients_section', parsed.clients.length >= 1);
record('parse_tools_section', parsed.tools.length >= 1);
record('parse_education_section', parsed.education.length >= 2);

const sparseFinal = {
  identity: { name: 'Sophie Martin', title: 'Senior Graphic Designer' },
  summary: '',
  experiences: [],
  education: [],
  skills: [],
  tools: [],
  languages: [],
  clients: [],
  projects: [],
  suggestions: [],
};

const recovered = applyContentDensityRecovery(RICH_RAW, sparseFinal, []);
record('recovery_adds_experience', (recovered.finalResumeData.experiences || []).length >= 2);
record('recovery_adds_clients', (recovered.finalResumeData.clients || []).length >= 2);
record('recovery_adds_education', (recovered.finalResumeData.education || []).length >= 1);
record('recovery_adds_tools', (recovered.finalResumeData.tools || []).length >= 2);
record(
  'recovery_density_target',
  recovered.audit.previewDensityPct >= CONTENT_DENSITY_MIN_PCT,
  `${recovered.audit.previewDensityPct}%`
);

const blob = buildAccountedBlob(recovered.finalResumeData, recovered.reviewItems);
record(
  'clients_brands_present',
  ['Chanel', 'Dior', 'Hermès'].every((brand) =>
    recovered.finalResumeData.clients.some((c) => new RegExp(brand, 'i').test(c)) ||
    lineAccountedInOutput(brand, blob)
  )
);
record(
  'tools_present',
  ['Photoshop', 'Illustrator'].every((tool) =>
    recovered.finalResumeData.tools.some((t) => /photoshop|illustrator/i.test(t)) ||
    lineAccountedInOutput(tool, blob)
  )
);
for (const line of [...parsed.education, ...parsed.experience]) {
  if (line.length < 6) continue;
  const accounted =
    lineAccountedInOutput(line, blob) ||
    recovered.reviewItems.some((r) => String(r.sourceText || '').includes(line.slice(0, 20)));
  record(`accounted:${line.slice(0, 28)}`, accounted);
}

const imported = await runHirelyImportFromText(RICH_RAW, {
  source: 'qa-density-recovery',
  extractionMethod: 'paste',
});
const built = buildFinalResumeData(imported?.resumeData || {}, {
  rawText: RICH_RAW,
  cleanedText: RICH_RAW,
  existingReview: imported?.reviewQueue || [],
});
const frd = built.finalResumeData;
record('pipeline_final_resume', !!frd);
record('pipeline_has_experience', (frd?.experiences || []).length >= 1);
record('pipeline_has_education_or_clients', (frd?.education || []).length >= 1 || (frd?.clients || []).length >= 1);

const pipelineAudit =
  built.densityRecovery ||
  auditContentDensity(RICH_RAW, frd, built.reviewItems || []);
record(
  'pipeline_density',
  pipelineAudit.previewDensityPct >= CONTENT_DENSITY_MIN_PCT,
  `${pipelineAudit.previewDensityPct}%`
);

const cvData = resumeDataToCvData(frd || {});
const T = loadHirelyTemplates();
const html = String(T.render(cvData, 'ats') || '');
const sectionTitles = (html.match(/cvSectionTitle/g) || []).length;
record('render_multiple_sections', sectionTitles >= 3, `sections=${sectionTitles}`);

fs.mkdirSync(OUT_DIR, { recursive: true });
const report = {
  version: 'CV_CONTENT_DENSITY_RECOVERY_V1',
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  summary: { total: checks.length, pass: checks.filter((c) => c.pass).length, fail: failed },
  checks,
  recovery: {
    previewDensityPct: recovered.audit.previewDensityPct,
    recovered: recovered.stats.recovered,
    queued: recovered.stats.queued,
    experiences: recovered.finalResumeData.experiences?.length,
    clients: recovered.finalResumeData.clients?.length,
    education: recovered.finalResumeData.education?.length,
    tools: recovered.finalResumeData.tools?.length,
  },
  pipeline: {
    previewDensityPct: pipelineAudit.previewDensityPct,
    experiences: frd?.experiences?.length,
    clients: frd?.clients?.length,
    education: frd?.education?.length,
    reviewCount: (built.reviewItems || []).length,
  },
};
fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));

console.log(`\n═══ CV Content Density Recovery: ${report.summary.pass}/${report.summary.total} PASS ═══`);
process.exit(failed ? 1 : 0);
