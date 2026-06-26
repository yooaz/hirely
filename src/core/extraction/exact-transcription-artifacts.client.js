/**
 * Browser-safe exact transcription debug state (no fs/path).
 * Safe for exact-transcription-import and browser boot — do not add Node imports here.
 */

/**
 * @param {object} transcription
 */
export function attachExactTranscriptionArtifactsClient(transcription) {
  if (typeof globalThis === 'undefined' || !transcription) return transcription;
  try {
    globalThis.__HIRELY_EXACT_TRANSCRIPTION__ = transcription;
    globalThis.__HIRELY_EXACT_TRANSCRIPTION_ARTIFACTS__ = {
      at: new Date().toISOString(),
      transcription,
      ocr_page_previews: transcription.artifacts?.ocr_page_previews || {},
      ocr_words_by_page: transcription.artifacts?.ocr_words_by_page || {},
      weak_line_report: transcription.artifacts?.weak_line_report || [],
      page_runtime_trace: transcription.artifacts?.page_runtime_trace || [],
    };
  } catch {
    /* ignore */
  }
  return transcription;
}
