/**
 * Order-agnostic section mapping — rubriques détectées quel que soit l'ordre dans le CV.
 */

import { scoreSectionHeader } from './section-fuzzy.js';
import { detectSectionsWithConfidence } from './section-detection.js';
import { classifyLine, passesExperienceGate } from './line-cleaner.js';
import { applySectionSanityPass } from './section-sanity.js';
import { applyExtractionConfidenceGate } from './extraction-line-gate.js';
import { applyParserEnterprisePass, clearParserClassificationLog } from './parser-enterprise.js';
import { detectCreativeParsingMode, applyCreativeParsingPass } from './creative-parsing-mode.js';

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;

function headerKeyForLine(line) {
  const scored = scoreSectionHeader(line);
  return scored?.key || null;
}

/**
 * First pass: split by explicit section headers (order in file does not matter).
 */
export function splitBySectionHeaders(text) {
  const { sections, sectionConfidence, headers } = detectSectionsWithConfidence(text);
  return {
    ...sections,
    sectionConfidence,
    _sectionHeaders: headers,
  };
}

const BUCKET_KEYS = [
  'identity',
  'contact',
  'summary',
  'experience',
  'clients',
  'awards',
  'exhibitions',
  'publications',
  'portfolioLinks',
  'education',
  'skills',
  'tools',
  'languages',
  'projects',
  'certifications',
  'volunteer',
  'interests',
  'location',
  'unsorted',
  'needsReview',
];

/**
 * Move orphan lines from `top` into the right section using heuristics (unordered CVs).
 */
export function assignOrphanLinesToSections(blocks) {
  const out = { ...blocks, top: [...(blocks.top || [])] };
  const orphans = [...out.top];
  out.top = [];

  for (const line of orphans) {
    if (headerKeyForLine(line)) continue;
    if (
      (EMAIL_RE.test(line) || (PHONE_RE.test(line) && !/\b(19|20)\d{2}/.test(line))) &&
      !passesExperienceGate(line)
    ) {
      out.contact = out.contact || [];
      out.contact.push(line);
      continue;
    }

    const kind = classifyLine(line);
    let target = 'top';
    if (kind === 'unsorted') {
      out.unsorted = out.unsorted || [];
      out.unsorted.push(line);
      continue;
    }
    if (kind === 'education') target = 'education';
    else if (kind === 'experience') target = 'experience';
    else if (kind === 'tools' || kind === 'tool') target = 'tools';
    else if (kind === 'languages' || kind === 'language') target = 'languages';
    else if (kind === 'skills' || kind === 'skill') target = 'skills';
    else if (kind === 'clients' || kind === 'client') target = 'clients';
    else if (kind === 'awards' || kind === 'award') target = 'awards';
    else if (kind === 'exhibitions' || kind === 'exhibition') target = 'exhibitions';
    else if (kind === 'publications' || kind === 'publication') target = 'publications';
    else if (kind === 'portfolioLinks' || kind === 'portfolioLink') target = 'portfolioLinks';
    else if (kind === 'projects' || kind === 'project') target = 'projects';
    else if (kind === 'interests' || kind === 'interest') target = 'interests';
    else if (kind === 'summary' || kind === 'contact') target = kind === 'contact' ? 'contact' : 'summary';
    else if (/^(profile|summary|about)\b/i.test(line) && line.length > 40) target = 'summary';

    if (target === 'top') out.top.push(line);
    else {
      out[target] = out[target] || [];
      out[target].push(line);
    }
  }

  return out;
}

/**
 * Collect sections regardless of document order (headers + orphan heuristics).
 * @param {string} text cleaned CV text
 * @param {(text: string) => object} [enrichFn] optional enrichBlocksFromTop from rich-parser
 * @param {import('../extraction/extracted-line.js').ExtractedLine[]} [extractionLines]
 */
export function collectSectionsOrderAgnostic(text, enrichFn, extractionLines) {
  clearParserClassificationLog();
  let blocks = splitBySectionHeaders(text);
  if (typeof enrichFn === 'function') blocks = enrichFn(blocks);
  blocks = assignOrphanLinesToSections(blocks);
  blocks = applySectionSanityPass(blocks);
  const allLines = String(text || '').split('\n').filter(Boolean);
  const creativeMode = detectCreativeParsingMode(text, { lines: allLines });
  const creativePass = applyCreativeParsingPass(blocks, creativeMode.active);
  blocks = creativePass.blocks;
  blocks._creativeMode = creativeMode;
  blocks = applyParserEnterprisePass(blocks, allLines, { creativeMode: creativeMode.active });
  const gated = applyExtractionConfidenceGate(blocks, extractionLines);
  blocks = gated.blocks;
  if (gated.extractionReview?.length) {
    blocks._extractionReview = gated.extractionReview;
  }
  const preserveKeys = [
    ...new Set([
      ...BUCKET_KEYS,
      'awards',
      'exhibitions',
      'publications',
      'portfolioLinks',
      'achievements',
      'other',
      ...Object.keys(blocks).filter((k) => !k.startsWith('_')),
    ]),
  ];
  for (const key of preserveKeys) {
    if (!blocks[key]) blocks[key] = [];
  }
  return blocks;
}
