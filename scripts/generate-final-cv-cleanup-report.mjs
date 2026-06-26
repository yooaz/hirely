#!/usr/bin/env node
/**
 * Generate FINAL_CV_CLEANUP_REPORT.md
 * node scripts/generate-final-cv-cleanup-report.mjs
 */
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';
import { execSync } from 'node:child_process';
import { sanitizeResumeForDisplay } from '../src/core/validation/sanitize-resume-display.js';
import { buildFinalResumeData } from '../src/core/validation/final-resume-contract.js';
import { normalizeResumeData } from '../src/core/resume-data.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const REPORT = join(root, 'FINAL_CV_CLEANUP_REPORT.md');

function run(cmd) {
  try {
    const out = execSync(cmd, { cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] });
    return { ok: true, out };
  } catch (e) {
    return { ok: false, out: (e.stdout || '') + (e.stderr || '') };
  }
}

function buildDirtyFixture() {
  return {
    identity: {
      name: 'Yohann Azancot',
      title: 'Graphic Designer & Illustrator',
      email: 'yoaz@hotmail.fr',
    },
    summary:
      'Creative professional specializing in illustration, graphic design, packaging, logos and visual identity.',
    experiences: [
      {
        role: 'Freelance Illustrator Graphic Designer packaging designer edition logos posters',
        company: '',
        dates: '2011–2022',
        startDate: '2011',
        endDate: '2022',
        bullets: ['packaging designer edition, logos...'],
      },
      {
        role: 'Designer',
        company: 'McCann G. Agency',
        dates: '2011–2014',
        startDate: '2011',
        endDate: '2014',
        bullets: ['Creative work for campaigns and brand assets.'],
      },
    ],
    education: [
      'LISAA — Web & Motion Design — 2011–2012',
      'Créapole — Visual Communication — 2008–2011',
      'LISAA Web and Motion Design 2011 2012 yoaz@hotmail.fr',
      'École supérieure — Visual Communication — observation maquette',
    ],
    skills: ['Illustration'],
    tools: ['Graphic Designer', 'Illustrator', 'Photoshop', 'InDesign', 'French', 'English', 'native'],
    languages: ['French — native', 'English — fluent'],
    clients: ['Nike'],
    unsorted: ['b wma', 'movies', 'reading'],
    meta: { rawText: 'OCR blob must not leak', cleanedText: 'cleaned blob' },
  };
}

const EXPECTED = {
  experiences: [
    {
      role: 'Freelance Illustrator / Graphic Designer',
      company: 'Independent / Freelance',
      dates: '2011–2022',
      bullet: 'Posters, packaging, logos, visual identity.',
    },
    {
      role: 'Designer',
      company: 'McCann G. Agency',
      dates: '2011–2014',
      bullet: 'Creative work for campaigns and brand assets.',
    },
  ],
  education: [
    'LISAA — Web & Motion Design — 2011–2012',
    'Créapole — Visual Communication — 2008–2011',
  ],
  skills: [
    'Illustration',
    'Graphic Design',
    'Packaging',
    'Logo Design',
    'Visual Identity',
    'Editorial Design',
  ],
  tools: ['Adobe Illustrator', 'Photoshop', 'InDesign'],
  languages: ['French — native', 'English — fluent'],
};

const dirty = buildDirtyFixture();
const sanitized = sanitizeResumeForDisplay(dirty);
const built = buildFinalResumeData(normalizeResumeData(dirty, { skipSanitize: true }));

const checks = [];

function check(label, ok, detail = '') {
  checks.push({ label, ok, detail });
}

const fl = sanitized.experiences?.[0];
const mc = sanitized.experiences?.[1];

check('Freelance role', fl?.role === EXPECTED.experiences[0].role, fl?.role);
check('Freelance company', fl?.company === EXPECTED.experiences[0].company, fl?.company);
check('Freelance dates', fl?.dates === EXPECTED.experiences[0].dates, fl?.dates);
check(
  'Freelance bullet',
  fl?.bullets?.[0] === EXPECTED.experiences[0].bullet,
  fl?.bullets?.[0]
);
check('McCann role', mc?.role === EXPECTED.experiences[1].role, mc?.role);
check('McCann company', /mccann/i.test(mc?.company || ''), mc?.company);
check(
  'McCann bullet',
  mc?.bullets?.[0] === EXPECTED.experiences[1].bullet,
  mc?.bullets?.[0]
);

check('Education count', sanitized.education?.length === 2, String(sanitized.education?.length));
check(
  'Education deduped',
  EXPECTED.education.every((row) =>
    sanitized.education?.some((e) => e.toLowerCase().includes(row.split(' — ')[0].toLowerCase()))
  ),
  sanitized.education?.join(' | ')
);
check(
  'No OCR garbage in education',
  !(sanitized.education || []).some((e) => /@|observation|maquette/i.test(e)),
  sanitized.education?.join(' | ')
);

check(
  'Skills complete',
  EXPECTED.skills.every((s) =>
    (sanitized.skills || []).some((x) => x.toLowerCase() === s.toLowerCase())
  ),
  sanitized.skills?.join(', ')
);

const toolsLow = (sanitized.tools || []).map((t) => t.toLowerCase());
check(
  'No roles in tools',
  !toolsLow.some((t) => /graphic designer|freelance|^designer$/.test(t)),
  sanitized.tools?.join(', ')
);
check(
  'No languages in tools',
  !toolsLow.some((t) => /french|english|native|fluent/.test(t)),
  sanitized.tools?.join(', ')
);
check('Tools allowlist', EXPECTED.tools.every((t) => toolsLow.includes(t.toLowerCase())), sanitized.tools?.join(', '));

check(
  'French native',
  (sanitized.languages || []).some((l) => /french.*native/i.test(l)),
  sanitized.languages?.join(', ')
);
check(
  'English fluent',
  (sanitized.languages || []).some((l) => /english.*fluent/i.test(l)),
  sanitized.languages?.join(', ')
);

check(
  'finalResumeData has no meta.rawText',
  !built.finalResumeData?.metaSafe?.rawText && !built.finalResumeData?.meta?.rawText,
  'meta stripped'
);
check(
  'Suggestions capped (no raw fragments in CV)',
  (built.finalResumeData?.suggestions || []).length <= 2,
  String(built.finalResumeData?.suggestions?.length)
);

const gate = run('node src/tests/qa-final-cv-clean-output.mjs');
const allOk = checks.every((c) => c.ok) && gate.ok;

const lines = [
  '# FINAL_CV_CLEANUP_REPORT',
  '',
  `**Result:** ${allOk && gate.ok ? 'PASS' : 'FAIL'}`,
  `**Date:** ${new Date().toISOString()}`,
  '',
  '## Mission',
  '',
  'Clean `finalResumeData` **before render** via `sanitizeResumeForDisplay` inside `buildFinalResumeData`.',
  'No OCR changes. No import pipeline changes.',
  '',
  '## Expected visible CV',
  '',
  '### Experience',
  '',
  ...EXPECTED.experiences.flatMap((e) => [
    `${e.role}`,
    e.company,
    e.dates,
    e.bullet,
    '',
  ]),
  '### Education',
  '',
  ...EXPECTED.education.map((e) => `- ${e}`),
  '',
  '### Skills',
  '',
  ...EXPECTED.skills.map((s) => `- ${s}`),
  '',
  '### Tools',
  '',
  ...EXPECTED.tools.map((t) => `- ${t}`),
  '',
  '### Languages',
  '',
  ...EXPECTED.languages.map((l) => `- ${l}`),
  '',
  '## Cleanup rules',
  '',
  '| Rule | Enforcement |',
  '|------|-------------|',
  '| No duplicate education | `dedupeEducationSchoolLines` + `pickTopDisplayEducation` |',
  '| No OCR garbage | `isCorruptEducationLine`, confidence gate, unsorted routing |',
  '| No role inside tools | `canonicalDisplayTool` + `TOOL_REJECT_RE` |',
  '| No language inside tools | language drain → `languages` section |',
  '| No raw fragments in CV | low-confidence lines → `suggestions` (max 2) |',
  '| Recruiter-ready experiences | `collapseRecruiterReadyExperiences` (max 2 roles) |',
  '',
  '## Sanitize path',
  '',
  '```',
  'resumeData → sanitizeResumeForDisplay() → lockResumeDataShape() → toFinalResumeDisplay() → UI',
  '```',
  '',
  '## Verification checks',
  '',
  '| Check | Status | Detail |',
  '|-------|--------|--------|',
  ...checks.map((c) => `| ${c.label} | ${c.ok ? 'PASS' : '**FAIL**'} | ${String(c.detail || '').replace(/\|/g, '/')} |`),
  '',
  '## Gate',
  '',
  `- qa-final-cv-clean-output: ${gate.ok ? 'PASS' : 'FAIL'}`,
  '',
  '## Actual sanitized output',
  '',
  '```json',
  JSON.stringify(
    {
      experiences: sanitized.experiences?.map((e) => ({
        role: e.role,
        company: e.company,
        dates: e.dates,
        bullets: e.bullets,
      })),
      education: sanitized.education,
      skills: sanitized.skills,
      tools: sanitized.tools,
      languages: sanitized.languages,
      suggestions: built.finalResumeData?.suggestions,
    },
    null,
    2
  ),
  '```',
  '',
];

writeFileSync(REPORT, lines.join('\n'));
console.log(lines.join('\n'));
process.exit(allOk && gate.ok ? 0 : 1);
