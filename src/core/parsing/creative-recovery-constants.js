/** P1 creative client/project recovery anchors — shared constants (no parsing imports). */

import { CLIENT_TERMS } from '../../data/dictionaries/entity-catalog.js';

export const CREATIVE_RECOVERY_CLIENT_ANCHORS = Object.freeze([...CLIENT_TERMS]);

export const CREATIVE_RECOVERY_PROJECT_TYPES = Object.freeze([
  'poster',
  'campaign',
  'illustration',
  'cover',
  'packaging',
  'scarf',
  'animation',
  'billboard',
  'album cover',
  'festival',
  'book cover',
]);

export const CREATIVE_RECOVERY_PROJECT_TYPE_RE =
  /\b(poster|campaign|illustration|cover|packaging|scarf|animation|billboard|album\s+cover|festival|book\s+cover|key\s*art|rebrand)\b/i;
