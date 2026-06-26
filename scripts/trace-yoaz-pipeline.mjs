#!/usr/bin/env node
/**
 * Yoaz PDF pipeline trace — capture exact objects at each checkpoint.
 * node scripts/trace-yoaz-pipeline.mjs
 * Output: TRACE_YOAZ_PIPELINE.json (repo root)
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { writeFileSync } from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const PDF_CANDIDATES = [
  process.env.HIRELY_YOAZ_PDF,
  '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
  '/Users/yohannazancot/Documents/cv2022 yohann azancot copie.pdf',
  path.join(ROOT, 'tests/fixtures/yoaz-cv/fixture.pdf'),
].filter(Boolean);

const OCR_CACHE = path.join(ROOT, 'tests/output/ocr-quality-yoaz/report.json');
const OUT_PATH = path.join(ROOT, 'TRACE_YOAZ_PIPELINE.json');

const IDENTITY_KEYS = ['name', 'title', 'email', 'phone', 'location', 'website', 'linkedin'];
const SECTION_KEYS = [
  'experiences',
  'experience',
  'education',
  'skills',
  'tools',
  'languages',
  'clients',
  'projects',
  'unsorted',
  'summary',
];

function resolvePdf() {
  for (const p of PDF_CANDIDATES) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

function makeFile(buf, name = 'yoaz.pdf') {
  if (typeof File !== 'undefined') {
    return new File([buf], name, { type: 'application/pdf' });
  }
  return {
    name,
    type: 'application/pdf',
    size: buf.length,
    arrayBuffer: async () =>
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
}

function arrLen(v) {
  return Array.isArray(v) ? v.filter(Boolean).length : 0;
}

function sectionCounts(obj) {
  if (!obj) return {};
  const exp = obj.experiences ?? obj.experience ?? [];
  return {
    experiences: arrLen(exp),
    education: arrLen(obj.education),
    skills: arrLen(obj.skills),
    tools: arrLen(obj.tools),
    languages: arrLen(obj.languages),
    clients: arrLen(obj.clients),
    projects: arrLen(obj.projects),
    unsorted: arrLen(obj.unsorted),
    summary: obj.summary ? 1 : 0,
    blocks: arrLen(obj.blocks),
    lines: arrLen(obj.lines),
    textLength: typeof obj.text === 'string' ? obj.text.length : typeof obj.ocrText === 'string' ? obj.ocrText.length : 0,
  };
}

function identitySnapshot(id = {}) {
  const out = {};
  for (const k of IDENTITY_KEYS) {
    const v = String(id[k] || '').trim();
    out[k] = v || null;
  }
  return out;
}

function missingIdentity(id = {}) {
  return IDENTITY_KEYS.filter((k) => !String(id[k] || '').trim());
}

function missingSections(counts, min = 1) {
  const check = ['experiences', 'education', 'skills', 'tools', 'languages', 'clients'];
  return check.filter((k) => (counts[k] || 0) < min);
}

function firstExamples(arr, n = 3) {
  if (!Array.isArray(arr)) return [];
  return arr.filter(Boolean).slice(0, n);
}

function truncateLines(lines, max = 80) {
  const arr = Array.isArray(lines) ? lines : [];
  if (arr.length <= max) return { lines: arr, truncated: false, total: arr.length };
  return { lines: arr.slice(0, max), truncated: true, total: arr.length };
}

function countDelta(before, after) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  const delta = {};
  for (const k of keys) {
    const b = before?.[k] ?? 0;
    const a = after?.[k] ?? 0;
    if (b !== a) delta[k] = { before: b, after: a, lost: Math.max(0, b - a), gained: Math.max(0, a - b) };
  }
  return delta;
}

function slimExperience(e) {
  if (!e) return null;
  if (typeof e === 'string') return e;
  return {
    role: e.role || e.title || null,
    company: e.company || e.employer || null,
    dates: e.dates || [e.startDate, e.endDate].filter(Boolean).join('–') || null,
    bullets: (e.bullets || []).slice(0, 5),
    confidence: e.confidence ?? null,
  };
}

function slimEducation(e) {
  if (!e) return null;
  if (typeof e === 'string') return e;
  return {
    school: e.school || e.institution || null,
    degree: e.degree || e.program || null,
    dates: e.dates || e.year || null,
    confidence: e.confidence ?? null,
  };
}

function examplesFromObject(obj) {
  if (!obj) return {};
  const exp = obj.experiences ?? obj.experience ?? [];
  return {
    identity: identitySnapshot(obj.identity || {
      name: obj.name,
      title: obj.title,
      email: obj.email,
      phone: obj.phone,
      location: obj.location,
    }),
    summary: obj.summary ? String(obj.summary).slice(0, 300) : null,
    experiences: firstExamples(exp).map(slimExperience),
    education: firstExamples(obj.education).map(slimEducation),
    skills: firstExamples(obj.skills),
    tools: firstExamples(obj.tools),
    languages: firstExamples(obj.languages),
    clients: firstExamples(obj.clients),
    unsorted: firstExamples(obj.unsorted, 8),
  };
}

function buildCheckpoint(name, object, priorCounts = null) {
  const counts = sectionCounts(object);
  const id = object?.identity || {
    name: object?.name,
    title: object?.title,
    email: object?.email,
    phone: object?.phone,
    location: object?.location,
    website: object?.portfolio,
    linkedin: object?.linkedin,
  };
  return {
    checkpoint: name,
    counts,
    examples: examplesFromObject(object),
    missing_fields: {
      identity: missingIdentity(id),
      sections_empty: missingSections(counts),
    },
    delta_from_prior: priorCounts ? countDelta(priorCounts, counts) : null,
    object: object,
  };
}

async function main() {
  const pdfPath = resolvePdf();
  const trace = {
    meta: {
      generatedAt: new Date().toISOString(),
      pdfPath: pdfPath || null,
      ocrCacheUsed: false,
      extractionSource: null,
      note: 'Trace only — no fixes applied',
    },
    checkpoints: {},
    loss_summary: [],
  };

  let priorCounts = null;

  const { extractFromFileDetailed } = await import('../src/core/extraction/extract-file.js');
  const { extractPlainTextEnterprise } = await import('../src/core/extraction/enterprise-engine.js');
  const { runProductionExtractionPipeline } = await import('../src/core/pipeline/production-pipeline.js');
  const { productionToHirelyImportResult } = await import('../src/core/pipeline/hirely-import.js');
  const { resumeDataToCvData } = await import('../src/core/resume-data.js');

  let detailed = null;
  let rawOcrText = '';
  let enterprise = null;

  if (pdfPath) {
    trace.meta.extractionSource = 'live_pdf';
    const buf = fs.readFileSync(pdfPath);
    const file = makeFile(buf, path.basename(pdfPath));
    try {
      detailed = await extractFromFileDetailed(file);
      rawOcrText = String(
        detailed.enterprise?.rawExtraction || detailed.text || ''
      ).trim();
      enterprise = detailed.enterprise || extractPlainTextEnterprise(rawOcrText, detailed.method || 'ocr');
    } catch (err) {
      trace.meta.extractionError = String(err?.message || err);
    }
  }

  if (!rawOcrText && fs.existsSync(OCR_CACHE)) {
    trace.meta.ocrCacheUsed = true;
    trace.meta.extractionSource = trace.meta.extractionSource || 'ocr_cache';
    const cached = JSON.parse(fs.readFileSync(OCR_CACHE, 'utf8'));
    rawOcrText = String(cached.ocrText || '').trim();
    enterprise = extractPlainTextEnterprise(rawOcrText, 'ocr');
    detailed = {
      method: 'ocr',
      text: rawOcrText,
      enterprise,
      importStatus: cached.importState,
      errors: cached.importError ? [cached.importError] : [],
      pdfExtraction: { fromCache: true, pdf: cached.pdf },
    };
  }

  if (!rawOcrText) {
    trace.error = 'No Yoaz PDF or OCR cache available';
    writeFileSync(OUT_PATH, JSON.stringify(trace, null, 2));
    console.error(trace.error);
    process.exit(1);
  }

  const ocrLines = enterprise?.lines || rawOcrText.split('\n').map((t, i) => ({ text: t, index: i }));
  const ocrObject = {
    method: detailed?.method || enterprise?.method || 'ocr',
    text: rawOcrText,
    lines: ocrLines,
    lineCount: ocrLines.length,
    importStatus: detailed?.importStatus,
    errors: detailed?.errors || [],
    warnings: detailed?.warnings || [],
  };

  trace.checkpoints.OCR_OUTPUT = buildCheckpoint('OCR_OUTPUT', ocrObject);
  trace.checkpoints.OCR_OUTPUT.missing_fields.ocr_quality = {
    textLength: rawOcrText.length,
    gatePass: rawOcrText.length >= 200,
    emptyLines: ocrLines.filter((l) => !String(l?.text ?? l).trim()).length,
  };
  priorCounts = trace.checkpoints.OCR_OUTPUT.counts;

  const extractionObject = {
    method: detailed?.method,
    text: detailed?.text || rawOcrText,
    enterprise: enterprise
      ? {
          method: enterprise.method,
          cleanedText: enterprise.cleanedText,
          rawExtraction: enterprise.rawExtraction,
          lines: enterprise.lines,
          lineCount: (enterprise.lines || []).length,
          buckets: enterprise.buckets,
          confidence: enterprise.confidence,
        }
      : null,
    pdfExtraction: detailed?.pdfExtraction || null,
    importStatus: detailed?.importStatus,
    errors: detailed?.errors || [],
  };

  trace.checkpoints.EXTRACTION_OUTPUT = buildCheckpoint('EXTRACTION_OUTPUT', {
    ...extractionObject,
    identity: {},
    experiences: [],
    education: [],
    skills: [],
    tools: [],
    languages: [],
    clients: [],
    unsorted: enterprise?.lines?.map((l) => l?.text || l).filter(Boolean) || [],
    lines: enterprise?.lines,
    text: enterprise?.cleanedText || rawOcrText,
  });
  trace.checkpoints.EXTRACTION_OUTPUT.counts.enterprise_lines = (enterprise?.lines || []).length;
  trace.checkpoints.EXTRACTION_OUTPUT.counts.cleanedTextLength = String(
    enterprise?.cleanedText || ''
  ).length;
  trace.checkpoints.EXTRACTION_OUTPUT.examples.cleanedText_preview = String(
    enterprise?.cleanedText || rawOcrText
  ).slice(0, 600);
  trace.checkpoints.EXTRACTION_OUTPUT.examples.lines = truncateLines(
    (enterprise?.lines || []).map((l) => ({
      text: String(l?.text ?? l).slice(0, 200),
      confidence: l?.confidence ?? null,
      bucket: l?.bucket || l?.type || null,
    })),
    40
  );
  priorCounts = trace.checkpoints.EXTRACTION_OUTPUT.counts;

  const pipe = await runProductionExtractionPipeline(rawOcrText, {
    rawText: rawOcrText,
    extractionMethod: detailed?.method || 'ocr',
    enterpriseExtraction: enterprise,
    canonicalImport: true,
  });

  const structured = pipe.structuredResume || null;
  trace.checkpoints.STRUCTURED_RESUME = buildCheckpoint('STRUCTURED_RESUME', structured, priorCounts);
  trace.checkpoints.STRUCTURED_RESUME.counts.reviewQueue = arrLen(pipe.reviewQueue);
  trace.checkpoints.STRUCTURED_RESUME.examples.reviewQueue = firstExamples(pipe.reviewQueue, 5).map((q) => ({
    category: q.category,
    sourceText: String(q.sourceText || q.detected || '').slice(0, 120),
    confidence: q.confidence ?? null,
  }));
  priorCounts = trace.checkpoints.STRUCTURED_RESUME.counts;

  const imp = productionToHirelyImportResult(pipe, pdfPath ? { name: path.basename(pdfPath) } : null);
  const resumeData = imp.resumeData;

  trace.checkpoints.RESUME_DATA = buildCheckpoint('RESUME_DATA', resumeData, priorCounts);
  trace.checkpoints.RESUME_DATA.counts.reviewQueue = arrLen(imp.reviewQueue);
  trace.checkpoints.RESUME_DATA.examples.reviewQueue = firstExamples(imp.reviewQueue, 5).map((q) => ({
    category: q.category,
    sourceText: String(q.sourceText || q.detected || '').slice(0, 120),
  }));
  trace.checkpoints.RESUME_DATA.missing_fields.import_warnings = imp.warnings || [];
  trace.checkpoints.RESUME_DATA.missing_fields.import_errors = imp.errors || [];
  priorCounts = trace.checkpoints.RESUME_DATA.counts;

  const cvData = resumeDataToCvData(resumeData);
  trace.checkpoints.CV_DATA = buildCheckpoint('CV_DATA', cvData, priorCounts);
  trace.checkpoints.CV_DATA.missing_fields.cv_specific = {
    unsorted_cleared: arrLen(resumeData?.unsorted) > 0 && arrLen(cvData?.unsorted) === 0,
    experience_field: arrLen(cvData?.experience),
    resume_experiences: arrLen(resumeData?.experiences),
  };

  for (const [from, to] of [
    ['OCR_OUTPUT', 'EXTRACTION_OUTPUT'],
    ['EXTRACTION_OUTPUT', 'STRUCTURED_RESUME'],
    ['STRUCTURED_RESUME', 'RESUME_DATA'],
    ['RESUME_DATA', 'CV_DATA'],
  ]) {
    const delta = trace.checkpoints[to].delta_from_prior;
    if (delta && Object.keys(delta).length) {
      trace.loss_summary.push({ from, to, delta });
    }
  }

  trace.print_summary = {
    OCR_OUTPUT: trace.checkpoints.OCR_OUTPUT.counts,
    EXTRACTION_OUTPUT: {
      lines: trace.checkpoints.EXTRACTION_OUTPUT.counts.enterprise_lines,
      unsorted_lines: trace.checkpoints.EXTRACTION_OUTPUT.counts.unsorted,
    },
    STRUCTURED_RESUME: trace.checkpoints.STRUCTURED_RESUME.counts,
    RESUME_DATA: trace.checkpoints.RESUME_DATA.counts,
    CV_DATA: trace.checkpoints.CV_DATA.counts,
  };

  writeFileSync(OUT_PATH, JSON.stringify(trace, null, 2));
  console.log('TRACE_YOAZ_PIPELINE.json written:', OUT_PATH);
  console.log(JSON.stringify(trace.print_summary, null, 2));
  if (trace.loss_summary.length) {
    console.log('\n--- loss_summary ---');
    console.log(JSON.stringify(trace.loss_summary, null, 2));
  }
}

main().catch((err) => {
  console.error('trace failed:', err);
  process.exit(1);
});
