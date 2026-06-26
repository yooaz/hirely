#!/usr/bin/env node
/**
 * CREATIVE_CV_MODE — trigger roles + section priority in SECTION_ENGINE_V2.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  CREATIVE_CV_TRIGGER_ROLES,
  detectCreativeCvMode,
  detectCreativeCvTriggerRoles,
} from '../core/parsing/creative-cv-mode.js';
import { runSectionEngineV2 } from '../core/parsing/section-engine-v2.js';
import { buildStructuredResumeFromBlocks } from '../core/parsing/structured-resume-from-blocks.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

for (const role of CREATIVE_CV_TRIGGER_ROLES) {
  ok(detectCreativeCvTriggerRoles(`Senior ${role}`).includes(role), `triggers on: ${role}`);
}

const fixturePath = join(root, 'tests/fixtures/yoaz-cv/fixture.txt');
const yoaz = readFileSync(fixturePath, 'utf8');
const mode = detectCreativeCvMode(yoaz);
ok(mode.active === true, 'yoaz activates CREATIVE_CV_MODE');
ok(mode.triggerRoles?.length >= 1, 'trigger roles detected');
ok(mode.avoidCorporateStructure === true, 'avoidCorporateStructure flag');

const { structured, creativeMode } = runSectionEngineV2(yoaz, { rawText: yoaz });
ok(creativeMode?.active === true, 'section engine creative mode');
ok((structured.clients || []).length >= 2, 'clients populated');
ok((structured.experiences || []).length > 0, 'real jobs kept in experience');
const expHay = (structured.experiences || []).map((e) => `${e.role} ${e.company}`).join('\n');
ok(!/^(Adobe|Nike),?$/im.test(expHay), 'standalone brands not sole experience rows');

const fromBlocks = buildStructuredResumeFromBlocks([], {
  rawText: yoaz,
  cleanedText: yoaz,
});
ok(fromBlocks.metadata?.creativeCvMode?.active === true, 'blocks path carries creativeCvMode');

if (failed) process.exit(1);
console.log('\nqa-creative-cv-mode: all passed');
