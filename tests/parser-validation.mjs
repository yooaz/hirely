#!/usr/bin/env node
/**
 * Parser validation mode — clean pasted text only (OCR frozen).
 *
 * Flow:
 *   Paste CV text → Parse → CV preview text → Template ready → Export ready
 *
 * Run: npm run validate:parser
 * Browser export (optional): npm run validate:parser:browser
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { loadHirelyParse } from '../src/tests/load-hirely-parse.mjs';
import { formatCvAsStructuredText } from '../src/core/export/format-cv.js';
import {
  PARSER_VALIDATION_PROFILES,
  PASTE_FLOW_STAGES,
  evaluateCleanTextParser,
} from './lib/parser-validation-gate.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '..');

function loadCleanText(fixtureId) {
  const p = path.join(__dirname, 'fixtures', fixtureId, 'fixture.txt');
  return fs.readFileSync(p, 'utf8');
}

function templateRegistryAvailable() {
  const tplPath = path.join(root, 'src/ui/templates/cv-templates.js');
  if (!fs.existsSync(tplPath)) return { ok: false, reason: 'cv-templates.js missing' };
  const src = fs.readFileSync(tplPath, 'utf8');
  const hasAts = /ats[-_]clean|FREE_TEMPLATE/i.test(src);
  const hasExecutive = /executive/i.test(src);
  if (!hasAts || !hasExecutive) {
    return { ok: false, reason: 'expected template ids not found in registry' };
  }
  return { ok: true, reason: 'template registry readable' };
}

async function main() {
  console.log('HIRELY PARSER VALIDATION (clean paste — OCR frozen)\n');
  console.log(`Stages: ${PASTE_FLOW_STAGES.join(' → ')}\n`);

  const tpl = templateRegistryAvailable();
  if (!tpl.ok) {
    console.error(`Template check: ${tpl.reason}`);
    process.exit(1);
  }
  console.log(`Template check: ${tpl.reason}\n`);

  const Parse = await loadHirelyParse();
  let failed = 0;
  const reports = [];

  for (const profile of PARSER_VALIDATION_PROFILES) {
    const rawText = loadCleanText(profile.fixture);

    // paste + parse
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

    reports.push({ profile, gate, previewText });

    console.log(`── ${profile.label} [${gate.status}]`);
    console.log(`  paste → parse: extractionMethod=paste`);
    console.log(
      `  identity: ${gate.summary.name} · ${gate.summary.title}`
    );
    console.log(
      `  contact: ${gate.summary.email || '—'} · ${gate.summary.phone || '—'}`
    );
    console.log(
      `  sections: exp ${gate.summary.experience} · edu ${gate.summary.education} · skills ${gate.summary.skills} · tools ${gate.summary.tools} · langs ${gate.summary.languages}`
    );
    console.log(
      `  preview: ${gate.summary.previewChars} chars · canGenerate=${gate.summary.canGenerate}`
    );
    if (gate.failures.length) {
      console.log(`  ✗ ${gate.failures.join('; ')}`);
      failed++;
    }
    console.log('');
  }

  if (failed) {
    console.error(`PARSER VALIDATION FAILED (${failed}/${PARSER_VALIDATION_PROFILES.length})`);
    console.error('Fix parser only — do not resume OCR until this passes.');
    process.exit(1);
  }

  console.log(`OK all ${PARSER_VALIDATION_PROFILES.length} profiles passed clean-text validation`);
  console.log('');
  console.log('Sample preview (Developer CV, first 400 chars):');
  const dev = reports.find((r) => r.profile.id === 'developer-cv');
  console.log(dev.previewText.slice(0, 400));
  console.log('…');
  console.log('');
  console.log('Optional: npm run validate:parser:browser  (preview DOM + PDF export, needs dev server)');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
