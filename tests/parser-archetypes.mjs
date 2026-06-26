#!/usr/bin/env node
/**
 * General parser archetype tests — multiple CV profiles, no person-specific logic.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadHirelyParse } from '../src/tests/load-hirely-parse.mjs';
import {
  evaluateExtraction,
  evaluateYoazFixture,
  emailInSummary,
  contactInEducation,
  toolsInEducation,
  hasOcrGarbageInStructured,
} from './lib/quality-gate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

const ARCHETYPES = [
  { id: 'developer-cv', expect: { role: /engineer|developer/i, tool: /typescript|python/i } },
  { id: 'consultant-cv', expect: { role: /consultant/i, edu: /hec|sciences po/i } },
  { id: 'student-cv', expect: { role: /student|intern/i, edu: /university|college/i } },
  { id: 'executive-cv', expect: { role: /officer|operations/i, edu: /harvard|business school/i } },
  { id: 'creative-cv', expect: { role: /designer|illustrator/i } },
  { id: 'yoaz-cv', expect: { fixtureOnly: true } },
  { id: 'two-column-cv', expect: {} },
  { id: 'scanned-pdf', expect: {} },
];

function loadFixture(id) {
  const p = path.join(__dirname, 'fixtures', id, 'fixture.txt');
  return fs.readFileSync(p, 'utf8');
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

function checkGeneral(cv, structured) {
  const failures = [];
  if (hasOcrGarbageInStructured(cv)) failures.push('OCR garbage in CV');
  if (emailInSummary(cv)) failures.push('email in summary');
  if (contactInEducation(cv)) failures.push('contact in education');
  if (toolsInEducation(cv)) failures.push('tools in education');
  const skills = cv.skills || [];
  const interests = cv.interests || structured?.interests || [];
  const interestWords = ['movies', 'music', 'nature', 'reading', 'soccer', 'photography'];
  interestWords.forEach((w) => {
    if (skills.some((s) => s.toLowerCase() === w) && interests.every((i) => !i.toLowerCase().includes(w))) {
      failures.push(`interest "${w}" still in skills`);
    }
  });
  return failures;
}

async function main() {
  const Parse = await loadHirelyParse();
  let failed = 0;
  const reports = [];

  console.log('PARSER ARCHETYPE TESTS\n');

  for (const arch of ARCHETYPES) {
    const rawText = loadFixture(arch.id);
    const pipe = await Parse.runExtractionPipeline(rawText, { extractionMethod: 'paste' });
    const cv = pipe.validatedCVData || {};
    const structured = pipe.structuredResume || {};
    const gate = evaluateExtraction({ cv, audit: pipe.audit });

    const generalFails = checkGeneral(cv, structured);
    let fails = [...gate.failures, ...generalFails];

    if (arch.id === 'yoaz-cv') {
      fails.push(...evaluateYoazFixture(cv));
    }

    if (arch.expect.role && !arch.expect.role.test(String(cv.title || '') + cv.experience?.join(' '))) {
      fails.push(`expected role pattern ${arch.expect.role}`);
    }
    if (arch.expect.tool && !arch.expect.tool.test((cv.tools || []).join(' '))) {
      fails.push(`expected tools pattern ${arch.expect.tool}`);
    }
    const eduBlob = [(cv.education || []).join(' '), pipe.cleanedText || ''].join(' ');
    if (arch.expect.edu && !arch.expect.edu.test(eduBlob)) {
      fails.push(`expected education pattern ${arch.expect.edu}`);
    }

    const status = fails.length ? 'FAIL' : gate.status === 'NEEDS_REVIEW' ? 'REVIEW' : 'PASS';
    if (fails.length) failed++;

    reports.push({ id: arch.id, status, fails, pipe, cv, structured });

    console.log(`── ${arch.id} [${status}]`);
    console.log(`  name: ${cv.name || '—'}`);
    console.log(`  title: ${cv.title || '—'}`);
    console.log(`  experience: ${(cv.experience || []).length}`);
    console.log(`  education: ${(cv.education || []).length}`);
    console.log(`  needsReview: ${(structured.needsReview || []).length}`);
    if (fails.length) console.log(`  failures: ${fails.join('; ')}`);
    console.log('');
  }

  const sample = reports.find((r) => r.id === 'developer-cv');
  const sample2 = reports.find((r) => r.id === 'consultant-cv');
  const sample3 = reports.find((r) => r.id === 'yoaz-cv');

  console.log('SAMPLE structuredResume (developer-cv):');
  console.log(JSON.stringify(sample.structured, null, 2).slice(0, 1200));
  console.log('\nSAMPLE structuredResume (consultant-cv) identity:');
  console.log(JSON.stringify(sample2.structured?.identity, null, 2));
  console.log('\nSAMPLE yoaz-cv clients/tools/interests:');
  console.log(
    JSON.stringify(
      {
        clients: sample3.structured?.clients,
        tools: sample3.structured?.tools,
        languages: sample3.structured?.languages,
        interests: sample3.structured?.interests,
      },
      null,
      2
    )
  );

  if (failed) {
    console.error(`\n${failed} archetype(s) failed`);
    process.exit(1);
  }
  console.log(`\nOK all ${ARCHETYPES.length} archetypes passed general parser rules`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
