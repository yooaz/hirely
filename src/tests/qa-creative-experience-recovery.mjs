#!/usr/bin/env node
/**
 * P0 — CREATIVE_EXPERIENCE_RECOVERY_ENGINE QA.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  CREATIVE_EXPERIENCE_RECOVERY_ENGINE,
  CREATIVE_ANCHOR_CLIENTS,
  runCreativeExperienceRecovery,
  auditCreativeExperienceRecovery,
  recoverSegmentedCreativeExperiences,
} from '../core/parsing/creative-experience-recovery-engine.js';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const FIXTURE = path.join(ROOT, 'tests/fixtures/creative-experience-rich.txt');
const OUT = path.join(ROOT, 'tests/output/creative-experience-recovery/report.json');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const text = fs.readFileSync(FIXTURE, 'utf8');

const segmented = recoverSegmentedCreativeExperiences(
  [
    'Art Director — McCann Paris — 2018 — 2020',
    'Creative Director — BETC Agency — 2020 — 2023',
    'Illustration — Nike projects — 2016 — 2020',
    'Design — Adobe — 2019 — 2021',
    'Freelance Illustrator — Independent — 2011 — Present',
  ],
  []
);
ok(segmented.length >= 5, `segmented ${segmented.length} distinct experiences (no collapse)`);
ok(
  segmented.some((e) => /art\s+director/i.test(e.role) && /mccann/i.test(e.company)),
  'Art Director @ McCann'
);
ok(
  segmented.some((e) => /creative\s+director/i.test(e.role)),
  'Creative Director entry'
);
ok(
  segmented.some((e) => /nike/i.test(e.company || e.client || e.project)),
  'Nike projects entry'
);

const audit = auditCreativeExperienceRecovery(text);
ok(audit.engine === CREATIVE_EXPERIENCE_RECOVERY_ENGINE, 'engine id');
ok(audit.experienceCount >= 5, `audit experience count ${audit.experienceCount}`);
ok(audit.recallPct >= 70, `anchor recall ${audit.recallPct}% (target ≥70%)`);

for (const brand of ['Nike', 'Adobe', 'Marvel', 'PlayStation']) {
  ok(
    audit.anchorFound.some((c) => c.toLowerCase() === brand.toLowerCase()),
    `anchor brand recovered: ${brand}`
  );
}

const parsed = runSectionEngineV2(text, { rawText: text });
const exps = parsed.structured?.experiences || [];
ok(exps.length >= 4, `pipeline experiences ${exps.length} (no per-client fake jobs)`);
ok((parsed.structured?.clients || []).length >= 2, `clients harvested ${(parsed.structured?.clients || []).length}`);

const wired =
  parsed.structured?.metadata?.creativeExperienceRecovery?.engine === CREATIVE_EXPERIENCE_RECOVERY_ENGINE;
ok(wired, 'section engine wires creative recovery');

const hasFields = exps.every(
  (e) => typeof e === 'object' && ('role' in e || 'company' in e)
);
ok(hasFields, 'experiences are structured objects with role/company');

const collapsed = exps.some((e) =>
  /nike.*marvel.*adobe|marvel.*nike.*adobe/i.test(`${e.role} ${e.company} ${(e.bullets || []).join(' ')}`)
);
ok(!collapsed, 'no mega-collapsed experience line');

const manual = runCreativeExperienceRecovery(
  { experiences: [], clients: [], unsorted: [] },
  text,
  { forceCreative: true }
);
ok(manual.experiences.length >= 4, `forced creative recovery ${manual.experiences.length} real jobs`);
ok((manual.structured?.clients || []).length >= 4, `forced client harvest ${(manual.structured?.clients || []).length}`);

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify(
    {
      feature: 'CREATIVE_EXPERIENCE_RECOVERY_ENGINE',
      generatedAt: new Date().toISOString(),
      engine: CREATIVE_EXPERIENCE_RECOVERY_ENGINE,
      anchorClients: CREATIVE_ANCHOR_CLIENTS,
      audit,
      pipelineCount: exps.length,
      segmentedCount: segmented.length,
      pass: failed === 0,
    },
    null,
    2
  )
);

console.log(failed ? '\nFAIL creative-experience-recovery' : '\nPASS creative-experience-recovery');
process.exit(failed ? 1 : 0);
