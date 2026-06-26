#!/usr/bin/env node
/**
 * P0 — NO FAKE PASS import gate (policy unit tests).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  NO_FAKE_PASS_VERSION,
  MEANINGFUL_TEXT_MIN,
  evaluateImportProductPass,
  evaluateImportAcceptableOutcome,
  evaluateTerminalSafety,
  hasIdentityExperienceOrEducation,
  previewHasMeaningfulContent,
  auditRowFakeIdentity,
} from '../../tests/lib/no-fake-pass-import-policy.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/no-fake-pass-import-gate');
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

record('gate_version', NO_FAKE_PASS_VERSION === 'NO_FAKE_PASS_IMPORT_GATE_V2');
record('meaningful_min_300', MEANINGFUL_TEXT_MIN === 300);

const goodRow = {
  status: 'IMPORT_READY',
  category: 'pdf_selectable',
  selectedTextLength: 420,
  hasResume: true,
  identityName: 'Yohann Azancot',
  identityEmail: 'yohann@example.com',
  identityPhone: '+33649434839',
  experienceCount: 2,
  educationCount: 1,
  skillsCount: 4,
  finalPreviewLength: 280,
  live: true,
};
record('good_import_passes', evaluateImportProductPass(goodRow).pass);

const thinReady = {
  ...goodRow,
  selectedTextLength: 45,
  finalPreviewLength: 40,
  experienceCount: 0,
  educationCount: 0,
};
record('thin_ready_fails', !evaluateImportProductPass(thinReady).pass);
record(
  'thin_ready_reason',
  evaluateImportProductPass(thinReady).reasons.includes('selected_text_under_300')
);

const needsPaste = {
  status: 'IMPORT_NEEDS_PASTE',
  category: 'pdf_scanned',
  selectedTextLength: 0,
  fallback: true,
};
const pasteVerdict = evaluateImportProductPass(needsPaste);
record('needs_paste_not_success', !pasteVerdict.pass);
record('needs_paste_acceptable', pasteVerdict.acceptable === true);
record(
  'needs_paste_reason',
  pasteVerdict.reasons.includes('paste_fallback_not_success')
);

const fakeName = {
  ...goodRow,
  identityName: 'Lontac Impressions',
};
record('fake_name_fails', !evaluateImportProductPass(fakeName).pass);
record('fake_name_reason', evaluateImportProductPass(fakeName).reasons.includes('fake_name'));

const fakePhone = {
  ...goodRow,
  identityPhone: '+336434343830',
};
record('fake_phone_fails', !evaluateImportProductPass(fakePhone).pass);
record('fake_phone_reason', evaluateImportProductPass(fakePhone).reasons.includes('fake_phone'));

const emptyCv = {
  status: 'IMPORT_READY',
  category: 'docx',
  selectedTextLength: 350,
  hasResume: true,
  live: true,
  experienceCount: 0,
  educationCount: 0,
  skillsCount: 0,
  toolsCount: 0,
  finalPreviewLength: 12,
};
record('empty_cv_fails', !evaluateImportProductPass(emptyCv).pass);

const stuck = {
  status: 'IMPORT_READY',
  stuck: true,
  timedOut: true,
  selectedTextLength: 400,
  hasResume: true,
  experienceCount: 1,
  finalPreviewLength: 200,
};
record('stuck_loader_fails', !evaluateImportProductPass(stuck).pass);

const eduOnly = {
  status: 'IMPORT_PARTIAL',
  category: 'docx',
  selectedTextLength: 310,
  hasResume: true,
  identityName: '',
  experienceCount: 0,
  educationCount: 2,
  finalPreviewLength: 150,
  live: true,
};
record('education_only_can_pass', evaluateImportProductPass(eduOnly).pass);

record(
  'identity_exp_edu_helper',
  hasIdentityExperienceOrEducation(goodRow) && hasIdentityExperienceOrEducation(eduOnly)
);
record('preview_meaningful', previewHasMeaningfulContent(goodRow));
record('audit_clean_identity', auditRowFakeIdentity(goodRow).length === 0);

const terminal = evaluateTerminalSafety({ status: 'IMPORT_NEEDS_PASTE' });
record('terminal_safe_needs_paste', terminal.pass);

const policySrc = fs.readFileSync(
  path.join(ROOT, 'tests/lib/no-fake-pass-import-policy.mjs'),
  'utf8'
);
record('policy_imports_no_fake_data', /no-fake-data-policy/.test(policySrc));
record('policy_fake_name_check', /auditRowFakeIdentity/.test(policySrc));

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  REPORT_JSON,
  JSON.stringify(
    {
      version: NO_FAKE_PASS_VERSION,
      generatedAt: new Date().toISOString(),
      pass: failed === 0,
      failed,
      checks,
      samples: {
        good: evaluateImportProductPass(goodRow),
        needsPaste: pasteVerdict,
        fakeName: evaluateImportProductPass(fakeName),
      },
    },
    null,
    2
  )
);

console.log(failed ? `\n${failed} failed` : '\nNO FAKE PASS import gate checks passed');
process.exit(failed ? 1 : 0);
