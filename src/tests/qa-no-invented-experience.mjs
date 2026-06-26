#!/usr/bin/env node
/**
 * P0 — No invented experience sentences.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { auditResumeDataForInventedContent } from '../core/display/undetected-label.js';
import {
  auditInventedExperience,
  INVENTED_EXPERIENCE_BULLET_RE,
} from '../core/parsing/invented-experience-guard.js';
import { runCreativeExperienceRecovery } from '../core/parsing/creative-experience-recovery-engine.js';
import { findLongestDictionaryTerm, CLIENT_TERMS } from '../data/dictionaries/json-dictionary-match.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/no-invented-experience/report.json');

const FIXTURES = [
  { id: 'creative-cv', file: 'tests/fixtures/creative-cv/fixture.txt' },
  { id: 'yoaz-cv', file: 'tests/fixtures/yoaz-cv/fixture.txt' },
  { id: 'creative-experience-rich', file: 'tests/fixtures/creative-experience-rich.txt' },
  { id: 'designer-cv-rich', file: 'tests/fixtures/designer-cv-rich.txt' },
];

const FORBIDDEN_PHRASES = [
  /^contributed\s+as\s+at\b/i,
  /^contributed\s+as\b/i,
  /^delivered\s+creative\s+work\s+for\b/i,
  /^designed\s+and\s+delivered\s+creative\s+work\b/i,
];

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

function scanExperiences(experiences, label) {
  const hits = [];
  for (const exp of experiences || []) {
    const parts = [
      exp?.role,
      exp?.company,
      exp?.description,
      ...(exp?.bullets || []),
    ].map((x) => String(x || '').trim()).filter(Boolean);

    if (auditInventedExperience(exp).invented) {
      hits.push({ label, text: parts.join(' | '), reason: 'invented_guard' });
    }
    for (const p of parts) {
      if (FORBIDDEN_PHRASES.some((re) => re.test(p))) hits.push({ label, text: p, reason: 'forbidden_phrase' });
      if (INVENTED_EXPERIENCE_BULLET_RE.test(p)) hits.push({ label, text: p, reason: 'invented_bullet' });
    }
    const company = String(exp?.company || '').trim();
    const role = String(exp?.role || '').trim();
    if (company && findLongestDictionaryTerm(company, CLIENT_TERMS) && (!role || /^at\s+/i.test(role))) {
      hits.push({ label, text: `${role} @ ${company}`, reason: 'client_as_experience' });
    }
  }
  return hits;
}

const audits = [];

for (const fixture of FIXTURES) {
  const raw = fs.readFileSync(path.join(ROOT, fixture.file), 'utf8');
  const imported = await runHirelyImportFromText(raw, {
    source: fixture.id,
    extractionMethod: 'paste',
  });
  const sanitized = sanitizeResumeForDisplay(imported.resumeData || {});
  const built = buildFinalResumeData(sanitized, { silent: true });
  const fr = built.finalResumeData || sanitized;

  const hits = scanExperiences(fr.experiences, fixture.id);
  const violations = auditResumeDataForInventedContent(fr);
  const clientBrands = ['Nike', 'Converse', 'Louis Vuitton', 'Adobe', 'Marvel', 'PlayStation'];
  const clientOnlyExp = (fr.experiences || []).filter((e) => {
    const c = String(e?.company || '').trim();
    return clientBrands.some((b) => c.toLowerCase() === b.toLowerCase()) && !String(e?.role || '').trim();
  });

  ok(hits.length === 0, `${fixture.id} no invented experience (${hits.map((h) => h.text).join('; ') || 'clean'})`);
  ok(violations.length === 0, `${fixture.id} invented content audit (${violations.join('; ') || 'clean'})`);
  ok(clientOnlyExp.length === 0, `${fixture.id} no client-only experience rows`);

  const recovery = runCreativeExperienceRecovery(
    { experiences: fr.experiences || [], clients: fr.clients || [], unsorted: [] },
    raw,
    { forceCreative: true }
  );
  const recoveryHits = scanExperiences(recovery.experiences, `${fixture.id}-recovery`);
  ok(recoveryHits.length === 0, `${fixture.id} creative recovery no invented rows`);

  audits.push({
    id: fixture.id,
    experienceCount: (fr.experiences || []).length,
    clientCount: (fr.clients || []).length,
    hits,
    violations,
    clientOnlyExp: clientOnlyExp.length,
    clients: fr.clients || [],
  });
}

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(
  OUT,
  JSON.stringify({ generatedAt: new Date().toISOString(), audits, pass: failed === 0 }, null, 2)
);

console.log(failed ? '\nFAIL no-invented-experience' : '\nPASS no-invented-experience');
process.exit(failed ? 1 : 0);
