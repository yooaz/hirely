#!/usr/bin/env node
/**
 * Live product import path — canonicalImportFromFile / canonicalImportFromExtracted
 * (same pipeline as index.html handleFileImport after extraction).
 *
 * node src/tests/qa-canonical-product-import-yoaz.mjs
 */
import { writeFileSync, mkdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  canonicalImportFromFile,
  canonicalImportFromExtracted,
} from '../core/import/canonical-import.js';
import { buildResumeData, prepareResumeDataForUiCommit } from '../core/resume-data.js';
import { resolveBridgeLockedFromImport } from '../core/parsing/cv-block-parser-bridge.js';
import {
  parseBenchmarkFixture,
  snapshotBenchmarkResume,
  validateBenchmarkResult,
} from '../../tests/lib/yoaz-pdf-benchmark-gate.mjs';
import { buildYoazManifestEnterprise } from '../../tests/lib/yoaz-manifest-enterprise.mjs';
import {
  bootstrapPdfJs,
  fileFromPdfPath,
  resolveYoazPdfPath,
} from '../../tests/lib/yoaz-live-pdf.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');
const outDir = join(root, 'tests/output/canonical-product-import-yoaz');
mkdirSync(outDir, { recursive: true });

const failures = [];

function fail(msg) {
  failures.push(msg);
  console.error(`✗ ${msg}`);
}

function ok(msg) {
  console.log(`✓ ${msg}`);
}

const PORTFOLIO_MARKERS = [
  'sunglass',
  'cubist art',
  'god of war',
  'fortune 500',
  'metro display',
  'personal project',
  'adidas creation',
];

function assertPageClassification(pageClass, label) {
  if (!pageClass) {
    fail(`${label}: page_document_classification missing`);
    return;
  }
  const portfolio = pageClass.portfolio_pages || [];
  const core = pageClass.resume_core_pages || [];
  if (!portfolio.includes(2)) fail(`${label}: page 2 must be portfolio_page`);
  else ok(`${label}: page 2 portfolio`);
  if (!core.includes(1)) fail(`${label}: page 1 must be resume_core`);
  else ok(`${label}: page 1 resume_core`);
}

function assertImportPathWinner(debug, label) {
  if (debug.import_path_winner !== 'spatial_bridge') {
    fail(`${label}: import_path_winner expected spatial_bridge, got ${debug.import_path_winner}`);
  } else ok(`${label}: import_path_winner=spatial_bridge`);
  if (!debug.bridge_activated) fail(`${label}: bridge_activated must be true`);
  else ok(`${label}: bridge_activated`);
  if (!debug.flat_fallback_skipped) fail(`${label}: flat_fallback_skipped must be true`);
  else ok(`${label}: flat_fallback_skipped`);
}

function assertYoazResume(rd, label) {
  const id = rd?.identity || {};
  if (!/yohann\s+azancot/i.test(id.name || '')) {
    fail(`${label}: identity.name expected Yohann Azancot, got "${id.name || ''}"`);
  } else ok(`${label}: identity.name`);
  if (/à vérifier|nom à vérifier|confirmer/i.test(id.name || '')) {
    fail(`${label}: identity fell back to review placeholder`);
  }
  if (!/graphic designer|illustrator/i.test(id.title || '')) {
    fail(`${label}: identity.title expected Graphic Designer & Illustrator, got "${id.title || ''}"`);
  } else ok(`${label}: identity.title`);
  if (!id.email || !/yoaz@hotmail\.fr/i.test(id.email)) {
    fail(`${label}: email missing or wrong (${id.email || ''})`);
  } else ok(`${label}: email`);
  const phoneDigits = String(id.phone || '').replace(/\D/g, '');
  if (!phoneDigits.includes('336494344839')) {
    fail(`${label}: phone wrong (${id.phone || ''})`);
  } else ok(`${label}: phone`);
  const summary = String(rd.summary || '');
  if (!summary || summary.length < 12) {
    fail(`${label}: summary empty`);
  } else ok(`${label}: summary present`);
  for (const m of PORTFOLIO_MARKERS) {
    if (summary.toLowerCase().includes(m)) {
      fail(`${label}: portfolio marker "${m}" leaked into summary`);
    }
  }
  const exp = rd.experiences?.length || 0;
  if (exp < 3) fail(`${label}: expected 3 experiences, got ${exp}`);
  else ok(`${label}: experiences=${exp}`);
  const edu = rd.education?.length || 0;
  if (edu !== 4) fail(`${label}: expected 4 education lines, got ${edu}`);
  else ok(`${label}: education=${edu}`);
  const tools = [...(rd.skills || []), ...(rd.tools || [])];
  if (tools.length < 6) fail(`${label}: expected >= 6 skills/tools, got ${tools.length}`);
  else ok(`${label}: skills/tools=${tools.length}`);
  if (tools.some((s) => /nike|converse|pantone|adobe|arte/i.test(s))) {
    fail(`${label}: client brands leaked into skills/tools`);
  }
}

function writeDebugEvidence(name, payload) {
  writeFileSync(join(outDir, name), JSON.stringify(payload, null, 2));
}

console.log('\n=== CANONICAL PRODUCT IMPORT YOAZ ===\n');

// 1) Regression: second buildResumeData pass must not corrupt bridge output
const bench = await parseBenchmarkFixture(root);
const bridgeCtx = resolveBridgeLockedFromImport(bench.importResult);
if (!bridgeCtx.applied) {
  fail('benchmark import must have bridge applied');
} else ok('benchmark bridge applied');

const guarded = buildResumeData({
  importResult: bench.importResult,
  rawText: bench.rawText,
  cleanedText: bench.cleanedText,
  extractionMethod: 'pdf_native',
  blockParserBridgeApplied: true,
});
assertYoazResume(guarded, 'guarded buildResumeData');

// 2) Product path via canonicalImportFromExtracted + manifest spatial enterprise
//    (same parse/build path as UI after a successful positioned PDF extract)
const yoaz = buildYoazManifestEnterprise(root);
const manifestFile = new File([new Uint8Array(0)], 'yoaz.pdf', { type: 'application/pdf' });
const manifestExtracted = {
  ...yoaz.extracted,
  enterprise: yoaz.enterprise,
};
const manifestResult = await canonicalImportFromExtracted(manifestFile, manifestExtracted, {
  extractionMethod: 'pdf_native',
  source: 'pdf-upload',
});
const manifestDebug = manifestResult.importDebug || {};
writeDebugEvidence('manifest-import-debug.json', {
  import_path_winner: manifestDebug.import_path_winner,
  bridge_activated: manifestDebug.bridge_activated,
  flat_fallback_skipped: manifestDebug.flat_fallback_skipped,
  spatial_parse_input: manifestDebug.spatial_parse_input,
  bridge_locked: manifestDebug.bridge_locked,
  flat_repair_skipped: manifestDebug.flat_repair_skipped,
  page_document_classification: manifestDebug.page_document_classification,
  extraction_line_count: manifestDebug.extraction_line_count,
  spatial_block_count: manifestDebug.spatial_block_count,
});
writeDebugEvidence('manifest-resume-snapshot.json', snapshotBenchmarkResume(manifestResult.resumeData));

assertImportPathWinner(manifestDebug, 'manifest canonical');
assertPageClassification(manifestDebug.page_document_classification, 'manifest canonical');

if (!manifestDebug.bridge_locked) fail('manifest canonical: bridge_locked must be true');
else ok('manifest canonical: bridge_locked');
if (!manifestDebug.flat_repair_skipped) fail('manifest canonical: flat_repair_skipped must be true');
else ok('manifest canonical: flat repair skipped');
if (!manifestDebug.spatial_parse_input) fail('manifest canonical: spatial_parse_input must be true');
else ok('manifest canonical: spatial_parse_input');

assertYoazResume(manifestResult.resumeData, 'canonicalImportFromExtracted manifest');

// 2b) UI commit path must not corrupt bridge output (index.html commitResumeData)
const uiCommitted = prepareResumeDataForUiCommit(manifestResult.resumeData, {
  rawText: manifestResult.rawText,
  cleanedText: manifestResult.cleanedText,
});
writeDebugEvidence('ui-commit-resume-snapshot.json', snapshotBenchmarkResume(uiCommitted));
assertYoazResume(uiCommitted, 'prepareResumeDataForUiCommit');
if (/à vérifier|nom à vérifier/i.test(uiCommitted.identity?.name || '')) {
  fail('UI commit corrupted identity to review placeholder');
} else ok('UI commit preserved bridge identity');

// 3) Live PDF via canonicalImportFromFile when a good PDF is on disk
await bootstrapPdfJs();
const pdfPath = resolveYoazPdfPath(root);
if (pdfPath) {
  console.log(`\nLive PDF: ${pdfPath}\n`);
  const file = fileFromPdfPath(pdfPath);
  const liveResult = await canonicalImportFromFile(file, {
    extractionMethod: 'pdf_native',
    source: 'pdf-upload',
  });
  const rd = liveResult.resumeData;
  const debug = liveResult.importDebug || {};

  writeDebugEvidence('live-import-debug.json', {
    pdfPath,
    importDebug: debug,
    bridge_locked: debug.bridge_locked,
    spatial_parse_input: debug.spatial_parse_input,
    flat_repair_skipped: debug.flat_repair_skipped,
    page_document_classification: debug.page_document_classification,
    extraction_line_count: debug.extraction_line_count,
    spatial_block_count: debug.spatial_block_count,
  });
  writeDebugEvidence('live-resume-snapshot.json', snapshotBenchmarkResume(rd));

  if (debug.bridge_locked && debug.spatial_parse_input) {
    ok('live PDF: bridge + spatial active');
    const validation = validateBenchmarkResult(snapshotBenchmarkResume(rd), yoaz.manifest, {
      rawText: liveResult.rawText,
    });
    if (validation.failures.length) {
      for (const f of validation.failures) fail(`live PDF: ${f}`);
    } else {
      ok('live PDF: benchmark validation');
      assertYoazResume(rd, 'canonicalImportFromFile live PDF');
    }
  } else {
    console.warn(
      'Live PDF skipped strict assertions (extraction missing spatial or bridge) — see live-import-debug.json'
    );
  }
} else {
  console.warn('No Yoaz PDF on disk — live PDF section skipped');
}

writeDebugEvidence('guarded-resume-snapshot.json', snapshotBenchmarkResume(guarded));

console.log('\n--- summary ---');
if (failures.length) {
  console.error(`\nCANONICAL_PRODUCT_IMPORT_YOAZ_FAIL (${failures.length})\n`);
  process.exit(1);
}
console.log('\nCANONICAL_PRODUCT_IMPORT_YOAZ OK\n');
process.exit(0);
