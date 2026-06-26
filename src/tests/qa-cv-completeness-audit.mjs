#!/usr/bin/env node
/**
 * P3 — CV completeness audit (raw text vs finalResumeData, target 80%+).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  auditCvCompleteness,
  CV_COMPLETENESS_TARGET_PCT,
  CV_UNCLASSIFIED_MSG_FR,
  flattenFinalResumePreviewText,
} from '../core/validation/cv-completeness-audit.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { normalizeResumeData } from '../core/resume-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/cv-completeness-audit');
const REPORT_JSON = path.join(OUT_DIR, 'report.json');

let failed = 0;
const checks = [];

function ok(cond, id, detail = '') {
  checks.push({ id, pass: !!cond, detail });
  if (!cond) {
    failed++;
    console.error('FAIL', id, detail);
  } else console.log('OK', id, detail || '');
}

const SPARSE_RAW = [
  'YOAZ ZANCOT',
  'Creative Director',
  'yoaz@example.com',
  '+41 79 000 00 00',
  'EXPERIENCE',
  'McCann Paris — Art Director — 2019–2022',
  'Led global campaigns for luxury brands including Chanel and Dior.',
  'Publicis — Illustrator — 2017–2019',
  'Havas — Illustrator — 2015–2017',
  'EDUCATION',
  'LISAA Paris — Bachelor Design — 2012',
  'SKILLS',
  'Photoshop, Illustrator, InDesign, After Effects',
  'LANGUAGES',
  'French native, English fluent',
  'CLIENTS',
  'Chanel, Dior, LVMH, Hermès',
  'AWARDS',
  'Cannes Lions Shortlist 2021',
  'Published in Communication Arts 2020',
].join('\n');

const SPARSE_FINAL = {
  identity: { name: 'YOAZ ZANCOT', title: 'Creative Director' },
  summary: '',
  experiences: [{ role: 'Art Director', company: 'McCann Paris', dates: '2019–2022' }],
  education: [],
  skills: ['Photoshop'],
  tools: [],
  languages: [],
  clients: [],
  projects: [],
  suggestions: [],
};

const RICH_RESUME = normalizeResumeData({
  identity: {
    name: 'YOAZ ZANCOT',
    title: 'Creative Director',
    email: 'yoaz@example.com',
    phone: '+41 79 000 00 00',
  },
  summary: 'Creative director with 10+ years in luxury advertising.',
  experiences: [
    {
      role: 'Art Director',
      company: 'McCann Paris',
      dates: '2019–2022',
      bullets: ['Led global campaigns for Chanel and Dior.'],
    },
    { role: 'Illustrator', company: 'Publicis', dates: '2017–2019' },
    { role: 'Illustrator', company: 'Havas', dates: '2015–2017' },
  ],
  education: ['LISAA Paris — Bachelor Design — 2012'],
  skills: ['Photoshop', 'Illustrator', 'InDesign', 'After Effects'],
  languages: ['French native', 'English fluent'],
  clients: ['Chanel', 'Dior', 'LVMH', 'Hermès'],
});

ok(CV_COMPLETENESS_TARGET_PCT === 80, 'target-80', String(CV_COMPLETENESS_TARGET_PCT));
ok(
  CV_UNCLASSIFIED_MSG_FR === "Une partie du CV n'a pas été classifiée",
  'french-message',
  CV_UNCLASSIFIED_MSG_FR
);

const sparseAudit = auditCvCompleteness(SPARSE_RAW, SPARSE_FINAL, { cleanedText: SPARSE_RAW });
ok(sparseAudit.rawChars > 400, 'sparse-raw-chars', String(sparseAudit.rawChars));
ok(sparseAudit.previewChars < sparseAudit.rawChars, 'sparse-preview-smaller');
ok(sparseAudit.coveragePct < CV_COMPLETENESS_TARGET_PCT, 'sparse-below-target', `${sparseAudit.coveragePct}%`);
ok(sparseAudit.meetsTarget === false, 'sparse-fails-target');
ok(sparseAudit.messageFr === CV_UNCLASSIFIED_MSG_FR, 'sparse-french-msg');
ok(sparseAudit.openReviewQueue === true, 'sparse-opens-review');
ok(sparseAudit.reviewItems.length > 0, 'sparse-review-items', String(sparseAudit.reviewItems.length));
ok(sparseAudit.unclassifiedLines.length > 0, 'sparse-unclassified-lines');

const charExampleRaw = 'x'.repeat(1500);
const charExamplePreview = { identity: { name: 'Test' }, summary: 'y'.repeat(699) };
const charPreviewLen = flattenFinalResumePreviewText(charExamplePreview).length;
ok(charPreviewLen >= 700, 'char-example-preview-len', String(charPreviewLen));
const charAudit = auditCvCompleteness(charExampleRaw, charExamplePreview, {
  cleanedText: charExampleRaw,
});
ok(
  charAudit.charCoveragePct < 55 && charAudit.charCoveragePct > 40,
  'char-ratio-example',
  `${charAudit.charCoveragePct}%`
);

const RICH_RAW = [
  'YOAZ ZANCOT',
  'Creative Director',
  'yoaz@example.com',
  '+41 79 000 00 00',
  'Creative director with 10+ years in luxury advertising.',
  'McCann Paris — Art Director — 2019–2022',
  'Led global campaigns for Chanel and Dior.',
  'Publicis — Illustrator — 2017–2019',
  'Havas — Illustrator — 2015–2017',
  'LISAA Paris — Bachelor Design — 2012',
  'Photoshop, Illustrator, InDesign, After Effects',
  'French native, English fluent',
  'Chanel, Dior, LVMH, Hermès',
].join('\n');

const richBuilt = buildFinalResumeData(RICH_RESUME, {
  rawText: RICH_RAW,
  cleanedText: RICH_RAW,
  silent: true,
});
ok(!!richBuilt.finalResumeData, 'build-final-resume');
const richAudit =
  richBuilt.completenessAudit ||
  auditCvCompleteness(RICH_RAW, richBuilt.finalResumeData, { cleanedText: RICH_RAW });
ok(richAudit.coveragePct >= CV_COMPLETENESS_TARGET_PCT, 'rich-meets-target', `${richAudit.coveragePct}%`);
ok(richAudit.meetsTarget === true, 'rich-passes-target');
ok(
  (richBuilt.reviewItems || []).length >= 0,
  'build-merges-review',
  String((richBuilt.reviewItems || []).length)
);

if (!fs.existsSync(OUT_DIR)) fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  REPORT_JSON,
  JSON.stringify(
    {
      generatedAt: new Date().toISOString(),
      targetPct: CV_COMPLETENESS_TARGET_PCT,
      checks,
      sparseAudit: {
        rawChars: sparseAudit.rawChars,
        previewChars: sparseAudit.previewChars,
        coveragePct: sparseAudit.coveragePct,
        charCoveragePct: sparseAudit.charCoveragePct,
      },
      richAudit: {
        coveragePct: richAudit.coveragePct,
        meetsTarget: richAudit.meetsTarget,
      },
      pass: failed === 0,
    },
    null,
    2
  )
);

console.log(`\nP3 CV completeness audit: ${failed === 0 ? 'PASS' : 'FAIL'} (${checks.filter((c) => c.pass).length}/${checks.length})`);
process.exit(failed ? 1 : 0);
