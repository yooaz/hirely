/**
 * CV Rebuild Engine — never preserve source layout.
 *
 * Pipeline: CV → Extract → Structure → Normalize → Rebuild
 *
 * Output is always rebuilt from extracted semantic data. Source formatting,
 * columns, geometry, and layout hints are stripped — never passed to templates.
 */

import { extractPlainTextEnterprise } from '../extraction/enterprise-engine.js';
import { runP0Pipeline } from './p0-pipeline.js';
import { buildStructuredResumeFromDocumentBlocks } from '../parsing/structured-resume-from-blocks.js';
import { normalizeCvDocument } from '../parsing/cv-normalizer.js';
import {
  slimStructuredResume,
  stripCvDataForTemplate,
  coerceParserInputText,
} from './pipeline-contract.js';
import {
  resumeDataFromStructured,
  normalizeResumeData,
  resumeDataToCvData,
} from '../resume-data.js';
import {
  buildFinalResumeData,
  validateFinalResumeContract,
  isFinalResumeRenderable,
} from '../validation/final-resume-contract.js';

export const CV_REBUILD_ENGINE_V1 = 'CV_REBUILD_ENGINE_V1';

/** @type {readonly ['extract', 'structure', 'normalize', 'rebuild']} */
export const REBUILD_PIPELINE = Object.freeze([
  'extract',
  'structure',
  'normalize',
  'rebuild',
]);

const LAYOUT_META_KEYS = [
  'layoutType',
  'layoutStage',
  'columnsStage',
  'readingStage',
  'visualStructure',
  'ocrLayout',
  'columnIndex',
  'bbox',
  'geometry',
  'x',
  'y',
  'width',
  'height',
  'pageBox',
  'sourceLayout',
  'preserveLayout',
];

const FORBIDDEN_CV_KEYS = [
  '_sourceLines',
  '_enterprise',
  'enterpriseExtraction',
  'forensic',
  'layoutBlocks',
  'renderBlocks',
  'documentBlocks',
];

const TAB_ALIGN_RE = /\t{2,}/;
const MULTI_SPACE_ALIGN_RE = / {3,}/;

/**
 * @param {string} value
 */
function stripFormattingArtifacts(value) {
  let s = String(value || '');
  if (!s) return '';
  s = s.replace(/\t/g, ' ');
  s = s.replace(/ {2,}/g, ' ');
  return s.trim();
}

/**
 * @param {object|null} structured
 */
function stripLayoutFromStructured(structured) {
  if (!structured || typeof structured !== 'object') return structured;
  const slim = slimStructuredResume(structured) || {};
  const meta = { ...(slim.metadata || {}) };
  for (const key of LAYOUT_META_KEYS) {
    delete meta[key];
  }
  delete meta.documentBlocks;
  delete meta.readingBlockCount;
  delete meta.usedRawPdfLineOrder;
  delete meta.usedGeometryReadingOrder;
  meta.rebuildFromData = true;
  meta.rebuildEngine = CV_REBUILD_ENGINE_V1;
  meta.neverPreservesSourceLayout = true;
  meta.pipeline = [...REBUILD_PIPELINE];
  return {
    ...slim,
    identity: slim.identity
      ? Object.fromEntries(
          Object.entries(slim.identity).map(([k, v]) => [k, stripFormattingArtifacts(v)])
        )
      : slim.identity,
    summary: stripFormattingArtifacts(slim.summary),
    unsorted: (slim.unsorted || []).map(stripFormattingArtifacts).filter(Boolean),
    metadata: meta,
  };
}

/**
 * @param {object} resumeData
 */
function stripFormattingFromResumeData(resumeData) {
  if (!resumeData || typeof resumeData !== 'object') return resumeData;
  const rd = normalizeResumeData(resumeData);
  const id = rd.identity || {};
  rd.identity = {
    ...id,
    name: stripFormattingArtifacts(id.name),
    title: stripFormattingArtifacts(id.title),
    email: stripFormattingArtifacts(id.email),
    phone: stripFormattingArtifacts(id.phone),
    location: stripFormattingArtifacts(id.location),
    linkedin: stripFormattingArtifacts(id.linkedin),
    website: stripFormattingArtifacts(id.website),
  };
  rd.summary = stripFormattingArtifacts(rd.summary);
  rd.unsorted = (rd.unsorted || []).map(stripFormattingArtifacts).filter(Boolean);
  rd.experiences = (rd.experiences || []).map((exp) => ({
    ...exp,
    role: stripFormattingArtifacts(exp.role),
    company: stripFormattingArtifacts(exp.company),
    dates: stripFormattingArtifacts(exp.dates),
    location: stripFormattingArtifacts(exp.location),
    bullets: (exp.bullets || []).map(stripFormattingArtifacts).filter(Boolean),
  }));
  rd.education = (rd.education || []).map(stripFormattingArtifacts).filter(Boolean);
  rd.skills = (rd.skills || []).map(stripFormattingArtifacts).filter(Boolean);
  rd.tools = (rd.tools || []).map(stripFormattingArtifacts).filter(Boolean);
  rd.languages = (rd.languages || []).map(stripFormattingArtifacts).filter(Boolean);
  rd.meta = {
    ...(rd.meta || {}),
    rebuildEngine: CV_REBUILD_ENGINE_V1,
    neverPreservesSourceLayout: true,
    rebuildPipeline: [...REBUILD_PIPELINE],
  };
  for (const key of LAYOUT_META_KEYS) {
    delete rd.meta[key];
  }
  return rd;
}

/**
 * @param {object} input
 * @param {object} [opts]
 */
function runExtractStage(input, opts = {}) {
  const rawText = String(input.rawText || input.text || '').trim();
  const preCleaned = String(input.cleanedText || '').trim();
  const lines = input.lines || input.pipe?.stages?.documentBlocks?.lines || null;
  const extractionMethod = String(
    input.extractionMethod || opts.extractionMethod || input.pipe?.extractionMethod || 'paste'
  ).toLowerCase();

  if (lines?.length) {
    return {
      stage: 'extract',
      rawText: rawText || lines.map((l) => l.text || l.cleanedText || '').join('\n'),
      cleanedText: preCleaned || coerceParserInputText(rawText, rawText),
      lines,
      extractionMethod,
      source: extractionMethod || 'lines',
    };
  }

  if (!rawText.length) {
    return {
      stage: 'extract',
      rawText: '',
      cleanedText: '',
      lines: [],
      extractionMethod,
      source: 'empty',
      error: 'RAW_TEXT_EMPTY',
    };
  }

  const enterprise = extractPlainTextEnterprise(rawText, extractionMethod.includes('pdf') ? 'pdf' : 'txt');
  const normalized = normalizeCvDocument(rawText, {
    extractionMethod,
    ocr: /ocr|scan|mixed/i.test(extractionMethod),
  });

  return {
    stage: 'extract',
    rawText: enterprise.rawExtraction || rawText,
    cleanedText: normalized.cleanedText || enterprise.cleanedText || preCleaned || rawText,
    lines: enterprise.lines || [],
    extractionMethod,
    source: enterprise.source || extractionMethod,
    enterprise,
  };
}

/**
 * @param {object} extract
 * @param {object} [opts]
 */
function runStructureStage(extract, opts = {}) {
  if (opts.structuredResume && !opts.forceRestructure) {
    return {
      stage: 'structure',
      structuredResume: stripLayoutFromStructured(opts.structuredResume),
      fromExisting: true,
      layoutDetected: null,
    };
  }

  const pipe = runP0Pipeline(
    {
      lines: extract.lines,
      rawText: extract.rawText,
      cleanedText: extract.cleanedText,
      source: extract.source || extract.extractionMethod || 'paste',
    },
    { skipStructuredResume: true }
  );

  const structuredResume = buildStructuredResumeFromDocumentBlocks(pipe.renderBlocks, {
    rawText: extract.rawText,
    cleanedText: extract.cleanedText,
    extractionMethod: extract.extractionMethod,
    layoutType: pipe.layout?.layoutType,
    layoutStage: pipe.layout,
    readingStage: pipe.reading,
    extractionLines: extract.lines,
  });

  return {
    stage: 'structure',
    structuredResume: stripLayoutFromStructured(structuredResume),
    blockPipeline: pipe,
    layoutDetected: pipe.layout?.layoutType || null,
    fromExisting: false,
  };
}

/**
 * @param {object} structure
 * @param {object} extract
 */
function runNormalizeStage(structure, extract) {
  const docNorm = normalizeCvDocument(extract.cleanedText || extract.rawText, {
    extractionMethod: extract.extractionMethod,
    ocr: /ocr|scan|mixed/i.test(extract.extractionMethod || ''),
  });

  let resumeData = resumeDataFromStructured(structure.structuredResume);
  resumeData = stripFormattingFromResumeData(resumeData);
  resumeData.meta = {
    ...(resumeData.meta || {}),
    rawText: extract.rawText,
    cleanedText: docNorm.cleanedText || extract.cleanedText,
    normalizedAt: new Date().toISOString(),
  };

  return {
    stage: 'normalize',
    structuredResume: structure.structuredResume,
    resumeData,
    cleanedText: docNorm.cleanedText || extract.cleanedText,
    normalization: docNorm,
  };
}

/**
 * @param {object} normalize
 * @param {object} extract
 */
function runRebuildStage(normalize, extract) {
  const final = buildFinalResumeData(normalize.resumeData, {
    rawText: extract.rawText,
    cleanedText: normalize.cleanedText || extract.cleanedText,
    lockShape: true,
  });

  let cvData = resumeDataToCvData(final.finalResumeData || normalize.resumeData);
  cvData = stripCvDataForTemplate(cvData);
  for (const key of FORBIDDEN_CV_KEYS) {
    delete cvData[key];
  }

  let finalResumeData = final.finalResumeData;
  if (finalResumeData) {
    finalResumeData = {
      ...finalResumeData,
      meta: {
        ...(finalResumeData.meta || {}),
        rebuildEngine: CV_REBUILD_ENGINE_V1,
        neverPreservesSourceLayout: true,
        rebuildPipeline: [...REBUILD_PIPELINE],
      },
    };
  }

  return {
    stage: 'rebuild',
    structuredResume: normalize.structuredResume,
    resumeData: finalResumeData || normalize.resumeData,
    finalResumeData,
    cvData,
    contract: final.contract,
    reviewItems: final.reviewItems || [],
    renderable: isFinalResumeRenderable(final.contract),
  };
}

/**
 * @param {object} output
 * @param {object} [ctx]
 */
export function auditRebuildOutput(output, ctx = {}) {
  const violations = [];
  const checks = [];

  const cv = output.cvData || {};
  const rd = output.resumeData || output.finalResumeData || {};
  const meta = rd.meta || {};
  const structuredMeta = output.structuredResume?.metadata || {};

  const neverPreserves =
    meta.neverPreservesSourceLayout === true ||
    structuredMeta.neverPreservesSourceLayout === true;

  checks.push({
    id: 'never_preserves_layout',
    ok: neverPreserves,
  });
  if (!neverPreserves) {
    violations.push('LAYOUT_PRESERVATION_FLAG_MISSING');
  }

  checks.push({
    id: 'rebuild_engine_version',
    ok:
      meta.rebuildEngine === CV_REBUILD_ENGINE_V1 ||
      structuredMeta.rebuildEngine === CV_REBUILD_ENGINE_V1,
  });

  for (const key of FORBIDDEN_CV_KEYS) {
    if (key in cv) violations.push(`FORBIDDEN_CV_KEY:${key}`);
  }
  checks.push({
    id: 'no_forbidden_cv_keys',
    ok: FORBIDDEN_CV_KEYS.every((k) => !(k in cv)),
  });

  for (const key of LAYOUT_META_KEYS) {
    if (key in meta) violations.push(`LAYOUT_META_LEAK:${key}`);
    if (key in structuredMeta) violations.push(`LAYOUT_META_LEAK:structured.${key}`);
  }
  checks.push({
    id: 'no_layout_meta',
    ok:
      LAYOUT_META_KEYS.every((k) => !(k in meta)) &&
      LAYOUT_META_KEYS.every((k) => !(k in structuredMeta)),
  });

  const fieldHay = [
    rd.identity?.name,
    rd.identity?.title,
    rd.summary,
    ...(rd.skills || []),
    ...(rd.unsorted || []),
  ]
    .filter(Boolean)
    .join('\n');

  const hasTabAlign = TAB_ALIGN_RE.test(fieldHay);
  const hasMultiSpaceAlign = MULTI_SPACE_ALIGN_RE.test(fieldHay);
  checks.push({ id: 'no_tab_alignment', ok: !hasTabAlign });
  checks.push({ id: 'no_multi_space_alignment', ok: !hasMultiSpaceAlign });
  if (hasTabAlign) violations.push('TAB_ALIGNMENT_IN_OUTPUT');
  if (hasMultiSpaceAlign) violations.push('MULTI_SPACE_ALIGNMENT_IN_OUTPUT');

  const contract = output.contract || validateFinalResumeContract(output.finalResumeData);
  checks.push({
    id: 'contract_checked',
    ok: contract && typeof contract === 'object',
  });

  checks.push({
    id: 'has_identity',
    ok: Boolean(rd.identity?.name || cv.name || cv.identity?.name),
  });

  const clean = violations.length === 0;
  return {
    version: CV_REBUILD_ENGINE_V1,
    clean,
    violations,
    checks,
    renderable: output.renderable === true || isFinalResumeRenderable(contract),
    neverPreservesSourceLayout: neverPreserves,
    layoutDetected: ctx.extract?.layoutDetected || ctx.structure?.layoutDetected || null,
    stagesCompleted: REBUILD_PIPELINE.length,
  };
}

/**
 * Full rebuild pipeline from raw text, lines, or post-extraction context.
 *
 * @param {object} input
 * @param {object} [opts]
 */
export function runCvRebuildEngine(input = {}, opts = {}) {
  const extract = runExtractStage(input, opts);
  if (extract.error === 'RAW_TEXT_EMPTY' && !input.structuredResume) {
    const audit = auditRebuildOutput({ cvData: {}, resumeData: {}, contract: { ok: false } });
    return {
      version: CV_REBUILD_ENGINE_V1,
      pipeline: [...REBUILD_PIPELINE],
      neverPreservesSourceLayout: true,
      stages: { extract, structure: null, normalize: null, rebuild: null },
      structuredResume: null,
      resumeData: null,
      finalResumeData: null,
      cvData: null,
      contract: { ok: false, reasons: ['RAW_TEXT_EMPTY'] },
      audit,
      error: 'RAW_TEXT_EMPTY',
    };
  }

  const structure = runStructureStage(extract, {
    ...opts,
    structuredResume: input.structuredResume,
    forceRestructure: opts.forceRestructure === true,
  });
  const normalize = runNormalizeStage(structure, extract);
  const rebuild = runRebuildStage(normalize, extract);
  const audit = auditRebuildOutput(rebuild, { extract, structure });

  return {
    version: CV_REBUILD_ENGINE_V1,
    pipeline: [...REBUILD_PIPELINE],
    neverPreservesSourceLayout: true,
    stages: { extract, structure, normalize, rebuild },
    structuredResume: rebuild.structuredResume,
    resumeData: rebuild.resumeData,
    finalResumeData: rebuild.finalResumeData,
    cvData: rebuild.cvData,
    contract: rebuild.contract,
    reviewItems: rebuild.reviewItems,
    renderable: rebuild.renderable,
    audit,
  };
}

/**
 * Apply rebuild engine to a Hirely import result — replaces template-facing data.
 *
 * @param {object} ctx
 */
export function applyCvRebuildEngine(ctx = {}) {
  const rebuilt = runCvRebuildEngine({
    rawText: ctx.rawText,
    cleanedText: ctx.cleanedText,
    lines: ctx.lines,
    structuredResume: ctx.structuredResume,
    resumeData: ctx.resumeData,
    extractionMethod: ctx.extractionMethod,
    pipe: ctx.pipe,
  });

  return {
    ...rebuilt,
    importPatch: {
      structuredResume: rebuilt.structuredResume,
      resumeData: rebuilt.resumeData,
      finalResumeData: rebuilt.finalResumeData,
      templateData: rebuilt.cvData,
      rebuildEngine: rebuilt.audit,
    },
  };
}
