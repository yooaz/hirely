/**
 * Block reconstruction — delegates to BLOCK_BUILDER_V1 (DocumentBlock[]).
 */

import {
  buildDocumentBlocksFromOcrLines,
  logBlockBuilderAudit,
  isDateAnchorLine,
} from './block-builder-v1.js';
import {
  spatialBlocksFromLayoutMemory,
} from '../layout/spatial-block.js';
import { splitExperienceLines } from './experience-split-parser.js';
import { detectSectionHeaderId } from './section-detect-v2.js';
import { isSectionHeaderLine } from './rich-parser.js';

export { isDateAnchorLine, mergeRoleContinuationLines } from './block-builder-v1.js';

export const BLOCK_RECONSTRUCTION = 'BLOCK_RECONSTRUCTION';

function isHardBoundaryLine(line) {
  const l = String(line || '').trim();
  if (!l) return true;
  if (detectSectionHeaderId(l)) return true;
  if (isSectionHeaderLine(l)) return true;
  return false;
}

/**
 * @param {string} cleanedText
 * @param {object} [opts]
 */
export function reconstructLineBlocks(cleanedText, opts = {}) {
  const spatialBlocks =
    opts.spatialBlocks?.length > 0
      ? opts.spatialBlocks
      : spatialBlocksFromLayoutMemory(opts.layoutMemory);
  const input =
    spatialBlocks.length > 0
      ? spatialBlocks
      : opts.layoutMemory?.entries?.length > 0
        ? opts.layoutMemory.entries
        : cleanedText;
  const built = buildDocumentBlocksFromOcrLines(input, { ...opts, spatialBlocks });
  const lineGroupBlocks = (built.documentBlocks || []).map((b) => ({
    id: b.id,
    lines: b.lines,
    text: b.text,
    anchor: b.anchor || 'continuation',
    startLine: b.startLine,
    endLine: b.endLine,
    signals: b.signals,
  }));
  return {
    lines: built.lines,
    lineGroupBlocks,
    documentBlocks: built.documentBlocks,
    stats: built.stats,
  };
}

/**
 * @param {object[]} lineGroupBlocks
 */
export function logBlocksCreated(lineGroupBlocks) {
  logBlockBuilderAudit(lineGroupBlocks || []);
}

/**
 * Split experience-section lines into date-anchored sub-blocks.
 * @param {string[]} lines
 */
export function splitLinesIntoDateAnchoredGroups(lines) {
  return splitExperienceLines(lines);
}
