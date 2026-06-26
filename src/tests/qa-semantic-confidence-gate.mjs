#!/usr/bin/env node
/**
 * HIRELY H14 — Semantic classification confidence gate QA.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  applySemanticConfidenceGate,
  assessSemanticPlacement,
  auditSemanticConfidenceGate,
  SEMANTIC_CONFIDENCE_GATE_MIN,
} from '../core/validation/semantic-confidence-gate.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { classifySemanticBlockV2 } from '../core/parsing/semantic-classifier-v2.js';
import { applyReviewQueueToCvData } from '../core/parsing/review-queue.js';
import { auditLowConfidenceNotInCv } from '../core/parsing/recruiter-review-mode.js';
import { resumeDataToCvData } from '../core/resume-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(__dirname, '../../tests/output/semantic-confidence-gate/report.json');

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function hasText(list, pattern) {
  const re = pattern instanceof RegExp ? pattern : new RegExp(pattern, 'i');
  return (list || []).some((x) => re.test(String(x)));
}

function runVisualCommunicationCase() {
  const rd = {
    identity: { name: 'Jane Doe', title: 'Designer' },
    skills: ['Branding', 'visual communication', 'Typography'],
    education: ['BA Design'],
    experiences: [],
    unsorted: [],
  };
  const gated = applySemanticConfidenceGate(rd);
  assert(!hasText(gated.resumeData.skills, /visual\s+communication/i), 'not in skills');
  assert(!hasText(gated.resumeData.education, /visual\s+communication/i), 'not in education');
  const item = gated.reviewItems.find((i) => /visual\s+communication/i.test(i.sourceText));
  assert(item, 'review item created');
  assert(item.confidence < SEMANTIC_CONFIDENCE_GATE_MIN, 'low confidence');
  assert(item.detectedType, 'has detectedType');
  assert(item.sourceText, 'has sourceText');
  assert(item.reason, 'has reason');
  assert(item.requiresUserChoice, 'requires user choice');
  return { id: 'visual_communication', pass: true, item };
}

function runJbImpressionsCase() {
  const sem = classifySemanticBlockV2('JB Impressions');
  assert(sem.needsReview, 'JB Impressions needs review');
  const rd = {
    identity: { name: 'JB Impressions', title: 'Illustrator' },
    clients: ['JB Impressions'],
    experiences: [{ role: 'Intern', company: 'JB Impressions', dates: '2020' }],
    skills: [],
    education: [],
    unsorted: [],
  };
  const gated = applySemanticConfidenceGate(rd);
  assert(!/jb\s+impressions/i.test(gated.resumeData.identity?.name || ''), 'not in name');
  assert(!hasText(gated.resumeData.clients, /jb\s+impressions/i), 'not in clients');
  const expCompanies = (gated.resumeData.experiences || []).map((e) => e.company).join(' ');
  assert(!/jb\s+impressions/i.test(expCompanies), 'not in experience company');
  const item = gated.reviewItems.find((i) => /jb\s+impressions/i.test(i.sourceText));
  assert(item, 'JB Impressions review item');
  return { id: 'jb_impressions', pass: true, sem, item };
}

function runUrlLineCase() {
  const urlLine = 'yoaz.tumblr.com/portfolio';
  const assessed = assessSemanticPlacement(urlLine, 'experiences');
  assert(assessed.gate, 'URL line gated');
  const rd = {
    identity: { name: 'Jane Doe' },
    experiences: [
      { role: 'Designer', company: 'Studio', bullets: [urlLine], dates: '2020-2022' },
    ],
    education: [urlLine],
    skills: [urlLine],
    unsorted: [],
  };
  const gated = applySemanticConfidenceGate(rd);
  assert(!hasText(gated.resumeData.education, /tumblr/i), 'URL not in education');
  assert(!hasText(gated.resumeData.skills, /tumblr/i), 'URL not in skills');
  const bullets = (gated.resumeData.experiences || []).flatMap((e) => e.bullets || []);
  assert(!hasText(bullets, /tumblr/i), 'URL not in experience bullets');
  assert(
    gated.reviewItems.some((i) => /tumblr/i.test(i.sourceText)),
    'URL in review queue'
  );
  return { id: 'url_domain', pass: true };
}

function runHighConfidenceKeepsCase() {
  const rd = {
    identity: { name: 'Marie Dupont', title: 'Senior Illustrator' },
    skills: ['Illustration', 'Branding'],
    tools: ['Adobe Photoshop', 'Figma'],
    languages: ['French — Native', 'English — Fluent'],
    education: ['École Estienne — Graphic Design 2018'],
    experiences: [
      {
        role: 'Senior Illustrator',
        company: 'McCann Paris',
        dates: '2019 — 2023',
        bullets: ['Led packaging illustrations for global campaigns'],
      },
    ],
    unsorted: [],
  };
  const gated = applySemanticConfidenceGate(rd);
  assert(gated.resumeData.skills?.length >= 2, 'skills kept');
  assert(gated.resumeData.experiences?.length >= 1, 'experience kept');
  assert(gated.resumeData.identity?.name, 'name kept');
  const built = buildFinalResumeData(gated.resumeData);
  assert(built.finalResumeData, 'finalResumeData built');
  const audit = auditSemanticConfidenceGate(built.finalResumeData, built.reviewItems);
  assert(audit.pass, `final display clean: ${JSON.stringify(audit.issues)}`);
  const cv = applyReviewQueueToCvData(
    resumeDataToCvData(built.finalResumeData),
    built.reviewItems || []
  );
  const lowAudit = auditLowConfidenceNotInCv(cv, built.reviewItems || []);
  assert(lowAudit.pass, 'pending not in cv');
  return { id: 'high_confidence_kept', pass: true, gated: gated.stats.reviewCount };
}

function main() {
  fs.mkdirSync(path.dirname(OUT), { recursive: true });
  const cases = [
    runVisualCommunicationCase(),
    runJbImpressionsCase(),
    runUrlLineCase(),
    runHighConfidenceKeepsCase(),
  ];
  const pass = cases.every((c) => c.pass);
  const report = {
    engine: 'SEMANTIC_CONFIDENCE_GATE_V1',
    threshold: SEMANTIC_CONFIDENCE_GATE_MIN,
    generatedAt: new Date().toISOString(),
    cases,
    pass,
  };
  fs.writeFileSync(OUT, JSON.stringify(report, null, 2));
  console.log(pass ? 'PASS semantic-confidence-gate' : 'FAIL semantic-confidence-gate');
  console.log(JSON.stringify(report, null, 2));
  process.exit(pass ? 0 : 1);
}

main().catch((err) => {
  console.error('FAIL', err.message);
  process.exit(1);
});
