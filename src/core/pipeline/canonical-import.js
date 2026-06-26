/**
 * HIRELY canonical import — single engine for file upload, paste, DOCX, PDF.
 *
 * handleFileImport(file) → runHirelyImportFromFile → HirelyImportResult
 * paste                  → runHirelyImportFromText  → HirelyImportResult
 *
 * Locked flow: Import → OCR/Text → Clean → Build Blocks → Classify Blocks
 *   → Build ResumeData → Safety Gate → Studio → Style → Export
 * See hirely-flow-lock.js
 */

import { extractDocument } from '../extraction/document-extract.js';
import { buildExtractionArchiveStage } from '../extraction/stages/extraction-archive.js';
import { runP0Pipeline } from './p0-pipeline.js';
import { classifyBlocks } from '../parsing/block-classifier.js';
import { buildStructuredResumeFromDocumentBlocks } from '../parsing/structured-resume-from-blocks.js';
import { runProductionExtractionPipeline } from './production-pipeline.js';
import {
  runHirelyImportFromFile,
  runHirelyImportFromText,
  importFile,
  importText,
  importPaste,
} from './hirely-import.js';

export { extractDocument };
export {
  runHirelyImportFromFile,
  runHirelyImportFromText,
  importFile,
  importText,
  importPaste,
};

/**
 * Stage 2 — layout + reading order → extracted blocks (never raw parseCV).
 */
export function buildBlocks(enterprise, rawText = '', opts = {}) {
  const stageArchive = buildExtractionArchiveStage(enterprise, rawText);
  const source =
    stageArchive.method || opts.extractionMethod || enterprise?.method || 'paste-text';
  return runP0Pipeline(
    {
      lines: stageArchive.lines,
      rawText: stageArchive.rawExtraction || rawText,
      cleanedText: stageArchive.cleanedText,
      source,
      ocrLayout: enterprise?.metadata?.ocrLayout || null,
    },
    { ...opts, skipStructuredResume: true }
  );
}

export { classifyBlocks };

export function buildStructuredResume(renderBlocks, opts = {}) {
  return buildStructuredResumeFromDocumentBlocks(renderBlocks, {
    neverRawParseCv: true,
    parseSource: 'canonical_import',
    ...opts,
  });
}

/** @deprecated Internal — use runHirelyImportFromText */
export async function runCanonicalImport(rawText, opts = {}) {
  return runProductionExtractionPipeline(String(rawText || '').trim(), {
    ...opts,
    canonicalImport: true,
  });
}
