#!/usr/bin/env node
/**
 * P0 — OCR data cleanup acceptance tests.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  OCR_DATA_CLEANUP_V1,
  isCamelCaseI18nKey,
  isOcrDataCleanupJunkLine,
  partitionSkillsAndTools,
  applyOcrDataCleanup,
  auditOcrDataCleanup,
} from '../core/validation/ocr-data-cleanup.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';
import { applyFinalPreviewSanityCheck } from '../core/validation/final-preview-sanity-check.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/ocr-data-cleanup');
const OUT_JSON = path.join(OUT_DIR, 'report.json');

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

record('policy_version', OCR_DATA_CLEANUP_V1 === 'OCR_DATA_CLEANUP_V1');

record('reject_native_am', isOcrDataCleanupJunkLine('Native am') || !applyOcrDataCleanup({
  languages: ['Native am'],
}).resumeData.languages.length);
record('reject_i18n_key', isCamelCaseI18nKey('extractionQuality_emailOk'));
record('reject_page_number', isOcrDataCleanupJunkLine('Page 1'));
record('reject_section_label', isOcrDataCleanupJunkLine('Skills'));
record('reject_fragment_co', isOcrDataCleanupJunkLine('co'));

record('accept_french_native', applyOcrDataCleanup({ languages: ['French native'] }).resumeData.languages.length === 1);
record('accept_english_fluent', applyOcrDataCleanup({ languages: ['English fluent'] }).resumeData.languages.length === 1);
record('accept_spanish_intermediate', applyOcrDataCleanup({ languages: ['Spanish intermediate'] }).resumeData.languages.length === 1);

const routed = partitionSkillsAndTools(['Branding', 'Photoshop', 'Typography'], ['Figma']);
record('routes_software_to_tools', !routed.skills.includes('Photoshop') && routed.tools.includes('Photoshop'));
record('keeps_skills', routed.skills.includes('Branding') && routed.skills.includes('Typography'));
record('no_skills_tools_dup', !routed.skills.some((s) => routed.tools.map((t) => t.toLowerCase()).includes(s.toLowerCase())));

const dirty = applyOcrDataCleanup({
  identity: { name: 'Alex Martin', email: 'alex@test.com' },
  languages: ['French native', 'Native am', 'English fluent', 'am'],
  skills: ['Branding', 'Skills', 'Skills', 'Photoshop', 'extractionQuality_emailOk'],
  tools: ['co', 'Page 2'],
  education: ['ENSAD — MA', 'Education'],
  unsorted: ['1 / 2', 'valid note'],
});
record('strips_i18n_from_skills', !dirty.resumeData.skills.includes('extractionQuality_emailOk'));
record('strips_parser_labels', !dirty.resumeData.skills.some((s) => /^skills$/i.test(s)));
record('dedupes_skills', dirty.resumeData.skills.filter((s) => s === 'Branding').length === 1);
record('routes_photoshop', !dirty.resumeData.skills.includes('Photoshop') && dirty.resumeData.tools.includes('Photoshop'));
record('no_native_am', !dirty.resumeData.languages.some((l) => /\bnative am\b/i.test(l)));
record('cleanup_audit_pass', auditOcrDataCleanup(dirty.resumeData).pass);

const OCR_CV = [
  'Alex Martin',
  'Graphic Designer',
  'alex@studio.fr',
  'Languages',
  'French native',
  'Native am',
  'English fluent',
  'Skills',
  'Branding',
  'Typography',
  'Photoshop',
  'Tools',
  'Figma',
  'extractionQuality_emailOk',
  'Page 1',
].join('\n');

const imported = await runHirelyImportFromText(OCR_CV, { source: 'qa-ocr-data-cleanup', extractionMethod: 'paste' });
const sanitized = sanitizeResumeForDisplay(imported?.resumeData || {});
const built = buildFinalResumeData(sanitized, {
  silent: true,
  rawText: OCR_CV,
  existingReview: imported?.reviewQueue || [],
});
const fr = built.finalResumeData || {};
const previewText = [
  ...(fr.languages || []),
  ...(fr.skills || []),
  ...(fr.tools || []),
  fr.summary,
].filter(Boolean).join(' | ');

record('pipeline_no_native_am', !/\bnative am\b/i.test(previewText));
record('pipeline_no_i18n_key', !/extractionQuality_/i.test(previewText));
record('pipeline_no_page_number', !/\bpage\s*1\b/i.test(previewText));
record('pipeline_no_skills_label', !(fr.skills || []).some((s) => /^skills$/i.test(String(s))));
record('pipeline_photoshop_in_tools', (fr.tools || []).some((t) => /photoshop/i.test(t)) || !(fr.skills || []).includes('Photoshop'));
record('pipeline_valid_languages', (fr.languages || []).some((l) => /french/i.test(l)) && (fr.languages || []).some((l) => /english/i.test(l)));

const sanity = applyFinalPreviewSanityCheck(fr, { force: true });
record('preview_sanity_audit', auditOcrDataCleanup(sanity.finalResumeData).pass);

fs.mkdirSync(OUT_DIR, { recursive: true });
const report = {
  version: OCR_DATA_CLEANUP_V1,
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  acceptance: {
    no_native_am: checks.find((c) => c.id === 'pipeline_no_native_am')?.pass,
    no_i18n_keys: checks.find((c) => c.id === 'pipeline_no_i18n_key')?.pass,
    no_garbage_fragments: checks.find((c) => c.id === 'reject_fragment_co')?.pass,
    no_duplicated_labels: checks.find((c) => c.id === 'dedupes_skills')?.pass,
    skills_tools_routed: checks.find((c) => c.id === 'routes_software_to_tools')?.pass,
  },
  summary: { total: checks.length, pass: checks.filter((c) => c.pass).length, fail: failed },
  checks,
  samples: {
    languages: fr.languages,
    skills: fr.skills,
    tools: fr.tools,
    reviewCount: built.reviewItems?.length ?? 0,
  },
};
fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));

console.log(`\n═══ OCR Data Cleanup: ${report.summary.pass}/${report.summary.total} PASS ═══`);
process.exit(failed ? 1 : 0);
