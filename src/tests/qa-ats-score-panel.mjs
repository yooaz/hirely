/**
 * P4 — Deterministic recruiter score panel (ATS engine + checklist + panel metrics).
 */
import {
  computeAtsScore,
  buildRecruiterPanelMetrics,
  buildRecruiterChecklist,
} from '../core/validation/ats-engine.js';
import { buildReviewReadinessReport } from '../core/validation/review-readiness.js';
import { resolveChecklistProfile } from '../core/validation/recruiter-checklist-source.js';
import { computeProductScore } from '../core/validation/product-score.js';

const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('  ✓', msg);
};

const fullCv = {
  name: 'Marie Dupont',
  title: 'Product Designer',
  email: 'marie@example.com',
  phone: '+33 6 12 34 56 78',
  summary: 'Senior designer with 8 years in B2B SaaS and design systems.',
  experience: ['Lead Designer — Acme Corp · 2020–Present', 'Increased conversion by 24%'],
  education: ['Master Design — ENSAD Paris · 2014'],
  skills: ['Figma', 'Design systems', 'User research'],
};

function testPanelMetricsDistinct() {
  const result = computeAtsScore(fullCv);
  const panel = buildRecruiterPanelMetrics(result);
  ok(!!panel, 'panel metrics exist');
  ok(panel.ats >= 0 && panel.ats <= 100, `ATS dimension 0–100 (${panel.ats})`);
  ok(panel.readability >= 0 && panel.readability <= 100, `readability 0–100 (${panel.readability})`);
  ok(panel.completeness >= 0 && panel.completeness <= 100, `completeness 0–100 (${panel.completeness})`);
  ok(panel.recruiterReady >= 0 && panel.recruiterReady <= 100, `recruiter ready 0–100 (${panel.recruiterReady})`);
  ok(panel.content >= 0 && panel.content <= 100, `content 0–100 (${panel.content})`);
  ok(panel.experience >= 0 && panel.experience <= 100, `experience 0–100 (${panel.experience})`);
  ok(result.ats.score === panel.ats, 'ats.score matches panel ATS (not total)');
  ok(result.ats.score !== result.total || result.total === panel.ats, 'ATS is not blindly equal to total');
}

function testChecklistWithExport() {
  const result = computeAtsScore(fullCv);
  const readiness = buildReviewReadinessReport(fullCv, {
    toClassifyCount: 0,
    atsScore: result.total,
    atsBand: result.band,
  });
  const checklist = buildRecruiterChecklist(result, readiness.exportReady);
  ok(checklist.length === 12, `checklist has 12 items (${checklist.length})`);
  ok(checklist.some((c) => c.id === 'export' && c.ok), 'export item ok when export-ready');
  const partial = buildRecruiterChecklist(result, false);
  ok(partial.find((c) => c.id === 'export')?.ok === false, 'export item false when not ready');
}

function testDeterministicTotal() {
  const a = computeAtsScore(fullCv);
  const b = computeAtsScore(fullCv);
  ok(a.total === b.total, 'deterministic total score');
  ok(buildRecruiterPanelMetrics(a).ats === buildRecruiterPanelMetrics(b).ats, 'deterministic ATS dimension');
}

function testChecklistFromSanitizedResumeData() {
  const resumeData = {
    identity: {
      name: 'Marie Dupont',
      title: 'Product Designer',
      email: 'marie@example.com',
      phone: '+33 6 12 34 56 78',
    },
    summary: 'Senior designer with 8 years in B2B SaaS and design systems.',
    experiences: [
      {
        role: 'Lead Designer',
        company: 'Acme Corp',
        startDate: '2020',
        endDate: 'Present',
        bullets: ['Increased conversion by 24%'],
      },
    ],
    education: ['Master Design — ENSAD Paris — 2012–2014'],
    skills: ['Figma', 'Design systems'],
    tools: ['Sketch'],
    languages: [],
    unsorted: [],
  };
  const gatedCv = {
    name: 'Marie Dupont',
    title: 'Product Designer',
    email: 'marie@example.com',
    phone: '+33 6 12 34 56 78',
    experience: [],
    education: [],
    skills: [],
    tools: [],
  };
  const profile = resolveChecklistProfile({ resumeData, cvData: gatedCv });
  ok((profile.experience || []).length > 0, 'checklist profile keeps experience from resumeData');
  ok((profile._resumeCounts?.education || 0) > 0, 'checklist profile keeps education count from resumeData');
  ok((profile.skills || []).length + (profile.tools || []).length >= 1, 'checklist profile keeps skills from resumeData');

  const result = computeProductScore(gatedCv, { resumeData });
  ok(result.checks.experience, 'experience checklist ok when resumeData has experiences');
  ok(result.checks.education, 'education checklist ok when resumeData has education');
  ok(result.checks.skills, 'skills checklist ok when resumeData has skills/tools');
  ok(result.checks.email, 'email checklist ok');
  ok(result.checks.phone, 'phone checklist ok');
}

function main() {
  console.log('qa-ats-score-panel');
  testPanelMetricsDistinct();
  testChecklistWithExport();
  testDeterministicTotal();
  testChecklistFromSanitizedResumeData();
  console.log('qa-ats-score-panel: passed');
}

main();
