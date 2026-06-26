#!/usr/bin/env node
/**
 * P0 — Universal import pipeline QA (7 format acceptance paths).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { canonicalImportFromFile } from '../core/import/canonical-import.js';
import { IMPORT_STATE } from '../core/import/import-status.js';
import { UNIVERSAL_IMPORT_PIPELINE_VERSION } from '../core/import/universal-import-pipeline.js';
import { OCR_FALLBACK_V1_PASTE_MAX_CHARS } from '../core/import/ocr-fallback-v1.js';
import {
  ensureRealFormatQaFixtures,
  buildRealFormatCases,
  caseFile,
} from '../../tests/lib/real-format-qa-fixtures.mjs';
import {
  evaluateUniversalImportCase,
  extractPipelineLog,
  UNIVERSAL_IMPORT_EVAL_VERSION,
  rowIsExactTranscriptionResult,
  rowExactTranscriptionTextLength,
  rowHasOcrUsableOutput,
} from '../../tests/lib/universal-import-pipeline-eval.mjs';
import { classifyImportOutcome } from '../../tests/lib/import-outcome-classifier.mjs';
import { bootstrapNodeExtractors } from '../../tests/lib/node-extractor-bootstrap.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/universal-import-pipeline');
const OUT_JSON = path.join(OUT_DIR, 'report.json');
const IMPORT_TIMEOUT_MS = 90000;

const ACCEPTANCE_MATRIX = [
  {
    id: 'pdf_text',
    caseId: 'pdf_sel_yoaz',
    format: 'PDF text',
    expectStatus: IMPORT_STATE.IMPORT_READY,
  },
  {
    id: 'docx',
    caseId: 'docx_yoaz',
    format: 'DOCX',
    expectStatus: IMPORT_STATE.IMPORT_READY,
  },
  {
    id: 'txt',
    caseId: 'txt_yoaz',
    format: 'TXT',
    expectStatus: IMPORT_STATE.IMPORT_READY,
  },
  {
    id: 'pdf_scanned',
    caseId: 'pdf_scan_blank',
    format: 'PDF scanned',
    expectStatus: IMPORT_STATE.IMPORT_NEEDS_PASTE,
  },
  {
    id: 'pdf_protected',
    caseId: 'pdf_scan_protected',
    format: 'PDF protected',
    expectStatus: IMPORT_STATE.IMPORT_NEEDS_PASTE,
  },
  {
    id: 'png',
    caseId: 'img_png',
    format: 'PNG',
    expectStatus: IMPORT_STATE.IMPORT_NEEDS_PASTE,
  },
  {
    id: 'jpg',
    caseId: 'img_jpg',
    format: 'JPG',
    expectStatus: IMPORT_STATE.IMPORT_NEEDS_PASTE,
  },
];

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

function importRace(promise, ms, label) {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error(label || 'IMPORT_TIMEOUT_STUCK')), ms)
    ),
  ]);
}

/**
 * @param {object} acceptance
 * @param {object} caseDef
 */
async function runAcceptanceCase(acceptance, caseDef) {
  const row = {
    id: acceptance.id,
    format: acceptance.format,
    fileName: caseDef?.name || '',
    expectStatus: acceptance.expectStatus,
    importState: '',
    importStatus: '',
    selectedTextLength: 0,
    nativeTextLength: 0,
    ocrTextLength: 0,
    fileType: '',
    pageCount: 0,
    isScanned: false,
    isProtected: false,
    hasResumeData: false,
    importFallback: null,
    universalImportLog: null,
    errors: [],
    warnings: [],
    crashed: false,
    threw: null,
    stuck: false,
    timedOut: false,
    durationMs: 0,
    qaOutcome: '',
    pass: false,
    passReasons: [],
  };

  const file = caseFile(caseDef);
  if (!file) {
    row.errors.push('fixture_missing');
    row.qaOutcome = 'IMPORT_UNSUPPORTED';
    row.passReasons.push('fixture_missing');
    return row;
  }

  const t0 = Date.now();
  try {
    const canon = await importRace(
      canonicalImportFromFile(file),
      IMPORT_TIMEOUT_MS,
      'IMPORT_TIMEOUT_STUCK'
    );
    const log = extractPipelineLog(canon) || canon.universalImportLog || null;

    row.canonical = canon;
    row.importState = canon.importState || '';
    row.importStatus = canon.importStatus || '';
    row.selectedTextLength = log?.selectedTextLength ?? (canon.rawText || '').length;
    row.nativeTextLength = log?.nativeTextLength ?? 0;
    row.ocrTextLength = log?.ocrTextLength ?? 0;
    row.fileType = log?.fileType || canon.fileType || '';
    row.pageCount = log?.pageCount ?? 0;
    row.isScanned = !!log?.isScanned;
    row.isProtected = !!log?.isProtected;
    row.hasResumeData = canon.resumeData != null;
    row.resumeData = canon.resumeData || null;
    row.importFallback = canon.importFallback || null;
    row.universalImportLog = log;
    row.errors = [...(canon.errors || [])].slice(0, 8);
    row.warnings = [...(canon.warnings || [])].slice(0, 8);
  } catch (err) {
    const msg = String(err?.message || err);
    if (/IMPORT_TIMEOUT_STUCK|timeout/i.test(msg)) {
      row.stuck = true;
      row.timedOut = true;
      row.errors.push(msg);
    } else {
      row.crashed = true;
      row.threw = msg;
      row.errors.push(msg);
    }
  }

  row.durationMs = Date.now() - t0;
  row.qaOutcome = classifyImportOutcome(row);
  const evalResult = evaluateUniversalImportCase(row, acceptance.expectStatus);
  row.pass = evalResult.pass;
  row.passReasons = evalResult.reasons;
  return row;
}

await bootstrapNodeExtractors();
const { files } = await ensureRealFormatQaFixtures(ROOT);
const cases = buildRealFormatCases(files);
const caseById = Object.fromEntries(cases.map((c) => [c.id, c]));

const results = [];
for (const acceptance of ACCEPTANCE_MATRIX) {
  const caseDef = caseById[acceptance.caseId];
  const row = await runAcceptanceCase(acceptance, caseDef);
  results.push(row);
  ok(row.pass, `${acceptance.id} → ${row.qaOutcome} (${row.passReasons.join(', ') || 'ok'})`);
}

const stuck = results.filter((r) => r.qaOutcome === 'IMPORT_STUCK').length;
const crashes = results.filter((r) => r.qaOutcome === 'IMPORT_CRASH').length;
const fakeReady = results.filter((r) => {
  if (r.qaOutcome !== IMPORT_STATE.IMPORT_READY) return false;
  if (rowIsExactTranscriptionResult(r) && rowExactTranscriptionTextLength(r) > OCR_FALLBACK_V1_PASTE_MAX_CHARS) {
    return false;
  }
  if (rowHasOcrUsableOutput(r)) return false;
  return r.selectedTextLength < REAL_CV_IMPORT_MIN_CHARS;
}).length;

ok(stuck === 0, `no IMPORT_STUCK (${stuck})`);
ok(crashes === 0, `no IMPORT_CRASH (${crashes})`);
ok(fakeReady === 0, `no fake READY below 300 (${fakeReady})`);

const report = {
  version: UNIVERSAL_IMPORT_PIPELINE_VERSION,
  evalVersion: UNIVERSAL_IMPORT_EVAL_VERSION,
  generatedAt: new Date().toISOString(),
  pass: failed === 0,
  acceptance: {
    pdf_text: results.find((r) => r.id === 'pdf_text')?.pass === true,
    docx: results.find((r) => r.id === 'docx')?.pass === true,
    txt: results.find((r) => r.id === 'txt')?.pass === true,
    scanned_protected_image_paste:
      ['pdf_scanned', 'pdf_protected', 'png', 'jpg'].every(
        (id) => results.find((r) => r.id === id)?.pass === true
      ),
    no_import_stuck: stuck === 0,
  },
  forbidden: { IMPORT_STUCK: stuck, IMPORT_CRASH: crashes, fakeReady },
  cases: results.map((r) => ({
    id: r.id,
    format: r.format,
    fileName: r.fileName,
    expectStatus: r.expectStatus,
    status: r.qaOutcome,
    nativeTextLength: r.nativeTextLength,
    ocrTextLength: r.ocrTextLength,
    selectedTextLength: r.selectedTextLength,
    fileType: r.fileType,
    pageCount: r.pageCount,
    isScanned: r.isScanned,
    isProtected: r.isProtected,
    hasResumeData: r.hasResumeData,
    durationMs: r.durationMs,
    pass: r.pass,
    passReasons: r.passReasons,
    errors: r.errors,
    warnings: r.warnings,
  })),
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
console.log('Wrote', OUT_JSON);

if (failed) {
  console.error(`\nqa-universal-import-pipeline: FAILED (${failed})`);
  process.exit(1);
}
console.log('\nqa-universal-import-pipeline: PASSED');
