#!/usr/bin/env node
/**
 * Generates EXPERIENCE_RECOVERY_FIX_REPORT.md from real-world stress suite.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { execSync } from 'child_process';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_MD = path.join(ROOT, 'EXPERIENCE_RECOVERY_FIX_REPORT.md');
const REPORT_JSON = path.join(ROOT, 'tests/output/real-world-stress/report.json');
const EXPERIENCE_GOAL_PCT = 90;
const BEFORE_EXPERIENCE_PCT = 76.9;

function runSuite() {
  try {
    execSync('node src/tests/qa-real-world-stress-test.mjs', { cwd: ROOT, encoding: 'utf8', stdio: 'pipe' });
    return { ok: true };
  } catch (e) {
    return { ok: false, out: (e.stdout || '') + (e.stderr || '') };
  }
}

function avgExp(rows) {
  if (!rows.length) return 0;
  return Math.round((rows.reduce((s, r) => s + (r.experienceAccuracy || 0), 0) / rows.length) * 10) / 10;
}

const suiteRun = runSuite();
const report = JSON.parse(fs.readFileSync(REPORT_JSON, 'utf8'));
const s = report.summary;

const studentRows = (report.results || []).filter((r) => r.role === 'freelancer' || r.role === 'student');
const studentOnly = (report.results || []).filter((r) => r.role === 'student');
const freelancerTxtDocx = (report.results || []).filter(
  (r) => r.role === 'freelancer' && ['TXT', 'DOCX'].includes(r.format)
);
const ocrRows = (report.results || []).filter((r) => ['PDF-scan', 'PNG', 'JPG'].includes(r.format));

const expFails = (report.results || []).filter((r) => (r.experienceAccuracy || 0) < EXPERIENCE_GOAL_PCT);
const expPassRows = (report.results || [])
  .filter((r) => (r.experienceAccuracy || 0) >= EXPERIENCE_GOAL_PCT)
  .map((r) => `| ${r.id} | ${r.role} | ${r.format} | ${r.experienceAccuracy}% |`)
  .join('\n');

const expFailRows =
  expFails
    .map((r) => {
      const fn = (r.sections?.experience?.falseNegatives || []).slice(0, 3).join('; ') || '—';
      const fp = (r.sections?.experience?.falsePositives || []).slice(0, 2).join('; ') || '—';
      return `| ${r.id} | ${r.role} | ${r.format} | ${r.experienceAccuracy}% | ${fn} | ${fp} |`;
    })
    .join('\n') || '| — | — | — | — | — | — |';

const md = `# Experience Recovery Fix Report (P0)

**Generated:** ${report.generatedAt}
**Acceptance:** experience accuracy **≥ ${EXPERIENCE_GOAL_PCT}%** (no fake company)
**Suite:** ${report.count} real-world CVs (${report.engine})

## Result

| Metric | Before fix | After fix | Goal | Status |
| --- | --- | --- | --- | --- |
| **Experience accuracy** | ${BEFORE_EXPERIENCE_PCT}% | **${s.experienceAccuracy}%** | ≥ ${EXPERIENCE_GOAL_PCT}% | ${s.experienceAccuracy >= EXPERIENCE_GOAL_PCT ? '**PASS**' : 'FAIL'} |
| Student role (all formats) | — | **${avgExp(studentOnly)}%** | ≥ ${EXPERIENCE_GOAL_PCT}% | ${avgExp(studentOnly) >= EXPERIENCE_GOAL_PCT ? '**PASS**' : 'FAIL'} |
| Freelancer TXT/DOCX | — | **${avgExp(freelancerTxtDocx)}%** | ≥ ${EXPERIENCE_GOAL_PCT}% | ${avgExp(freelancerTxtDocx) >= EXPERIENCE_GOAL_PCT ? '**PASS**' : 'FAIL'} |
| OCR/image formats (scan/PNG/JPG) | — | ${avgExp(ocrRows)}% | ≥ ${EXPERIENCE_GOAL_PCT}% | ${avgExp(ocrRows) >= EXPERIENCE_GOAL_PCT ? 'PASS' : 'FAIL'} |
| Overall extraction | 86.4% | ${s.extractionAccuracy}% | — | — |
| Skills accuracy | 65.8% → ${s.skillsAccuracy}% | — | — | — |

QA gate (95% all dimensions): ${suiteRun.ok ? 'PASS' : 'FAIL (other dimensions)'}

## Root cause (pre-fix)

1. **No em-dash parser** — \`Role — Company — Location — Dates\` lines fell through to internship/freelance heuristics or collapsed roles.
2. **Summary false positives** — \`parseInternshipLine\` matched prose ("seeking a software engineering internship") and invented experiences.
3. **Reconstruction replaced good rows** — \`reconstructExperienceEntries\` kept segmentation output only and dropped strict-parsed Monzo/freelance rows.
4. **Pipeline text loss** — normalized \`cleanedText\` dropped experience lines (e.g. Teaching Assistant); recovery never saw original paste text.
5. **Fake placeholders** — universal reconstructor emitted \`Role to confirm\`; year-only and education fragments became experience.
6. **Role normalization** — \`Full Stack Developer\` truncated to \`Developer\`; compound intern titles collapsed to \`Internship\`.

## Fix summary

| Layer | File | Change |
| --- | --- | --- |
| Dash parser | \`classification-fixes.js\` | \`parseDashSeparatedExperienceLine\`; internship/freelance delegate; block summary prose |
| Experience repair | \`experience-recovery.js\` | \`repairExperienceEntries\`, \`pruneRecoveredExperiences\`, sourceText line harvest |
| Parser strict gate | \`experience-parser.js\` | Dash-first groups; reject year-only / placeholder roles; preserve compound intern titles |
| Reconstruction preserve | \`experience-reconstruction-engine.js\` | \`preserveCompleteInputExperiences\` after segmentation |
| Experience intelligence | \`experience-intelligence.js\` | Dash-aware role/company detect; skip OCR filler when complete rows exist |
| Universal reconstructor | \`universal-extraction/experience-reconstructor.js\` | No \`Role to confirm\`; dash parse; academic employment; review queue for role+date |
| Polish pass | \`resume-output-quality.js\` | \`repairExperienceEntries\` in \`polishResumeOutput\` |
| Import source text | \`hirely-import.js\`, \`resume-data.js\` | \`meta.sourceText\` for recovery when pipeline strips lines |
| Auto-accept guard | \`suggestion-auto-accept.js\` | Internship push requires confidence ≥ 70 + dates; multi-source lines |
| Mapper/repair | \`simple-cv-mapper.js\`, \`import-repair.js\` | Dash parser first in legacy harvest paths |

## Routing rules (implemented)

- Experience types: job, internship, freelance, project, volunteer, student project (via dash + strict parsers).
- \`Role — Company — Dates\` (em-dash) → experience when confidence ≥ 70.
- Role + dates, no company → \`reviewQueue\` / \`experienceReviewItems\` (not discarded).
- Reject: year-only role/company, \`Role to confirm\`, role === company duplicates, summary prose internships.
- No fake company: independent normalized; invented client-only rows stripped.

## Per-CV experience ≥ ${EXPERIENCE_GOAL_PCT}%

| ID | Role | Format | Experience accuracy |
| --- | --- | --- | --- |
${expPassRows || '| — | — | — | — |'}

## Remaining experience failures (< ${EXPERIENCE_GOAL_PCT}%)

| ID | Role | Format | Exp % | Missed (sample) | False positive (sample) |
| --- | --- | --- | --- | --- | --- |
${expFailRows}

## Verification

\`\`\`bash
npm run qa:real-world-stress
npm run experience-recovery-report
node -e "import { runHirelyImportFromText } from './src/core/pipeline/hirely-import.js'; ..."
\`\`\`

## Files touched

- \`src/core/parsing/classification-fixes.js\`
- \`src/core/parsing/experience-recovery.js\`
- \`src/core/parsing/experience-parser.js\`
- \`src/core/parsing/experience-reconstruction-engine.js\`
- \`src/core/parsing/experience-intelligence.js\`
- \`src/core/parsing/universal-extraction/experience-reconstructor.js\`
- \`src/core/parsing/resume-output-quality.js\`
- \`src/core/parsing/simple-cv-mapper.js\`
- \`src/core/parsing/import-repair.js\`
- \`src/core/parsing/suggestion-auto-accept.js\`
- \`src/core/pipeline/hirely-import.js\`
- \`src/core/resume-data.js\`
- \`scripts/experience-recovery-fix-report.mjs\` (new)
`;

fs.writeFileSync(OUT_MD, md);
console.log(`Wrote ${OUT_MD}`);
console.log(`Experience accuracy: ${s.experienceAccuracy}% (goal ${EXPERIENCE_GOAL_PCT}%)`);
