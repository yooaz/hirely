#!/usr/bin/env node
/**
 * AI_RECONSTRUCTION_ENGINE — grounding (no hallucination) without live LLM.
 */
import { readFileSync } from 'fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { groundAiResumeJson } from '../core/parsing/ai-reconstruction-grounding.js';
import { AI_RECONSTRUCTION_CONFIDENCE_MIN } from '../core/parsing/ai-reconstruction-schema.js';
import { runAiReconstructionEngine } from '../core/parsing/ai-reconstruction-engine.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const fixture = readFileSync(join(root, 'tests/fixtures/yoaz-cv/fixture.txt'), 'utf8');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const hallucinated = {
  identity: { name: 'Yohann Azancot', title: 'Graphic Designer', email: 'yoaz@hotmail.fr' },
  experience: [{ role: 'Freelancer', company: 'FakeCorp Inc', bullets: ['Invented bullet'] }],
  education: ['Harvard University'],
  skills: ['Illustration'],
  clients: ['Nike'],
};

const grounded = groundAiResumeJson(hallucinated, fixture);
ok(AI_RECONSTRUCTION_CONFIDENCE_MIN === 80, 'confidence threshold 80');
ok(grounded.resume.identity?.name === 'Yohann Azancot', 'keeps grounded name');
ok(!grounded.resume.experience?.some((e) => /FakeCorp/i.test(e.company || '')), 'drops invented company');
ok(!grounded.resume.education?.some((e) => /Harvard/i.test(String(e))), 'drops invented school');
ok((grounded.resume.skills || []).includes('Illustration') || grounded.fieldScores.skills >= 80, 'keeps grounded skill');
ok(grounded.confidence >= 50, `confidence computed (${grounded.confidence})`);

const noLlm = await runAiReconstructionEngine(fixture, { skipLlm: true });
ok(noLlm.lowConfidence === true, 'skip LLM → low confidence');
ok(noLlm.archive?.length >= 1, 'archives text when not configured');

if (failed) process.exit(1);
console.log('\nqa-ai-reconstruction: all passed');
