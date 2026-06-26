/**
 * Node-only persistence for exact transcription artifacts.
 * QA / CLI only — never import from browser boot or src/ui.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * @param {object} transcription
 * @param {string} outDir
 * @param {string} [slug]
 */
export function persistExactTranscriptionArtifact(transcription, outDir, slug = 'transcription') {
  if (!outDir) return null;
  try {
    fs.mkdirSync(outDir, { recursive: true });
    const base = String(transcription?.file_name || slug).replace(/[^\w.-]+/g, '_');
    const file = path.join(outDir, `${base}-exact-transcription.json`);
    fs.writeFileSync(file, JSON.stringify(transcription, null, 2));
    return file;
  } catch {
    return null;
  }
}

/**
 * @param {object} transcription
 * @param {string} outDir
 * @param {string} [slug]
 */
export function persistExactTranscriptionBundle(transcription, outDir, slug = 'transcription') {
  if (!outDir || !transcription) return null;
  try {
    fs.mkdirSync(outDir, { recursive: true });
    const base = String(transcription.file_name || slug).replace(/[^\w.-]+/g, '_');
    const jsonPath = path.join(outDir, `${base}-exact-transcription.json`);
    fs.writeFileSync(jsonPath, JSON.stringify(transcription, null, 2));

    const weakPath = path.join(outDir, `${base}-weak-lines.json`);
    fs.writeFileSync(
      weakPath,
      JSON.stringify(transcription.artifacts?.weak_line_report || [], null, 2)
    );

    const wordsPath = path.join(outDir, `${base}-ocr-words-by-page.json`);
    fs.writeFileSync(
      wordsPath,
      JSON.stringify(transcription.artifacts?.ocr_words_by_page || {}, null, 2)
    );

    const tracePath = path.join(outDir, `${base}-page-runtime-trace.json`);
    fs.writeFileSync(
      tracePath,
      JSON.stringify(transcription.artifacts?.page_runtime_trace || [], null, 2)
    );

    return { jsonPath, weakPath, wordsPath, tracePath };
  } catch {
    return null;
  }
}
