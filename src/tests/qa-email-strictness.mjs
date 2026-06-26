#!/usr/bin/env node
/**
 * P0 — Email strictness: never mutate local-part; ground in source; queue uncertain OCR.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  EMAIL_STRICTNESS_V1,
  assessEmailStrictness,
  emailLocalPartAddsLetters,
  enforceEmailStrictness,
  extractEmailsFromSource,
} from '../core/validation/email-strictness.js';
import { enforceIdentityContactStrictness } from '../core/validation/identity-contact-strictness.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/email-strictness');
const REPORT_JSON = path.join(OUT_DIR, 'report.json');

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

fs.mkdirSync(OUT_DIR, { recursive: true });

record('version', EMAIL_STRICTNESS_V1 === 'EMAIL_STRICTNESS_V1');

record(
  'detect_local_part_mutation',
  emailLocalPartAddsLetters('yoazg', 'yoaz') &&
    !emailLocalPartAddsLetters('yoaz', 'yoazg')
);

const yoazSource = 'Yohann Azancot\nGraphic Designer\nyoaz@hotmail.fr · Paris';
const yoazMutated = assessEmailStrictness('yoazg@hotmail.fr', yoazSource);
record(
  'yoaz_never_becomes_yoazg',
  yoazMutated.accept &&
    yoazMutated.display === 'yoaz@hotmail.fr' &&
    yoazMutated.reason === 'local_part_mutation_recovered',
  JSON.stringify(yoazMutated)
);

const exact = assessEmailStrictness('yoaz@hotmail.fr', yoazSource);
record('exact_source_email', exact.accept && exact.display === 'yoaz@hotmail.fr');

const ocrSource = 'Contact: marie@example com';
const ocrFixed = assessEmailStrictness('marie@example.com', ocrSource);
record(
  'reversible_ocr_domain_only',
  ocrFixed.accept && ocrFixed.display === 'marie@example.com'
);

const strict = enforceEmailStrictness(
  { email: 'yoazg@hotmail.fr' },
  { sourceText: yoazSource }
);
record(
  'enforce_recovers_and_queues_review',
  strict.identity.email === 'yoaz@hotmail.fr' &&
    strict.reviewItems.some((i) => i.field === 'identity.email' && i.sourceText.includes('yoaz@hotmail'))
);

const uncertain = enforceEmailStrictness(
  { email: 'fake.user@nowhere.test' },
  { sourceText: 'No contact line here' }
);
record(
  'uncertain_email_to_review',
  !uncertain.identity.email && uncertain.reviewItems.length >= 1
);

const contactStrict = enforceIdentityContactStrictness(
  { name: 'Yohann Azancot', email: 'yoazg@hotmail.fr' },
  { sourceText: yoazSource }
);
record(
  'identity_contact_strictness_email',
  contactStrict.identity.email === 'yoaz@hotmail.fr'
);

const importResult = await runHirelyImportFromText(yoazSource, {
  source: 'email-strictness',
  extractionMethod: 'paste',
});
const sanitized = sanitizeResumeForDisplay({
  ...importResult.resumeData,
  meta: { ...(importResult.resumeData.meta || {}), rawText: yoazSource },
});
const displayEmail = String(sanitized.identity?.email || '');
record(
  'import_sanitize_no_yoazg',
  !displayEmail.includes('yoazg@') &&
    (displayEmail === 'yoaz@hotmail.fr' || displayEmail === 'Email à confirmer'),
  displayEmail
);

const reviewItems = sanitized.meta?.contactReviewItems || [];
record(
  'mutation_review_has_source_text',
  !reviewItems.some((i) => i.field === 'identity.email' && String(i.detected || '').includes('yoazg')) ||
    reviewItems.some(
      (i) => i.field === 'identity.email' && String(i.sourceText || '').includes('yoaz@hotmail')
    )
);

const extracted = extractEmailsFromSource(yoazSource).map((e) => e.normalized);
record('extract_exact_from_source', extracted.includes('yoaz@hotmail.fr'));

const report = {
  version: EMAIL_STRICTNESS_V1,
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  passCount: checks.filter((c) => c.pass).length,
  failCount: failed,
  checks,
  acceptance: {
    yoazNeverBecomesYoazg: yoazMutated.display === 'yoaz@hotmail.fr',
    displayEmailAfterSanitize: displayEmail,
  },
};

fs.writeFileSync(REPORT_JSON, `${JSON.stringify(report, null, 2)}\n`);

console.log(`\n═══ Email Strictness: ${report.passCount}/${checks.length} PASS ═══`);
process.exit(failed ? 1 : 0);
