/**
 * Primary extraction stage contracts.
 */

import type { DocumentProfile } from './document.types.js';
import type { RawPage, RawBlock, BlockSource } from './cv.types.js';

export type { RawPage, RawBlock, BlockSource };
export type BlockTextSource = BlockSource;

export interface ExtractionResult {
  pages: RawPage[];
  blocks: RawBlock[];
  profile: DocumentProfile;
}
