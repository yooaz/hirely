#!/usr/bin/env node
/**
 * P0 — OCR micro-garbage cleanup acceptance tests.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  OCR_MICRO_GARBAGE_CLEANUP_V1,
  isMicroGarbageOnlyLine,
  isAcceptableLanguageLine,
  sanitizeLanguageLine,
  stripTrailingOcrFragments,
  stripMicroGarbageFromText,
  applyOcrMicroGarbageCleanup,
} from '../core/validation/ocr-micro-garbage-cleanup.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/ocr-micro-garbage-cleanup');
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

record('policy_version', OCR_MICRO_GARBAGE_CLEANUP_V1 === 'OCR_MICRO_GARBAGE_CLEANUP_V1');

for (const junk of ['am', 'co', 'n', 'm', '20', '@', ':']) {
  record(`reject_token_${junk}`, isMicroGarbageOnlyLine(junk));
}

record('reject_native_am', !isAcceptableLanguageLine('Native am'));
record('reject_short_am', !sanitizeLanguageLine('am').ok);
record('accept_french_native', sanitizeLanguageLine('French native').ok);
record('accept_english_fluent', sanitizeLanguageLine('English fluent').ok);
record('accept_spanish_intermediate', sanitizeLanguageLine('Spanish intermediate').ok);
record('accept_french_dash_native', sanitizeLanguageLine('French — native').ok);

record('strip_trailing_am', stripTrailingOcrFragments('French native am') === 'French native');
record('strip_trailing_at', stripTrailingOcrFragments('contact@studio.fr @') === 'contact@studio.fr');

const cleaned = applyOcrMicroGarbageCleanup({
  identity: { email: 'user@test.com @' },
  languages: ['French native', 'Native am', 'am', 'English fluent'],
  skills: ['Branding', 'co'],
  unsorted: ['Native am', 'valid orphan line'],
});
record('cleanup_strips_polluted_language', !cleaned.resumeData.languages.some((l) => /native am/i.test(l)));
record(
  'cleanup_keeps_valid_languages',
  cleaned.resumeData.languages.includes('French — native') &&
    cleaned.resumeData.languages.includes('English — fluent')
);
record('cleanup_language_review', cleaned.reviewItems.some((i) => i.field === 'languages'));
record('cleanup_no_am_in_skills', !cleaned.resumeData.skills.includes('co'));
record('cleanup_strips_contact_fragment', !String(cleaned.resumeData.identity.email || '').endsWith('@'));

const OCR_CV = [
  'Sophie Martin',
  'Graphic Designer',
  'sophie@studio.fr',
  'Languages',
  'French native',
  'Native am',
  'English fluent',
  'am',
  'Skills',
  'Branding',
  'Typography',
].join('\n');

const imported = await runHirelyImportFromText(OCR_CV, { source: 'qa-ocr-micro-garbage', extractionMethod: 'paste' });
const sanitized = sanitizeResumeForDisplay(imported?.resumeData || {});
const built = buildFinalResumeData(sanitized, {
  silent: true,
  rawText: OCR_CV,
  existingReview: imported?.reviewQueue || [],
});
const fr = built.finalResumeData || {};
const langs = fr.languages || [];
record('pipeline_no_native_am', !langs.some((l) => /\bnative am\b/i.test(l)));
record('pipeline_no_bare_am', !langs.some((l) => /^am$/i.test(String(l).trim())));
record(
  'pipeline_has_valid_language',
  langs.some((l) => /english/i.test(l)) || langs.some((l) => /french/i.test(l))
);
record(
  'pipeline_review_or_strip',
  built.reviewItems.some((i) => i.field === 'languages' || i.section === 'languages') ||
    !langs.some((l) => /native am/i.test(l))
);

record('strip_partial_word', stripMicroGarbageFromText('co') === '');

fs.mkdirSync(OUT_DIR, { recursive: true });
const report = {
  version: OCR_MICRO_GARBAGE_CLEANUP_V1,
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  summary: { total: checks.length, pass: checks.filter((c) => c.pass).length, fail: failed },
  checks,
  samples: {
    languages: langs,
    reviewCount: built.reviewItems?.length ?? 0,
    stripped: cleaned.stripped,
  },
};
fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));

console.log(`\n═══ OCR Micro-Garbage: ${report.summary.pass}/${report.summary.total} PASS ═══`);
process.exit(failed ? 1 : 0);
