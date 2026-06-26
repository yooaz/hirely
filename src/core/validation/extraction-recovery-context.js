/**
 * Extraction recovery diagnostics — runtime observability for blocked imports.
 */

import { resolveStructureFirstParserText } from '../extraction/structure-first-parser-text.js';

/**
 * @param {object} [input]
 */
export function buildExtractionRecoveryContext(input = {}) {
  const resumeData = input.resumeData || null;
  const meta = resumeData?.meta || input.metadata || {};
  const runtime = input.runtime || globalThis.__HIRELY_LAST_EXTRACTION_RUNTIME__ || null;
  const extractionDebug = meta.extractionDebug || runtime?.extractionDebug || null;
  const pageClass = meta.pageDocumentClassification || extractionDebug?.pageDocumentClassification || null;
  const identityHints = meta.identityRecoveryHints || meta.identityHints || null;

  const pages = [];
  const pageTrace = runtime?.pageRuntimeTrace || extractionDebug?.pageRuntimeTrace || [];
  if (Array.isArray(pageTrace) && pageTrace.length) {
    for (const row of pageTrace) {
      pages.push({
        page: row.page,
        extractionMethod: row.method || row.extractionMethod || null,
        ocrDurationMs: row.ocrDurationMs ?? row.ocrMs ?? null,
        nativeTextQuality: row.nativeTextQuality ?? row.nativeQuality ?? null,
        nativeTrusted: row.nativeTrusted ?? null,
        lineCount: row.lineCount ?? null,
        pageType: classifyPageType(row.page, pageClass),
      });
    }
  } else if (extractionDebug?.linesByPage) {
    for (const [p, lines] of Object.entries(extractionDebug.linesByPage)) {
      pages.push({
        page: Number(p),
        extractionMethod: lines?.[0]?.source || null,
        lineCount: lines?.length || 0,
        pageType: classifyPageType(Number(p), pageClass),
      });
    }
  }

  const structureFirst = input.enterprise
    ? resolveStructureFirstParserText(input.enterprise)
    : null;

  const suspiciousLines = findSuspiciousLines(extractionDebug, meta);
  const nameCandidates = [
    ...(identityHints?.nameCandidates || []),
    ...(meta.nameCandidates || []),
    ...(resumeData?.identity?.name ? [resumeData.identity.name] : []),
  ].filter(Boolean);
  const titleCandidates = [
    ...(identityHints?.titleCandidates || []),
    ...(meta.titleCandidates || []),
    ...(resumeData?.identity?.title ? [resumeData.identity.title] : []),
  ].filter(Boolean);

  const contactCandidates = {
    email: resumeData?.identity?.email || meta.contactEmail || '',
    phone: resumeData?.identity?.phone || meta.contactPhone || '',
    emails: uniqueList(meta.contactEmails || []),
    phones: uniqueList(meta.contactPhones || []),
  };

  const metrics = extractionDebug?.metrics || {};
  const spatialBlockCount =
    meta.spatialBlocks?.length ||
    extractionDebug?.finalPayload?.spatialBlockCount ||
    metrics.spatialBlockCount ||
    0;
  const positionedLineCount = meta.positionedLineCount ?? metrics.positionedLineCount ?? null;

  return {
    at: new Date().toISOString(),
    extractionMethod: meta.extractionMethod || runtime?.method || null,
    parserInputSource: structureFirst?.source || meta.parserTextSource || extractionDebug?.runtime?.parserTextSource || null,
    structureFirst: structureFirst?.structureFirst ?? meta.structureFirstExtraction ?? null,
    pages,
    pageClassification: pageClass,
    resumeCorePages: meta.resumeCorePages || pageClass?.resume_core_pages || metrics.resumeCorePages || [],
    portfolioPages: meta.portfolioPagesExcluded || pageClass?.portfolio_pages || [],
    positionedLineCount,
    spatialBlockCount,
    parsingLineCount: meta.resumeCoreLineCount ?? metrics.parsingLineCount ?? null,
    nativeTrustAudit: runtime?.nativeTrustAudit || extractionDebug?.nativeTrustAudit || null,
    nameCandidates: uniqueList(nameCandidates).slice(0, 6),
    titleCandidates: uniqueList(titleCandidates).slice(0, 6),
    fileNameNameHint: identityHints?.fileNameHint || null,
    contactCandidates,
    suspiciousLines,
    lowConfidenceBlocks: (meta.lowConfidenceBlocks || suspiciousLines).slice(0, 8),
    detectedSections: meta.detectedSections || resumeData?.sections || [],
    missingSections: input.missingSections || [],
    ocrCompleted: pageTrace.some((r) => r.method === 'ocr' || r.extractionMethod === 'ocr'),
    runtimeTrace: pageTrace,
  };
}

/**
 * @param {number} page
 * @param {object|null} pageClass
 */
function classifyPageType(page, pageClass) {
  if (!pageClass) return 'unknown';
  if ((pageClass.portfolio_pages || []).includes(page)) return 'portfolio_page';
  if ((pageClass.resume_core_pages || []).includes(page)) return 'resume_core';
  return 'unknown';
}

function uniqueList(arr) {
  return [...new Set((arr || []).map((s) => String(s || '').trim()).filter(Boolean))];
}

/**
 * @param {object|null} extractionDebug
 * @param {object} meta
 */
function findSuspiciousLines(extractionDebug, meta) {
  const out = [];
  const merged = extractionDebug?.mergedExtractionLines || [];
  const SECTION_RE =
    /\b(experience|expérience|education|formation|skills|compétences|languages|langues|profile|profil)\b/i;
  const CONTACT_RE = /\+\d{9,}|@\w+\./;

  for (const row of merged) {
    const text = String(row.text || '').replace(/\s+/g, ' ').trim();
    if (text.length < 80) continue;
    const sectionHits = (text.match(new RegExp(SECTION_RE.source, 'gi')) || []).length;
    if (sectionHits >= 2 || (sectionHits >= 1 && CONTACT_RE.test(text))) {
      out.push({ page: row.page, text: text.slice(0, 160), reason: 'merged_sections' });
    }
  }

  if (!out.length && meta.rawExtraction) {
    const lines = String(meta.rawExtraction).split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    for (const line of lines.slice(0, 30)) {
      if (line.length > 100 && SECTION_RE.test(line) && CONTACT_RE.test(line)) {
        out.push({ page: 1, text: line.slice(0, 160), reason: 'header_blob' });
      }
    }
  }
  return out.slice(0, 12);
}

/**
 * @param {object} input
 */
export function buildExtractionRecoveryDebugObject(input = {}) {
  const context = buildExtractionRecoveryContext(input);
  const gate = input.previewGate || null;
  const guidance = input.guidance || null;
  return {
    version: 'EXTRACTION_RECOVERY_DEBUG_V1',
    at: new Date().toISOString(),
    previewGate: gate
      ? {
          blockPremiumRender: gate.blockPremiumRender,
          allowPremiumPreview: gate.allowPremiumPreview,
          issues: gate.issues || [],
        }
      : null,
    diagnostics: context,
    recoverySuggestions: guidance?.suggestions || [],
    recoveryActions: guidance?.primaryActions || [],
    parserInputSource: context.parserInputSource,
    blockReasons: (gate?.issues || []).map((i) => i.code),
  };
}
