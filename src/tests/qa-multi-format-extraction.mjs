#!/usr/bin/env node
/**
 * P0 — Multi-format extraction engine (native → OCR → merge → score → best).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { detectInputFileType } from '../core/extraction/file-type-detect.js';
import {
  enrichMultiFormatExtraction,
  mergeNativeAndOcrLines,
  stripRtfToPlain,
  MULTI_FORMAT_ENGINE_VERSION,
} from '../core/extraction/index.js';
import { extractPlainTextEnterprise } from '../core/extraction/enterprise-engine.js';
import { extractTxtDocument } from '../core/extraction/document-extract.js';
import { runProductionExtractionPipeline } from '../core/pipeline/production-pipeline.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/multi-format-extraction');
const OUT_JSON = path.join(OUT_DIR, 'report.json');
const PDF_CACHE = path.join(ROOT, 'tests/output/pdf-acceptance/report.json');

const YOAZ_FIXTURE = path.join(ROOT, 'tests/fixtures/yoaz-cv/fixture.txt');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

function sectionCounts(pipe) {
  const cv = pipe?.validatedCVData || pipe?.structured || {};
  const sr = pipe?.structuredResume || {};
  const exp = cv.experience || cv.experiences || sr.experiences || [];
  const edu = cv.education || sr.education || [];
  const skills = cv.skills || sr.skills || [];
  const tools = cv.tools || sr.tools || [];
  return {
    experiences: Array.isArray(exp) ? exp.length : 0,
    education: Array.isArray(edu) ? edu.length : 0,
    skills: Array.isArray(skills) ? skills.length : 0,
    tools: Array.isArray(tools) ? tools.length : 0,
  };
}

function assertMultiFormatFields(multi, label) {
  const required = [
    'sourceType',
    'nativeTextLength',
    'ocrTextLength',
    'mergedTextLength',
    'confidenceScore',
  ];
  for (const k of required) {
    ok(multi?.[k] !== undefined && multi?.[k] !== null, `${label} has ${k}`);
  }
  ok(typeof multi?.confidenceScore === 'number', `${label} confidenceScore is number`);
  ok(multi?.engineVersion === MULTI_FORMAT_ENGINE_VERSION, `${label} engine version`);
}

function wrapEnterprise(text, method, fileType, lines) {
  const enterprise = extractPlainTextEnterprise(text, method === 'docx' ? 'docx' : method === 'txt' ? 'txt' : 'paste');
  if (lines) enterprise.lines = lines;
  enterprise.method = method;
  enterprise.metadata = { ...(enterprise.metadata || {}), fileType };
  return {
    text: enterprise.rawExtraction,
    method,
    fileType,
    enterprise,
    lines: enterprise.lines,
    metadata: enterprise.metadata,
  };
}

const yoaz = fs.readFileSync(YOAZ_FIXTURE, 'utf8');
const formats = [];

// --- File type detection ---
ok(detectInputFileType({ name: 'cv.rtf' }).kind === 'rtf', 'detect rtf');
ok(detectInputFileType({ name: 'cv.doc' }).kind === 'doc', 'detect doc');
ok(detectInputFileType({ name: 'cv.docx' }).kind === 'docx', 'detect docx');

// --- RTF native strip ---
const rtfSample = String.raw`{\rtf1\ansi Yohann Azancot\par Graphic Designer\par yoaz@hotmail.fr }`;
const rtfPlain = stripRtfToPlain(rtfSample);
ok(rtfPlain.includes('Yohann'), 'rtf strip name');
ok(rtfPlain.includes('yoaz@hotmail.fr'), 'rtf strip email');

const rtfEnriched = enrichMultiFormatExtraction(
  wrapEnterprise(rtfPlain, 'txt', 'rtf'),
  { inputKind: 'rtf', fileName: 'cv.rtf' }
);
assertMultiFormatFields(rtfEnriched.multiFormat, 'rtf');
ok(rtfEnriched.multiFormat.sourceType === 'rtf', 'rtf sourceType');
formats.push({
  id: 'rtf',
  sourceType: rtfEnriched.multiFormat.sourceType,
  nativeTextLength: rtfEnriched.multiFormat.nativeTextLength,
  ocrTextLength: rtfEnriched.multiFormat.ocrTextLength,
  mergedTextLength: rtfEnriched.multiFormat.mergedTextLength,
  confidenceScore: rtfEnriched.multiFormat.confidenceScore,
  selectedSource: rtfEnriched.multiFormat.selectedSource,
});

// --- TXT ---
const txtFile = new File([yoaz], 'cv.txt', { type: 'text/plain' });
const txtResult = await extractTxtDocument(txtFile);
const txtEnriched = enrichMultiFormatExtraction(txtResult, { inputKind: 'txt', fileName: 'cv.txt' });
assertMultiFormatFields(txtEnriched.multiFormat, 'txt');
ok(txtEnriched.multiFormat.sourceType === 'txt', 'txt sourceType');
ok(txtEnriched.multiFormat.ocrTextLength === 0, 'txt no ocr');
ok(txtEnriched.multiFormat.nativeTextLength > 200, 'txt native length');
formats.push({
  id: 'txt',
  ...txtEnriched.multiFormat,
  selectedSource: txtEnriched.multiFormat.selectedSource,
});

// --- DOCX (native plain path) ---
const docxEnriched = enrichMultiFormatExtraction(
  wrapEnterprise(yoaz, 'docx', 'docx'),
  { inputKind: 'docx', fileName: 'cv.docx' }
);
assertMultiFormatFields(docxEnriched.multiFormat, 'docx');
ok(docxEnriched.multiFormat.sourceType === 'docx', 'docx sourceType');
formats.push({
  id: 'docx',
  ...docxEnriched.multiFormat,
  selectedSource: docxEnriched.multiFormat.selectedSource,
});

// --- DOC ---
const docEnriched = enrichMultiFormatExtraction(
  wrapEnterprise(yoaz, 'docx', 'doc'),
  { inputKind: 'doc', fileName: 'cv.doc' }
);
ok(docEnriched.multiFormat.sourceType === 'doc', 'doc sourceType');
formats.push({ id: 'doc', ...docEnriched.multiFormat, selectedSource: docEnriched.multiFormat.selectedSource });

// --- PDF selectable text (simulated native) ---
const pdfNativeEnriched = enrichMultiFormatExtraction(
  wrapEnterprise(yoaz, 'native_pdf', 'pdf_text'),
  { inputKind: 'pdf', fileName: 'cv.pdf' }
);
assertMultiFormatFields(pdfNativeEnriched.multiFormat, 'pdf_text');
ok(pdfNativeEnriched.multiFormat.sourceType === 'pdf_text', 'pdf_text sourceType');
formats.push({
  id: 'pdf_text',
  ...pdfNativeEnriched.multiFormat,
  selectedSource: pdfNativeEnriched.multiFormat.selectedSource,
});

// --- PDF scanned / image-based OCR simulation ---
const ocrLines = yoaz
  .split('\n')
  .map((t, i) => ({
    text: t.trim(),
    cleanedText: t.trim(),
    confidence: 72,
    source: 'ocr',
    page: 1,
    line: i,
    x: 0,
    y: i * 12,
  }))
  .filter((l) => l.text);
const pdfScanEnriched = enrichMultiFormatExtraction(
  {
    text: yoaz,
    method: 'ocr',
    fileType: 'pdf_scanned',
    enterprise: {
      rawExtraction: yoaz,
      cleanedText: yoaz,
      text: yoaz,
      lines: ocrLines,
      method: 'ocr',
      metadata: { fileType: 'pdf_scanned' },
    },
    lines: ocrLines,
    pdfExtraction: { fileType: 'pdf_scanned', route: 'ocr_full' },
  },
  { inputKind: 'pdf', fileName: 'scan.pdf' }
);
ok(pdfScanEnriched.multiFormat.sourceType === 'pdf_image', 'pdf_image sourceType for ocr-only');
ok(pdfScanEnriched.multiFormat.ocrTextLength > 200, 'pdf ocr length');
formats.push({
  id: 'pdf_image',
  ...pdfScanEnriched.multiFormat,
  selectedSource: pdfScanEnriched.multiFormat.selectedSource,
});

// --- PDF mixed merge ---
const nativeLines = yoaz
  .split('\n')
  .slice(0, 20)
  .map((t, i) => ({
    text: t.trim(),
    cleanedText: t.trim(),
    confidence: 92,
    source: 'native',
    page: 1,
    line: i,
    x: 0,
    y: i * 12,
  }))
  .filter((l) => l.text);
const merged = mergeNativeAndOcrLines(nativeLines, ocrLines);
ok(merged.length >= nativeLines.length, 'merge keeps native lines');
const mixedEnriched = enrichMultiFormatExtraction(
  {
    text: yoaz,
    method: 'mixed',
    fileType: 'pdf_mixed',
    enterprise: {
      rawExtraction: yoaz,
      cleanedText: yoaz,
      text: yoaz,
      lines: [...nativeLines, ...ocrLines.slice(20)],
      method: 'mixed',
      metadata: { fileType: 'pdf_mixed' },
    },
    lines: [...nativeLines, ...ocrLines.slice(20)],
    pdfExtraction: { fileType: 'pdf_mixed' },
  },
  { inputKind: 'pdf', fileName: 'mixed.pdf' }
);
ok(mixedEnriched.multiFormat.sourceType === 'pdf_mixed', 'pdf_mixed sourceType');
ok(mixedEnriched.multiFormat.nativeTextLength > 0, 'mixed has native');
ok(mixedEnriched.multiFormat.ocrTextLength > 0, 'mixed has ocr');
formats.push({
  id: 'pdf_mixed',
  ...mixedEnriched.multiFormat,
  selectedSource: mixedEnriched.multiFormat.selectedSource,
});

// --- Structured parity: DOCX vs PDF text ---
const pipeDocx = await runProductionExtractionPipeline(yoaz, { extractionMethod: 'docx' });
const pipePdf = await runProductionExtractionPipeline(yoaz, { extractionMethod: 'native_pdf' });
const countsDocx = sectionCounts(pipeDocx);
const countsPdf = sectionCounts(pipePdf);

let pdfCacheText = '';
if (fs.existsSync(PDF_CACHE)) {
  const lr = JSON.parse(fs.readFileSync(PDF_CACHE, 'utf8'))?.browserReport?.pdf?.lastResult || {};
  pdfCacheText = lr.rawText || lr.cleanedText || '';
}

const parity = {
  docx: countsDocx,
  pdf_simulated: countsPdf,
  experiencesMatch: countsDocx.experiences === countsPdf.experiences,
  educationMatch: countsDocx.education === countsPdf.education,
  skillsClose:
    Math.abs(countsDocx.skills + countsDocx.tools - (countsPdf.skills + countsPdf.tools)) <= 2,
};

ok(countsDocx.experiences >= 5, 'docx experiences parsed');
ok(countsPdf.experiences >= 5, 'pdf experiences parsed');
ok(parity.experiencesMatch, 'docx/pdf experience count match');
ok(parity.educationMatch, 'docx/pdf education count match');
ok(parity.skillsClose, 'docx/pdf skills within tolerance');

// --- Richest source selection ---
ok(
  pdfScanEnriched.multiFormat.selectedSource === 'ocr' ||
    pdfScanEnriched.multiFormat.selectedSource === 'merged',
  'ocr-only pdf picks ocr or merged'
);
ok(txtEnriched.multiFormat.selectedSource === 'native', 'txt picks native');

const report = {
  pass: failed === 0,
  generatedAt: new Date().toISOString(),
  engineVersion: MULTI_FORMAT_ENGINE_VERSION,
  formats,
  parity,
  pdfCacheChars: pdfCacheText.length,
  pipeline: ['native', 'ocr', 'merge', 'confidence', 'best_selection'],
};

fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(OUT_JSON, JSON.stringify(report, null, 2));
console.log('Wrote', OUT_JSON);
process.exit(failed ? 1 : 0);
