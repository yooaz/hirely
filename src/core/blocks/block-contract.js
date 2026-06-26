/**
 * Structure-first block model — canonical JS contracts (mirrors src/types/blocks.types.ts).
 *
 * Pipeline stages:
 *   RawPage + RawBlock → NormalizedBlock → LogicalBlock → SectionBlock → CVCanonical
 *
 * Plain text is derived only at audit / LLM / last-resort boundaries (see flat-text-guard.js).
 */

export const BLOCK_PIPELINE_VERSION = 'structure-first-v1';

/** @readonly */
export const BLOCK_SOURCE = Object.freeze({
  NATIVE_TEXT: 'native_text',
  OCR: 'ocr',
  DOCX: 'docx',
  PLAIN_TEXT: 'plain_text',
  LAYOUT_MEMORY: 'layout_memory',
  GEOMETRIC: 'geometric',
  PASTE: 'paste',
});

/** @readonly */
export const STRUCTURE_FIRST_STAGE = Object.freeze({
  RAW: 'raw',
  NORMALIZED: 'normalized',
  LOGICAL: 'logical',
  SECTION: 'section',
  CANONICAL: 'canonical',
});

/**
 * @typedef {object} BlockBBox
 * @property {number} x
 * @property {number} y
 * @property {number} w
 * @property {number} h
 * @property {number} [x2]
 * @property {number} [y2]
 */

/**
 * @typedef {object} BlockStyleHints
 * @property {number} [font_size]
 * @property {number} [font_weight]
 * @property {boolean} [is_bold]
 * @property {boolean} [is_uppercase]
 */

/**
 * @typedef {object} RawPage
 * @property {number} page_number
 * @property {number} width
 * @property {number} height
 * @property {number} rotation
 * @property {boolean} has_native_text
 * @property {boolean} has_images
 */

/**
 * @typedef {object} RawBlock
 * @property {string} block_id
 * @property {number} page_number
 * @property {BlockBBox} bbox
 * @property {string} source
 * @property {string} text
 * @property {string} normalized_text
 * @property {string} [column_id]
 * @property {string} [zone_id]
 * @property {number} reading_order
 * @property {number} [line_index]
 * @property {BlockStyleHints} [style]
 */

/**
 * @typedef {object} BlockSignals
 * @property {boolean} looks_like_heading
 * @property {boolean} looks_like_date
 * @property {boolean} looks_like_email
 * @property {boolean} looks_like_phone
 * @property {boolean} [looks_like_url]
 * @property {boolean} [looks_like_bullet]
 * @property {boolean} [looks_like_company]
 * @property {boolean} [looks_like_job_title]
 */

/**
 * @typedef {object} NormalizedBlock
 * @property {string} block_id
 * @property {number} page_number
 * @property {BlockBBox} bbox
 * @property {string} source
 * @property {string} text
 * @property {string} normalized_text
 * @property {string} [column_id]
 * @property {string} [zone_id]
 * @property {number} reading_order
 * @property {string[]} tokens
 * @property {BlockSignals} signals
 * @property {BlockStyleHints} [style]
 */

/**
 * @typedef {object} LogicalBlock
 * @property {string} block_id
 * @property {string} type
 * @property {NormalizedBlock[]} lines
 * @property {string} text
 * @property {number} page_number
 * @property {string} [column_id]
 * @property {string} [zone_id]
 * @property {number} reading_order
 * @property {number} confidence
 */

/**
 * @typedef {object} SectionBlock
 * @property {string} section_id
 * @property {string} block_id
 * @property {LogicalBlock[]} blocks
 * @property {string[]} source_block_ids
 * @property {number} page_number
 * @property {string} [column_id]
 * @property {string} [zone_id]
 * @property {number} reading_order
 * @property {string} text
 */

/**
 * @typedef {object} StructureFirstDocument
 * @property {string} version
 * @property {RawPage[]} pages
 * @property {RawBlock[]} raw_blocks
 * @property {NormalizedBlock[]} normalized_blocks
 * @property {LogicalBlock[]} logical_blocks
 * @property {SectionBlock[]} section_blocks
 * @property {import('../layout/spatial-block.js').SpatialBlock[]} spatial_blocks
 * @property {import('../extraction/extracted-line.js').ExtractedLine[]} extraction_lines
 * @property {string} [derived_plain_text] — audit-only; never primary input
 * @property {boolean} structure_preserved
 */

/**
 * @param {Partial<BlockBBox>} bbox
 * @returns {BlockBBox}
 */
export function normalizeBBox(bbox = {}) {
  const x = Number(bbox.x) || 0;
  const y = Number(bbox.y) || 0;
  const w = Number(bbox.w ?? bbox.width) || 0;
  const h = Number(bbox.h ?? bbox.height) || 0;
  return {
    x,
    y,
    w,
    h,
    x2: Number.isFinite(bbox.x2) ? bbox.x2 : x + w,
    y2: Number.isFinite(bbox.y2) ? bbox.y2 : y - h,
  };
}

/**
 * @param {object} block
 * @returns {boolean}
 */
export function blockHasStructure(block) {
  if (!block) return false;
  const bbox = block.bbox;
  const hasBbox =
    bbox &&
    (Number(bbox.x) !== 0 ||
      Number(bbox.y) !== 0 ||
      Number(bbox.w ?? bbox.width) > 0 ||
      Number(bbox.h ?? bbox.height) > 0);
  const hasZone = Boolean(block.zone_id && block.zone_id !== 'full');
  const hasColumn = Boolean(block.column_id && block.column_id !== 'full');
  return hasBbox || hasZone || hasColumn || Number.isFinite(block.page_number);
}
