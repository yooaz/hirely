#!/usr/bin/env node
/**
 * P0 — Review screen guarantee QA.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  finalResumeDataMeetsReviewGuarantee,
  buildReviewGuaranteeWarnings,
  isReviewGuaranteeWeak,
  resumeObjectExists,
} from '../core/validation/review-screen-guarantee.js';
import { emptyResumeData } from '../core/resume-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const INDEX = path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, 'tests/output/review-screen-guarantee/report.json');

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
  const html = fs.readFileSync(INDEX, 'utf8');

  ok(resumeObjectExists(emptyResumeData()), 'guarantee_empty_resume_object');
  ok(finalResumeDataMeetsReviewGuarantee(emptyResumeData()), 'guarantee_minimal_resume');
  ok(finalResumeDataMeetsReviewGuarantee({ identity: { name: 'Yohann' } }), 'guarantee_name');
  ok(finalResumeDataMeetsReviewGuarantee({ identity: { email: 'a@b.co' } }), 'guarantee_email');
  ok(finalResumeDataMeetsReviewGuarantee({ identity: {}, experiences: [{ title: 'Dev' }] }), 'guarantee_experience');
  ok(finalResumeDataMeetsReviewGuarantee({ identity: {}, experiences: [] }), 'guarantee_identity_shell');
  ok(!finalResumeDataMeetsReviewGuarantee(null), 'guarantee_null_false');
  ok(!finalResumeDataMeetsReviewGuarantee({}), 'guarantee_no_identity_false');

  const weak = buildReviewGuaranteeWarnings({ identity: { name: 'Yohann' }, experiences: [] });
  ok(weak.length > 0, 'weak_warnings', String(weak.length));
  ok(isReviewGuaranteeWeak({ identity: { name: 'Yohann' } }), 'is_weak');

  ok(html.includes('finalResumeDataMeetsReviewGuarantee') || html.includes('reviewGuaranteeMetUi'), 'ui_guarantee_helper');
  ok(html.includes('function reviewGuaranteeMetUi'), 'ui_reviewGuaranteeMetUi');
  ok(html.includes('showReviewGuaranteeWarningsUi'), 'ui_warnings_helper');
  ok(html.includes('REVIEW_SCREEN_VISIBLE'), 'ui_review_log');
  ok(html.includes('guaranteeOk'), 'ui_guarantee_gate');
  ok(html.includes('resumeObjectExists') || html.includes('REVIEW_GUARANTEE_WARN'), 'ui_no_import_fallback_when_guarantee');
  ok(html.includes('guarantee-partial') || html.includes('guarantee-partial'), 'ui_skip_extraction_gate');

  const report = {
    feature: 'REVIEW_SCREEN_GUARANTEE',
    generatedAt: new Date().toISOString(),
    checks,
    pass: failed === 0,
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(failed ? '\nFAIL review-screen-guarantee' : '\nPASS review-screen-guarantee');
  process.exit(failed ? 1 : 0);
}

main();
