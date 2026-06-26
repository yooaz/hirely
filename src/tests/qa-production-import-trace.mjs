#!/usr/bin/env node
import {
  buildProductionImportTrace,
  auditPreviewTraceability,
  detectInformationLoss,
} from '../debug/production-import-trace.js';

let pass = true;
function check(name, ok) {
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}`);
  if (!ok) pass = false;
}

const raw = `Yohann Azancot\nSenior Designer\nyohann@example.com\n\nExperience\nLead Designer — Atelier Z — 2021–Present\n\nEducation\nMA Design — ENSAD\n\nSkills\nFigma · Branding`;

const trace = buildProductionImportTrace({
  rawText: raw,
  cleanedText: raw,
  structuredResume: {
    nameCandidates: ['Yohann Azancot', 'Experience'],
    titleCandidates: ['Senior Designer'],
    experiences: [{ role: 'Lead Designer', company: 'Atelier Z', dates: '2021–Present' }],
    education: ['MA Design — ENSAD'],
    skills: ['Figma', 'Branding'],
  },
  resumeData: {
    identity: { name: 'Yohann Azancot', title: 'Senior Designer', email: 'yohann@example.com' },
    experiences: ['Lead Designer — Atelier Z — 2021–Present'],
    education: ['MA Design — ENSAD'],
    skills: ['Figma'],
  },
  cvData: {
    name: 'Yohann Azancot',
    title: 'Senior Designer',
    email: 'yohann@example.com',
    experience: ['Lead Designer — Atelier Z — 2021–Present'],
    education: ['MA Design — ENSAD'],
    skills: ['Figma'],
  },
  previewText: 'Yohann Azancot\nSenior Designer\nyohann@example.com',
});

check('trace has RAW_TEXT_CAPTURE', !!trace.RAW_TEXT_CAPTURE?.rawText);
check('trace has IDENTITY_CANDIDATES', trace.IDENTITY_CANDIDATES?.nameCandidates?.length > 0);
check('trace has EXPERIENCE_CANDIDATES', trace.EXPERIENCE_CANDIDATES?.length > 0);
check('traceable clean import', auditPreviewTraceability(trace).pass);

const phantom = buildProductionImportTrace({
  rawText: '',
  cleanedText: '',
  importFailed: true,
  failureReason: 'IMPORT_NEEDS_PASTE',
  reviewQueue: [
    { id: '1', field: 'experiences', sourceText: 'Product Manager — Acme SaaS — 2019–Present' },
  ],
  resumeData: { identity: { name: 'Alex Martin', title: 'Senior Designer' }, experiences: [], unsorted: [] },
  previewText: '',
});

const phantomAudit = auditPreviewTraceability(phantom);
check('phantom review queue flagged', phantomAudit.violations.some((v) => v.reason === 'review_item_not_in_raw_text'));
check('phantom identity flagged when raw empty', phantomAudit.violations.some((v) => v.reason === 'identity_without_raw_text'));
check('OCR loss detected', detectInformationLoss(phantom).some((l) => l.field === 'raw_text'));

process.exit(pass ? 0 : 1);
