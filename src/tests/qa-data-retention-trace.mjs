#!/usr/bin/env node
/**
 * P0 — Data retention trace QA.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  traceDataRetention,
  writeRetentionTraceArtifacts,
  RETENTION_TRACE_STAGES,
  RETENTION_TRACE_SECTIONS,
} from '../core/audit/data-retention-trace.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT = path.join(ROOT, 'tests/output/data-retention-trace/report.json');

const FIXTURES = [
  { id: 'creative-cv', file: 'tests/fixtures/creative-cv/fixture.txt' },
  { id: 'yoaz-cv', file: 'tests/fixtures/yoaz-cv/fixture.txt' },
  { id: 'creative-experience-rich', file: 'tests/fixtures/creative-experience-rich.txt' },
  { id: 'designer-cv-rich', file: 'tests/fixtures/designer-cv-rich.txt' },
];

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const traces = [];

for (const fx of FIXTURES) {
  const text = fs.readFileSync(path.join(ROOT, fx.file), 'utf8');
  const trace = await traceDataRetention(text, { id: fx.id, templateId: 'ats' });
  traces.push(trace);

  ok(trace.rawTextLength > 0, `${fx.id} has raw text`);
  for (const stage of RETENTION_TRACE_STAGES) {
    ok(trace.stageTraces[stage], `${fx.id} stage ${stage}`);
    for (const section of RETENTION_TRACE_SECTIONS) {
      const row = trace.stageTraces[stage][section];
      ok(typeof row.count === 'number', `${fx.id} ${stage}.${section} count`);
      ok(Array.isArray(row.examples), `${fx.id} ${stage}.${section} examples`);
      ok(Array.isArray(row.lostExamples), `${fx.id} ${stage}.${section} lostExamples`);
    }
  }

  ok(trace.transitions.length >= 0, `${fx.id} transitions computed`);
  ok(trace.hotspots != null, `${fx.id} hotspots identified`);

  const clients = trace.summary.clients;
  console.log(
    `\n[${fx.id}] clients: raw=${clients.raw} structured=${clients.structured} resume=${clients.resumeData} final=${clients.final} rendered=${clients.rendered}`
  );
  console.log(
    `[${fx.id}] projects: raw=${trace.summary.projects.raw} structured=${trace.summary.projects.structured} final=${trace.summary.projects.final} rendered=${trace.summary.projects.rendered}`
  );

  if (clients.raw > clients.final) {
    const top = trace.hotspots.find((h) => h.section === 'clients');
    ok(!!top, `${fx.id} identifies client loss stage (${top?.stage || 'n/a'}, dropped ${top?.dropped ?? '?'})`);
  }
}

const { jsonPath, mdPath } = writeRetentionTraceArtifacts(traces);

ok(fs.existsSync(jsonPath), 'DATA_RETENTION_TRACE.json written');
ok(fs.existsSync(mdPath), 'DATA_RETENTION_TRACE_REPORT.md written');

const report = {
  feature: 'DATA_RETENTION_TRACE',
  generatedAt: new Date().toISOString(),
  stages: RETENTION_TRACE_STAGES,
  sections: RETENTION_TRACE_SECTIONS,
  artifacts: { jsonPath, mdPath },
  imports: traces.map((t) => ({
    id: t.id,
    summary: t.summary,
    hotspots: t.hotspots.slice(0, 8),
    transitions: t.transitions.length,
  })),
  pass: failed === 0,
};

fs.mkdirSync(path.dirname(OUT), { recursive: true });
fs.writeFileSync(OUT, JSON.stringify(report, null, 2));

console.log(failed ? '\nFAIL data-retention-trace' : '\nPASS data-retention-trace');
process.exit(failed ? 1 : 0);
