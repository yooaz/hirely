#!/usr/bin/env node
/**
 * CV Section Contract — strict section rules; violations → review queue, never displayed.
 */
import {
  satisfiesLanguageContract,
  satisfiesToolContract,
  satisfiesClientContract,
  satisfiesEducationContract,
  satisfiesSkillContract,
  assignFactWithContract,
  enforceStructuredSectionContract,
  enforceCvDataSectionContract,
} from '../core/parsing/cv-section-contract.js';
import { buildCvFromFacts } from '../core/parsing/cv-from-facts.js';
import { applyReviewQueueToCvData } from '../core/parsing/review-queue.js';
import { emptyStructuredResume } from '../core/parsing/structured-resume.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

// Languages — whitelist only
ok(satisfiesLanguageContract('English — fluent').valid, 'English — fluent allowed');
ok(satisfiesLanguageContract('French').valid, 'French allowed');
ok(satisfiesLanguageContract('Bilingual').valid, 'Bilingual standalone allowed');
ok(!satisfiesLanguageContract('Mandarin — fluent').valid, 'Mandarin rejected');
ok(!satisfiesLanguageContract('Japanese').valid, 'Japanese rejected');

// Tools — software names
ok(satisfiesToolContract('Photoshop').valid, 'Photoshop is tool');
ok(satisfiesToolContract('Adobe Illustrator').valid, 'Illustrator is tool');
ok(!satisfiesToolContract('Packaging').valid, 'Packaging not a tool');

// Clients — company names
ok(satisfiesClientContract('Nike').valid, 'Nike is client');
ok(satisfiesClientContract('Adobe').valid, 'Adobe is client');
ok(!satisfiesClientContract('Branding').valid, 'Branding not a client');

// Education — school names
ok(satisfiesEducationContract('LISAA — Web & Motion Design').valid, 'LISAA is education');
ok(!satisfiesEducationContract('2019 — 2021').valid, 'date range not education');

// Skills — professional capabilities
ok(satisfiesSkillContract('Packaging').valid, 'Packaging is skill');
ok(satisfiesSkillContract('Branding').valid, 'Branding is skill');
ok(!satisfiesSkillContract('Nike').valid, 'Nike not a skill');
ok(!satisfiesSkillContract('Photoshop').valid, 'Photoshop not a skill section');

// Fact assignment rejects violations
const structured = emptyStructuredResume();
const reviewItems = [];
function pushUnique(arr, value) {
  const v = String(value || '').trim();
  if (!v) return;
  if (!arr.some((x) => String(x).toLowerCase() === v.toLowerCase())) arr.push(v);
}

assignFactWithContract(structured, reviewItems, 'language', {
  value: 'Mandarin — fluent',
  confidence: 0.92,
}, pushUnique);
ok(structured.languages.length === 0, 'invalid language not assigned');
ok(reviewItems.length === 1, 'invalid language queued');

assignFactWithContract(structured, reviewItems, 'skill', {
  value: 'Packaging',
  confidence: 0.92,
}, pushUnique);
ok(structured.skills.includes('Packaging'), 'valid skill assigned');

// buildCvFromFacts — misclassified tool in skills path blocked at contract
const misFacts = [
  { id: 'f1', type: 'tool', value: 'Packaging', confidence: 0.92, sourceLine: 'Packaging' },
  { id: 'f2', type: 'language', value: 'English — fluent', confidence: 0.94, sourceLine: 'English — fluent' },
  { id: 'f3', type: 'client', value: 'Nike', confidence: 0.96, sourceLine: 'Nike' },
  { id: 'f4', type: 'skill', value: 'Photoshop', confidence: 0.9, sourceLine: 'Photoshop' },
];
const built = buildCvFromFacts(misFacts);
ok(!built.structured.tools.includes('Packaging'), 'Packaging not in tools (not software)');
ok(built.structured.languages.some((l) => /english/i.test(l)), 'English in languages');
ok(built.structured.clients.some((c) => /nike/i.test(c)), 'Nike in clients');
ok(!built.structured.skills.includes('Photoshop'), 'Photoshop rejected from skills');
ok(
  built.reviewQueue.some((i) => i.action === 'section_contract_violation'),
  'contract violations in review queue'
);

// enforceStructuredSectionContract strips invalid display content
const dirty = emptyStructuredResume();
dirty.languages = ['English — fluent', 'Mandarin — fluent'];
dirty.skills = ['Packaging', 'Nike'];
dirty.tools = ['Branding'];
const enforced = enforceStructuredSectionContract(dirty);
ok(
  enforced.structured.languages.length === 1 &&
    enforced.structured.languages[0].includes('English'),
  'enforce keeps valid language only'
);
ok(!enforced.structured.skills.includes('Nike'), 'enforce strips invalid skill');
ok(enforced.reviewItems.length >= 3, 'enforce queues violations');

// cvData export path never shows invalid sections
const cv = {
  name: 'Test',
  languages: ['French', 'Korean'],
  skills: ['Illustration', 'Marvel'],
  tools: ['Figma', 'Music'],
  clients: ['Adobe'],
  education: ['LISAA Paris', 'Random text only'],
};
const gated = applyReviewQueueToCvData(cv, enforced.reviewItems);
ok(!gated.languages.includes('Korean'), 'Korean not displayed');
ok(!gated.skills.includes('Marvel'), 'Marvel not in skills display');
ok(!gated.tools.includes('Music'), 'Music not in tools display');
ok(gated.languages.includes('French'), 'French still displayed');

console.log(failed ? `\n${failed} FAILED` : '\nAll CV section contract checks passed');
process.exit(failed ? 1 : 0);
