#!/usr/bin/env node
/**
 * Log Hirely clean-text parser validation to Braintrust as a tracked experiment.
 *
 * Mirrors npm run validate:parser but records per-profile scores + failure lists
 * so you (and Cursor via Braintrust MCP) can compare runs over time.
 *
 * Requires BRAINTRUST_API_KEY (or .env.braintrust in repo root).
 * Run: npm run eval:parser:braintrust
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { Eval } from 'braintrust';
import { loadHirelyParse } from '../src/tests/load-hirely-parse.mjs';
import { formatCvAsStructuredText } from '../src/core/export/format-cv.js';
import {
  PARSER_VALIDATION_PROFILES,
  evaluateCleanTextParser,
} from './lib/parser-validation-gate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PROJECT = 'hirely-parser-clean-text';

function loadCleanText(fixtureId) {
  const p = path.join(__dirname, 'fixtures', fixtureId, 'fixture.txt');
  return fs.readFileSync(p, 'utf8');
}

function parserPassScore({ output }) {
  return output.gate.status === 'PASS' ? 1 : 0;
}

function failurePenaltyScore({ output }) {
  const n = output.gate.failures?.length ?? 0;
  return Math.max(0, 1 - n * 0.15);
}

async function main() {
  if (!process.env.BRAINTRUST_API_KEY && !fs.existsSync(path.join(__dirname, '..', '.env.braintrust'))) {
    console.error(
      'BRAINTRUST_API_KEY is not set and no .env.braintrust found.\n' +
        'Get a key at https://www.braintrust.dev/app/settings → API keys, then:\n' +
        '  export BRAINTRUST_API_KEY="sk-..."\n' +
        'Restart Cursor (MCP reads the same variable). Re-run: npm run eval:parser:braintrust'
    );
    process.exit(1);
  }

  const Parse = await loadHirelyParse();

  const summary = await Eval(PROJECT, {
    experimentName: `parser-clean-text-${new Date().toISOString().slice(0, 10)}`,
    description:
      'Clean paste parser gate (OCR frozen). One row per fixture profile from tests/PARSER_VALIDATION.md.',
    data: () =>
      PARSER_VALIDATION_PROFILES.map((profile) => ({
        input: { profileId: profile.id, fixture: profile.fixture, label: profile.label },
        metadata: { label: profile.label, fixture: profile.fixture },
      })),
    task: async ({ profileId, fixture }) => {
      const profile = PARSER_VALIDATION_PROFILES.find((p) => p.id === profileId);
      const rawText = loadCleanText(fixture);
      const pipe = await Parse.runExtractionPipeline(rawText, {
        extractionMethod: 'paste',
        documentType: 'cv',
      });
      const cv = pipe.validatedCVData || {};
      const structured = pipe.structuredResume || {};
      const previewText = formatCvAsStructuredText(cv);
      const gate = evaluateCleanTextParser({
        cv,
        structured,
        profile,
        pipe,
        previewText,
      });
      return {
        gate,
        identity: `${cv?.name || '?'} · ${cv?.title || structured?.identity?.title || '?'}`,
        sections: gate.summary,
      };
    },
    scores: [parserPassScore, failurePenaltyScore],
  });

  const rows = summary.results ?? [];
  const passed = rows.filter((r) => r.output?.gate?.status === 'PASS').length;
  console.log(`\nBraintrust experiment logged to project "${PROJECT}"`);
  console.log(`Pass rate: ${passed}/${rows.length} profiles`);
  for (const r of rows) {
    const label = r.input?.label ?? r.metadata?.label ?? r.input?.profileId;
    const status = r.output?.gate?.status ?? '?';
    const fails = r.output?.gate?.failures ?? [];
    console.log(`  ${label}: ${status}${fails.length ? ` — ${fails.join('; ')}` : ''}`);
  }
  console.log('\nIn Cursor (after MCP auth): ask the agent to inspect this experiment in Braintrust.');
}

main().catch((err) => {
  console.error(err?.message || err);
  process.exit(1);
});
