/**
 * Build enterprise extraction object from Yoaz benchmark manifest (positioned lines + fixture text).
 * Mirrors what a successful native PDF extract provides to canonical import.
 */
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';
import { cleanExtraction } from '../../src/core/parsing/rich-parser.js';
import { buildLayoutMemory } from '../../src/core/layout/layout-memory.js';
import { spatialBlocksFromLayoutMemory } from '../../src/core/layout/spatial-block.js';
import { IMPORT_STATE } from '../../src/core/import/import-state.js';

const DEFAULT_MANIFEST = 'tests/golden/yoaz-pdf-benchmark.expected.json';

function loadManifestLines(rootDir, manifest) {
  const allLines = [];
  for (const rel of manifest.linesJson || []) {
    const raw = JSON.parse(readFileSync(join(rootDir, rel), 'utf8'));
    for (const l of raw.lines || []) {
      allLines.push({
        ...l,
        cleanedText: l.text,
        rawExtraction: l.text,
        confidence: l.confidence ?? 90,
        source: l.source || 'pdf_native',
      });
    }
  }
  return allLines;
}

/**
 * @param {string} rootDir
 * @param {string} [manifestPath]
 */
export function buildYoazManifestEnterprise(rootDir, manifestPath = DEFAULT_MANIFEST) {
  const manifest = JSON.parse(readFileSync(join(rootDir, manifestPath), 'utf8'));
  const fixturePath = join(rootDir, manifest.fixtureText);
  if (!existsSync(fixturePath)) {
    throw new Error(`fixture text missing: ${manifest.fixtureText}`);
  }
  const rawText = readFileSync(fixturePath, 'utf8');
  const cleanedText = cleanExtraction(rawText, { mode: 'strict' });
  const lines = loadManifestLines(rootDir, manifest);
  const layoutMemory = buildLayoutMemory(lines, { source: 'pdf_native' });
  const spatialBlocks = spatialBlocksFromLayoutMemory(layoutMemory);
  return {
    manifest,
    rawText,
    cleanedText,
    enterprise: {
      rawExtraction: rawText,
      cleanedText,
      text: cleanedText,
      lines,
      method: 'pdf_native',
      layoutMemory,
      spatialBlocks,
      metadata: {
        spatialBlocks,
        layoutMemory,
        neverParseRawPdfText: true,
        documentReconstruction: true,
        fileType: 'pdf_text',
      },
    },
    extracted: {
      fileType: 'pdf',
      rawText,
      cleanedText,
      extractionMethod: 'pdf_native',
      importState: IMPORT_STATE.IMPORT_READY,
      warnings: [],
      errors: [],
    },
  };
}
