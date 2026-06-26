#!/usr/bin/env node
/**
 * Skill recovery report — harvest from experience/project/portfolio; 5–15 skills.
 * Output: SKILL_RECOVERY_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../src/core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../src/core/validation/sanitize-resume-display.js';
import {
  harvestSkillsFromDescriptions,
  SKILL_RECOVERY_MIN,
  SKILL_RECOVERY_MAX,
} from '../src/core/parsing/skill-recovery.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'SKILL_RECOVERY_REPORT.md');

const FIXTURES = [
  { id: 'creative-cv', label: 'Creative CV' },
  { id: 'yoaz-cv', label: 'Yoaz CV' },
  { id: 'developer-cv', label: 'Developer CV' },
  { id: 'marketing-cv', label: 'Marketing CV' },
  { id: 'consultant-cv', label: 'Consultant CV' },
];

const CREATIVE_EXPECTED = [
  'Illustration',
  'Graphic Design',
  'Editorial Design',
  'Packaging',
  'Logo Design',
  'Brand Identity',
  'Art Direction',
];

async function evaluateFixture(entry, extractionMethod = 'paste') {
  const fixturePath = path.join(ROOT, 'tests/fixtures', entry.id, 'fixture.txt');
  const raw = fs.readFileSync(fixturePath, 'utf8');
  const imp = await runHirelyImportFromText(raw, { source: entry.id, extractionMethod });
  const before = imp.resumeData?.skills || [];
  const sanitized = sanitizeResumeForDisplay(imp.resumeData);
  const harvested = harvestSkillsFromDescriptions(sanitized, {
    min: SKILL_RECOVERY_MIN,
    max: SKILL_RECOVERY_MAX,
  });
  const hasPhotograph = [...before, ...harvested].some((s) => /^photograph:?$/i.test(String(s)));
  const creativeHits = CREATIVE_EXPECTED.filter((e) =>
    harvested.some((s) => s.toLowerCase() === e.toLowerCase())
  );

  return {
    ...entry,
    before,
    skills: harvested,
    count: harvested.length,
    hasPhotograph,
    creativeHits,
    inRange: harvested.length >= SKILL_RECOVERY_MIN && harvested.length <= SKILL_RECOVERY_MAX,
  };
}

async function main() {
  const rows = [];
  for (const entry of FIXTURES) {
    const row = await evaluateFixture(entry);
    rows.push(row);
    process.stderr.write(`[skill-recovery] ${entry.id} ${row.count} skills…\n`);
  }

  let ocrRow = null;
  const ocrPath = path.join(ROOT, 'tests/fixtures/yoaz-pdf-live/ocr-fragmented.txt');
  if (fs.existsSync(ocrPath)) {
    const raw = fs.readFileSync(ocrPath, 'utf8');
    const imp = await runHirelyImportFromText(raw, {
      source: 'yoaz-pdf-live-fragmented',
      extractionMethod: 'ocr',
    });
    const sanitized = sanitizeResumeForDisplay(imp.resumeData);
    const skills = sanitized.skills || [];
    ocrRow = {
      id: 'yoaz-pdf-live-fragmented',
      label: 'Fragmented OCR sample',
      skills,
      count: skills.length,
      hasPhotograph: skills.some((s) => /^photograph:?$/i.test(String(s))),
      creativeHits: CREATIVE_EXPECTED.filter((e) =>
        skills.some((s) => s.toLowerCase() === e.toLowerCase())
      ),
      inRange: skills.length >= SKILL_RECOVERY_MIN && skills.length <= SKILL_RECOVERY_MAX,
    };
    rows.push(ocrRow);
  }

  const creativeRows = rows.filter((r) => /creative|yoaz|fragmented/i.test(r.id));
  const creativeGoalMet = creativeRows.every(
    (r) => r.inRange && !r.hasPhotograph && r.creativeHits.length >= 5
  );
  const allInRange = rows.every((r) => r.inRange || !/creative|yoaz|fragmented/i.test(r.id));
  const noPhotograph = rows.every((r) => !r.hasPhotograph);
  const goalMet = creativeGoalMet && noPhotograph;

  const lines = [];
  lines.push('# SKILL RECOVERY REPORT');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('Engine: `harvestSkillsFromDescriptions`');
  lines.push('Pipeline: production import + skill harvest + `sanitizeResumeForDisplay`');
  lines.push('');
  lines.push('## Goal');
  lines.push('');
  lines.push(`**${SKILL_RECOVERY_MIN}–${SKILL_RECOVERY_MAX} relevant skills** harvested from experience, project, and portfolio descriptions.`);
  lines.push('Reject OCR junk such as `Photograph`.');
  lines.push('');
  lines.push(`### Goal status: **${goalMet ? 'MET' : 'NOT MET'}**`);
  lines.push('');
  lines.push('## Rules enforced');
  lines.push('');
  lines.push('- Harvest from experience roles, bullets, descriptions, and specialties');
  lines.push('- Harvest from project and portfolio text');
  lines.push('- Harvest from summary and explicit skills section (minus OCR garbage)');
  lines.push('- Map branding / visual identity → Brand Identity');
  lines.push('- Posters → Editorial Design; logos → Logo Design');
  lines.push(`- Clamp output to ${SKILL_RECOVERY_MIN}–${SKILL_RECOVERY_MAX} skills`);
  lines.push('');
  lines.push('## Fixtures');
  lines.push('');
  lines.push('| Fixture | Skills | In range | Photograph rejected | Creative hits |');
  lines.push('|---------|-------:|:--------:|:-------------------:|:-------------:|');
  for (const row of rows) {
    lines.push(
      `| ${row.label} | ${row.count} | ${row.inRange ? '✓' : '✗'} | ${row.hasPhotograph ? '✗' : '✓'} | ${row.creativeHits?.length ?? '—'}/${CREATIVE_EXPECTED.length} |`
    );
  }
  lines.push('');
  lines.push('## Creative expected skills');
  lines.push('');
  for (const skill of CREATIVE_EXPECTED) {
    lines.push(`- ${skill}`);
  }
  lines.push('');
  lines.push('## Per-fixture output');
  lines.push('');
  for (const row of rows) {
    lines.push(`### ${row.label} (\`${row.id}\`)`);
    lines.push('');
    lines.push(`Skills (${row.count}): ${(row.skills || []).join(' · ') || '—'}`);
    if (row.creativeHits?.length) {
      lines.push('');
      lines.push(`Creative matches: ${row.creativeHits.join(', ')}`);
    }
    lines.push('');
  }
  lines.push('## Run');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run qa:skill-recovery');
  lines.push('npm run skill:recovery-report');
  lines.push('```');

  fs.writeFileSync(OUT, `${lines.join('\n')}\n`);
  console.log(`Wrote ${OUT}`);
  console.log(`Goal ${goalMet ? 'MET' : 'NOT MET'} — creative rows in range with ≥5 hits, no Photograph`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
