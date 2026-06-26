/**
 * Semantic grouping — assign OCR line groups to resume sections (order-agnostic).
 */

import { inferLineSection, isSectionHeaderLine } from '../text-reconstruction.js';
import { passesExperienceGate } from '../section-sanity.js';
import { lineHasYearAnchor, yearClusterSortKey } from './year-cluster.js';

const SECTION_ORDER = [
  'profile',
  'summary',
  'experience',
  'education',
  'skills',
  'tools',
  'languages',
  'clients',
  'interests',
  'contact',
];

/**
 * @param {{ lines: string[], sectionHint?: string|null, kind?: string }} group
 */
export function inferGroupSection(group) {
  if (group.kind === 'header') {
    const header = group.lines[0] || '';
    if (isSectionHeaderLine(header)) {
      const sec = inferLineSection(header);
      return sec === 'header' ? 'unknown' : sec;
    }
  }

  if (group.kind === 'experience-stack') {
    return 'experience';
  }

  if (group.sectionHint === 'experience') {
    return 'experience';
  }

  if (group.sectionHint && group.sectionHint !== 'content' && group.sectionHint !== 'profile') {
    return group.sectionHint;
  }

  const blob = (group.lines || []).join(' ');
  const votes = new Map();
  for (const line of group.lines || []) {
    const sec = inferLineSection(line);
    if (sec && sec !== 'content' && sec !== 'header') {
      votes.set(sec, (votes.get(sec) || 0) + 1);
    }
  }
  if (votes.size) {
    let best = 'content';
    let max = 0;
    for (const [k, v] of votes) {
      if (v > max) {
        max = v;
        best = k;
      }
    }
    if (best !== 'content') return best;
  }

  if (group.kind === 'experience-stack' || passesExperienceGate(blob) || lineHasYearAnchor(blob)) {
    return 'experience';
  }

  return inferLineSection(blob) === 'content' ? 'unknown' : inferLineSection(blob);
}

/**
 * Bucket groups by section; experience sorted by year cluster.
 * @param {{ lines: string[], sectionHint?: string|null, kind?: string }[]} groups
 */
export function bucketGroupsBySection(groups = []) {
  /** @type {Record<string, { lines: string[], sortKey: number }[]>} */
  const buckets = {};

  for (const group of groups) {
    if (group.kind === 'header') continue;
    const section = inferGroupSection(group);
    const key = section === 'unknown' ? 'unsorted' : section;
    if (!buckets[key]) buckets[key] = [];
    buckets[key].push({
      lines: group.lines,
      sortKey: section === 'experience' ? yearClusterSortKey(group.lines) : 0,
    });
  }

  if (buckets.experience?.length) {
    buckets.experience.sort((a, b) => b.sortKey - a.sortKey);
  }

  return buckets;
}

export { SECTION_ORDER };
