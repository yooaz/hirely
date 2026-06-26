#!/usr/bin/env node
/**
 * Skill recovery — harvest from experience/project/portfolio text; 5–15 relevant skills.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { harvestSkillsFromDescriptions, SKILL_RECOVERY_MIN, SKILL_RECOVERY_MAX } from '../core/parsing/skill-recovery.js';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

function testCreativeHarvest() {
  const rd = {
    summary:
      'Creative professional specializing in illustration, graphic design and visual storytelling, with experience delivering posters, packaging, identities and visual assets.',
    experiences: [
      {
        role: 'Freelance Illustrator / Graphic Designer',
        company: 'Independent',
        bullets: [
          'Created illustration and graphic design work across posters, packaging, logos and brand assets.',
        ],
        specialties: [],
      },
    ],
    projects: ['Portfolio — editorial campaigns and packaging systems'],
    skills: ['Illustration', 'Graphic design', 'Visual identity'],
    tools: [],
    languages: [],
    clients: [],
    unsorted: [],
  };
  const skills = harvestSkillsFromDescriptions(rd);
  ok(skills.length >= SKILL_RECOVERY_MIN, `min ${SKILL_RECOVERY_MIN} skills (${skills.length})`);
  ok(skills.length <= SKILL_RECOVERY_MAX, `max ${SKILL_RECOVERY_MAX} skills (${skills.length})`);
  ok(!skills.some((s) => /photograph/i.test(s)), `no Photograph (${skills.join(', ')})`);
  for (const expected of [
    'Illustration',
    'Graphic Design',
    'Editorial Design',
    'Packaging',
    'Logo Design',
    'Brand Identity',
  ]) {
    ok(
      skills.some((s) => s.toLowerCase() === expected.toLowerCase()),
      `includes ${expected}`
    );
  }
}

async function testCreativeCvPipeline() {
  const raw = fs.readFileSync(path.join(ROOT, 'tests/fixtures/creative-cv/fixture.txt'), 'utf8');
  const imp = await runHirelyImportFromText(raw, { source: 'creative-cv' });
  const out = sanitizeResumeForDisplay(imp.resumeData);
  const skills = out.skills || [];
  ok(skills.length >= SKILL_RECOVERY_MIN, `creative-cv min skills (${skills.length})`);
  ok(skills.length <= SKILL_RECOVERY_MAX, `creative-cv max skills (${skills.length})`);
  ok(!skills.some((s) => /photograph/i.test(s)), 'creative-cv no Photograph');
  ok(skills.includes('Art Direction'), `Art Direction preserved (${skills.join(', ')})`);
}

async function testDeveloperCvPipeline() {
  const raw = fs.readFileSync(path.join(ROOT, 'tests/fixtures/developer-cv/fixture.txt'), 'utf8');
  const imp = await runHirelyImportFromText(raw, { source: 'developer-cv' });
  const out = sanitizeResumeForDisplay(imp.resumeData);
  const skills = out.skills || [];
  ok(skills.length >= SKILL_RECOVERY_MIN, `developer-cv min skills (${skills.length})`);
  ok(skills.some((s) => /system design|api design|distributed/i.test(s)), `tech skills (${skills.join(', ')})`);
}

testCreativeHarvest();
await testCreativeCvPipeline();
await testDeveloperCvPipeline();

if (failed) process.exit(1);
console.log('qa-skill-recovery: all passed');
