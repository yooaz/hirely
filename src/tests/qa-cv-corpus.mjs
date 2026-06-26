#!/usr/bin/env node
/**
 * P1 — REAL CV CORPUS QA (10 archetypes).
 * PASS if identity ≥95%, experience ≥90%, education ≥90%, skills ≥85%.
 */
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { loadCvCorpusFixtures } from '../../tests/lib/cv-corpus-catalog.mjs';
import {
  computeCvCorpusMetrics,
  aggregateCvCorpus,
  CV_CORPUS_GOALS,
} from '../../tests/lib/cv-corpus-metrics.mjs';

let failed = 0;

function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

async function main() {
  const fixtures = loadCvCorpusFixtures();
  const rows = [];

  for (let i = 0; i < fixtures.length; i++) {
    const fixture = fixtures[i];
    process.stderr.write(`[cv-corpus] ${i + 1}/${fixtures.length} ${fixture.id}…\n`);
    const importResult = await runHirelyImportFromText(fixture.text, {
      source: fixture.id,
      extractionMethod: 'paste',
    });
    rows.push(computeCvCorpusMetrics(fixture, importResult));
  }

  const agg = aggregateCvCorpus(rows);

  ok(fixtures.length === 10, `Corpus size ${fixtures.length}/10`);
  ok(
    agg.identityRecall >= CV_CORPUS_GOALS.identity,
    `Identity recall ${agg.identityRecall}% >= ${CV_CORPUS_GOALS.identity}%`
  );
  ok(
    agg.experienceRecall >= CV_CORPUS_GOALS.experience,
    `Experience recall ${agg.experienceRecall}% >= ${CV_CORPUS_GOALS.experience}%`
  );
  ok(
    agg.educationRecall >= CV_CORPUS_GOALS.education,
    `Education recall ${agg.educationRecall}% >= ${CV_CORPUS_GOALS.education}%`
  );
  ok(
    agg.skillsRecall >= CV_CORPUS_GOALS.skills,
    `Skills recall ${agg.skillsRecall}% >= ${CV_CORPUS_GOALS.skills}%`
  );

  console.log('\n── Per-CV scores ──');
  for (const row of rows) {
    console.log(
      `${row.id.padEnd(12)} identity=${row.identityRecall}% exp=${row.experienceRecall}% ` +
        `edu=${row.educationRecall}% skills=${row.skillsRecall}% langs=${row.languagesRecall}%`
    );
    if (row.failures?.length) {
      for (const f of row.failures.slice(0, 4)) {
        console.log(`  · ${f.dimension}: ${f.issue}`);
      }
    }
  }

  console.log(
    `\n═══ CV Corpus QA: ${agg.pass ? 'PASS' : 'FAIL'} ` +
      `(identity ${agg.identityRecall}%, experience ${agg.experienceRecall}%, ` +
      `education ${agg.educationRecall}%, skills ${agg.skillsRecall}%, ` +
      `languages ${agg.languagesRecall}%) ═══`
  );

  if (!agg.pass && agg.failureCauses.length) {
    console.error('\nTop failure causes:');
    for (const { cause, count } of agg.failureCauses.slice(0, 8)) {
      console.error(`  ${cause} (${count})`);
    }
  }

  process.exit(failed ? 1 : 0);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
