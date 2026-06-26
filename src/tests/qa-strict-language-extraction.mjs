#!/usr/bin/env node
/**
 * P0 — Strict language extraction acceptance tests.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  STRICT_LANGUAGE_EXTRACTION_V1,
  isForbiddenLanguageLine,
  isStrictLanguageEntry,
  extractStrictLanguageLine,
  applyStrictLanguageExtraction,
} from '../core/parsing/strict-language-extraction.js';
import { parseLanguages } from '../core/parsing/rich-parser.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/strict-language-extraction');
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

record('policy_version', STRICT_LANGUAGE_EXTRACTION_V1 === 'STRICT_LANGUAGE_EXTRACTION_V1');

for (const junk of ['Native am', 'Fluent analyse', 'native co', 'am', 'co']) {
  record(`forbid_${junk.replace(/\s+/g, '_').toLowerCase()}`, isForbiddenLanguageLine(junk));
}

record('reject_native_am_entry', !isStrictLanguageEntry('Native am'));
record('reject_fluent_analyse', !extractStrictLanguageLine('Fluent analyse').ok);
record('accept_french_native', extractStrictLanguageLine('French native').ok);
record('accept_english_fluent', extractStrictLanguageLine('English fluent').ok);
record('accept_spanish_intermediate', extractStrictLanguageLine('Spanish intermediate').ok);
record('accept_french_dash_native', extractStrictLanguageLine('French — native').ok);
record('reject_proficiency_only', !extractStrictLanguageLine('native').ok);

const parsed = parseLanguages(['French native', 'Native am', 'English fluent', 'am']);
record('parse_languages_no_pollution', !parsed.some((l) => /native am/i.test(l)));
record(
  'parse_languages_keeps_valid',
  parsed.some((l) => /french/i.test(l)) && parsed.some((l) => /english/i.test(l))
);

const batch = applyStrictLanguageExtraction([
  'French native',
  'Native am',
  'English fluent',
  'Fluent analyse',
]);
record('batch_strips_polluted', !batch.languages.some((l) => /native am|fluent analyse/i.test(l)));
record('batch_review_items', batch.reviewItems.length >= 2);

const OCR_CV = [
  'Sophie Martin',
  'Graphic Designer',
  'sophie@studio.fr',
  'Languages',
  'French native',
  'Native am',
  'English fluent',
  'Fluent analyse',
  'am',
].join('\n');

const imported = await runHirelyImportFromText(OCR_CV, { source: 'qa-strict-language', extractionMethod: 'paste' });
const sanitized = sanitizeResumeForDisplay(imported?.resumeData || {});
const built = buildFinalResumeData(sanitized, {
  silent: true,
  rawText: OCR_CV,
  existingReview: imported?.reviewQueue || [],
});
const langs = built.finalResumeData?.languages || [];

record('pipeline_no_native_am', !langs.some((l) => /\bnative am\b/i.test(l)));
record('pipeline_no_fluent_analyse', !langs.some((l) => /fluent analyse/i.test(l)));
record('pipeline_no_bare_am', !langs.some((l) => /^am$/i.test(String(l).trim())));
record(
  'pipeline_has_valid',
  langs.some((l) => /french/i.test(l)) || langs.some((l) => /english/i.test(l))
);
record(
  'pipeline_review_or_strip',
  (built.reviewItems || []).some((i) => i.field === 'languages' || i.section === 'languages') ||
    !langs.some((l) => /native am|fluent analyse/i.test(l))
);

fs.mkdirSync(OUT_DIR, { recursive: true });
const report = {
  version: STRICT_LANGUAGE_EXTRACTION_V1,
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  summary: { total: checks.length, pass: checks.filter((c) => c.pass).length, fail: failed },
  checks,
  samples: { languages: langs, reviewCount: built.reviewItems?.length ?? 0 },
};
fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));

console.log(`\n═══ Strict Language Extraction: ${report.summary.pass}/${report.summary.total} PASS ═══`);
process.exit(failed ? 1 : 0);
