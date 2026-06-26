#!/usr/bin/env node
/**
 * EXPERIENCE_RECOVERY — zero experiences + long text / year spans → draft experiences.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  detectYearSignals,
  shouldRunExperienceRecovery,
  scanDraftExperiences,
  runExperienceRecovery,
  EXPERIENCE_RECOVERY_MIN_CHARS,
} from '../core/parsing/experience-recovery.js';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';
import { assertExperienceRecovery } from '../core/pipeline/pipeline-contract.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const ok = (cond, msg) => {
  if (!cond) throw new Error(msg);
  console.log('OK', msg);
};

const fixturePath = join(root, 'tests/fixtures/yoaz-cv/fixture.txt');
const sample = existsSync(fixturePath)
  ? readFileSync(fixturePath, 'utf8')
  : `Jane Doe\nIllustrator\nWORK EXPERIENCE\nSenior Illustrator — McCann Paris — 2018–2024\nFreelance Designer — 2015–2017\nEDUCATION\nArt School 2014`;

ok(sample.length > EXPERIENCE_RECOVERY_MIN_CHARS, 'fixture long enough');

const years = detectYearSignals(sample);
ok(years.hasYearSpan, `year spans detected (${years.rangeCount})`);

const gate = shouldRunExperienceRecovery(0, sample);
ok(gate.run, `recovery gate open (${gate.reason})`);

const drafts = scanDraftExperiences(sample);
ok(drafts.length > 0, `draft scan found ${drafts.length} experiences`);
ok(
  drafts.every((d) => typeof d.confidence === 'number' && d.confidence >= 55),
  'each draft has confidence >= 55'
);
ok(
  drafts.some((d) => d.startDate),
  'at least one draft has startDate'
);

const parsed = runSectionEngineV2(sample, { rawText: sample });
const stripped = {
  ...parsed.structured,
  experiences: [],
};
const recovered = runExperienceRecovery(stripped, sample);
ok(recovered.recovered, 'runExperienceRecovery populated experiences');
ok(recovered.experienceCount > 0, `recovered count ${recovered.experienceCount}`);
ok(
  years.hasYearSpan ? recovered.experienceCount > 0 : true,
  'never zero experiences when years detected'
);

const check = assertExperienceRecovery(recovered.structured, sample);
ok(check.ok, 'assertExperienceRecovery passes after recovery');

const noRun = shouldRunExperienceRecovery(3, sample);
ok(!noRun.run, 'skips when experiences already present');

console.log('\nEXPERIENCE_RECOVERY QA OK —', recovered.experienceCount, 'drafts');
