/**
 * Orchestrates production 7-stage extraction pipeline (document → layout → blocks → … → score).
 */

import { formatCvAsStructuredText } from '../export/format-cv.js';
import { auditPipeline, assessImportQuality } from '../validation/index.js';
import {
  runProductionExtractionPipeline,
  generateExtractionReport,
  printExtractionReport,
} from '../pipeline/production-pipeline.js';

export {
  formatCvAsStructuredText,
  auditPipeline,
  assessImportQuality,
  generateExtractionReport,
  printExtractionReport,
};

/** @deprecated Alias — use runCanonicalImport / importText from `src/core/pipeline/canonical-import.js` */
export async function runExtractionPipeline(rawText, opts = {}) {
  return runProductionExtractionPipeline(rawText, {
    ...opts,
    canonicalImport: opts.canonicalImport !== false,
  });
}
