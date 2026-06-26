#!/usr/bin/env node
/**
 * HIRELY Extraction Recovery QA — never fail silently on low confidence.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  EXTRACTION_RECOVERY_V1,
  RECOVERY_LOW_CONFIDENCE_MIN,
  runExtractionRecovery,
  isCvOutputSafe,
  shouldShowExtractionRecovery,
} from '../core/validation/extraction-recovery.js';
import { UNDETECTED_INFORMATION_LABEL } from '../core/display/undetected-label.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf8');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

const STRONG_FRD = {
  identity: {
    name: 'Yohann Azancot',
    title: 'Graphic Designer',
    email: 'yoaz@hotmail.fr',
    phone: '+33 6 49 43 48 39',
  },
  summary: 'Illustrator with brand and packaging experience.',
  experiences: [
    { role: 'Designer', company: 'McCann', dates: '2011–2014', bullets: ['Campaign visuals'] },
    { role: 'Freelance Illustrator', company: 'Independent', dates: '2015–2022', bullets: ['Packaging'] },
  ],
  education: ['Créapole — Visual Communication — 2008–2011'],
  skills: ['Illustration', 'Packaging'],
  tools: ['Adobe Illustrator'],
  languages: ['French — Native', 'English — Fluent'],
};

const WEAK_FRD = {
  identity: { name: '', title: '', email: '' },
  summary: '',
  experiences: [],
  education: [],
  skills: [],
};

const PLACEHOLDER_FRD = {
  identity: { name: 'Alex Martin', email: 'alex@example.com' },
  experiences: [{ role: 'Designer', company: UNDETECTED_INFORMATION_LABEL, dates: '2020–2022' }],
  education: [],
  skills: ['Design'],
};

const LOW_CONF_CV = {
  name: 'Alex Martin',
  email: 'alex@example.com',
  experience: ['Designer — Agency — 2020–2022'],
  education: [],
  skills: [],
  meta: {
    fieldConfidenceV2: {
      fields: [
        { field: 'title', value: '', confidence: 35, needsReview: true },
        { field: 'education', value: '', confidence: 20, needsReview: true },
      ],
    },
  },
};

ok(EXTRACTION_RECOVERY_V1 === 'EXTRACTION_RECOVERY_V1', 'version constant');
ok(RECOVERY_LOW_CONFIDENCE_MIN === 70, 'low confidence threshold');

const strong = runExtractionRecovery({
  finalResumeData: STRONG_FRD,
  contract: { renderable: true },
  importQualityScore: 88,
});
ok(strong.version === EXTRACTION_RECOVERY_V1, 'strong report version');
ok(isCvOutputSafe(strong), 'strong CV output safe');
ok(!shouldShowExtractionRecovery(strong) || strong.counts.issues === 0, 'strong CV minimal recovery');
ok(strong.detectedIssues !== undefined, 'detectedIssues array');
ok(strong.missingSections !== undefined, 'missingSections array');
ok(strong.lowConfidenceFields !== undefined, 'lowConfidenceFields array');
ok(strong.silentFailurePrevented === strong.showRecovery, 'silent failure flag');

const weak = runExtractionRecovery({
  finalResumeData: WEAK_FRD,
  contract: { renderable: true },
  importQualityScore: 32,
});
ok(weak.showRecovery, 'weak extraction shows recovery');
ok(!isCvOutputSafe(weak), 'weak CV not output safe');
ok(weak.blockRender, 'weak CV blocks render (no name/email)');
ok(weak.missingSections.length >= 2, 'weak CV missing sections');
ok(weak.silentFailurePrevented, 'weak CV never silent');

const placeholder = runExtractionRecovery({
  finalResumeData: PLACEHOLDER_FRD,
  contract: { renderable: true },
});
ok(placeholder.showRecovery, 'placeholder shows recovery');
ok(!isCvOutputSafe(placeholder), 'placeholder not output safe');
ok(placeholder.detectedIssues.some((i) => i.placeholder), 'placeholder issue surfaced');
ok(placeholder.blockRender || !placeholder.outputSafe, 'placeholder blocks broken output');

const lowConf = runExtractionRecovery({ cvData: LOW_CONF_CV, contract: { renderable: true } });
ok(lowConf.lowConfidenceFields.length >= 1, 'low confidence fields listed');
ok(lowConf.showRecovery, 'low confidence shows recovery UI');

ok(indexHtml.includes('extractionRecoveryPanel'), 'index.html recovery panel host');
ok(indexHtml.includes('extraction-recovery-panel.js'), 'index.html recovery panel script');
ok(indexHtml.includes('extraction-recovery.css'), 'index.html recovery CSS');
ok(indexHtml.includes('getExtractionRecoveryReport'), 'index.html recovery report fn');
ok(indexHtml.includes('renderExtractionRecoveryPanel'), 'index.html recovery render fn');
ok(indexHtml.includes('extraction-recovery.js'), 'index.html recovery engine import');
ok(indexHtml.includes('buildMergedExtractionRecoveryReport'), 'index.html merged recovery report');
ok(indexHtml.includes('syncRecoveryModeChrome'), 'index.html recovery mode chrome');

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll extraction recovery QA checks passed.');
