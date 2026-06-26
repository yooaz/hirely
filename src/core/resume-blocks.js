/**
 * Hirely block model — all CV content as ordered, editable blocks.
 * Syncs with legacy resumeData fields for templates/export.
 */

import { normalizeResumeData } from './resume-data.js';
import { shouldSkipFlatRepairForResumeData } from './parsing/cv-block-parser-bridge.js';

export const BLOCK_TYPES = [
  'summary',
  'experience',
  'education',
  'project',
  'client',
  'tool',
  'language',
];

export const CREATIVE_BLOCK_TYPES = [
  'summary',
  'client',
  'project',
  'exhibition',
  'award',
  'publication',
  'portfolio',
  'experience',
  'education',
  'tool',
  'language',
];

const BLOCK_LABELS = {
  summary: 'Résumé',
  experience: 'Expérience',
  education: 'Formation',
  project: 'Projet',
  client: 'Client',
  exhibition: 'Exposition',
  award: 'Prix',
  publication: 'Publication',
  portfolio: 'Portfolio',
  tool: 'Outil',
  language: 'Langue',
};

export function blockTypeLabel(type) {
  return BLOCK_LABELS[type] || type;
}

let _blockSeq = 0;
export function newBlockId(type) {
  _blockSeq += 1;
  return `blk-${type}-${_blockSeq}-${Math.random().toString(36).slice(2, 7)}`;
}

/** @param {string} type */
export function createEmptyBlock(type) {
  const t = String(type || '').toLowerCase();
  const id = newBlockId(t);
  if (t === 'summary') return { id, type: 'summary', text: '' };
  if (t === 'experience') {
    return {
      id,
      type: 'experience',
      role: '',
      company: '',
      location: '',
      dates: '',
      bullets: [],
    };
  }
  const textTypes = [...BLOCK_TYPES, 'exhibition', 'award', 'publication', 'portfolio'].filter(
    (x) => x !== 'summary' && x !== 'experience'
  );
  if (textTypes.includes(t)) {
    return { id, type: t, text: '' };
  }
  return { id: newBlockId('summary'), type: 'summary', text: '' };
}

/**
 * @param {import('./resume-data.js').ResumeData} rd
 * @returns {object[]}
 */
export function legacyToBlocks(rd) {
  const skipFlat = shouldSkipFlatRepairForResumeData(rd);
  const data = normalizeResumeData(rd, { skipSanitize: skipFlat, skipPolish: skipFlat });
  const blocks = [];
  const summary = String(data.summary || '').trim();
  if (summary) blocks.push({ id: newBlockId('summary'), type: 'summary', text: summary });

  for (const ex of data.experiences) {
    blocks.push({
      id: newBlockId('experience'),
      type: 'experience',
      role: String(ex.role || '').trim(),
      company: String(ex.company || '').trim(),
      location: String(ex.location || '').trim(),
      dates: String(ex.dates || '').trim(),
      bullets: Array.isArray(ex.bullets) ? ex.bullets.map((b) => String(b || '').trim()).filter(Boolean) : [],
    });
  }

  const pushText = (type, arr) => {
    for (const text of arr || []) {
      const t = String(text || '').trim();
      if (t) blocks.push({ id: newBlockId(type), type, text: t });
    }
  };

  pushText('education', data.education);
  pushText('project', data.projects);
  pushText('client', data.clients);
  pushText('exhibition', data.exhibitions);
  pushText('award', data.awards);
  pushText('publication', data.publications);
  pushText('portfolio', data.portfolioLinks);
  pushText('tool', data.tools);
  for (const text of data.skills || []) {
    const t = String(text || '').trim();
    if (t) blocks.push({ id: newBlockId('skill'), type: 'skill', text: t });
  }
  pushText('language', data.languages);

  return blocks;
}

/**
 * @param {import('./resume-data.js').ResumeData} rd
 * @param {object[]} blocks
 */
export function applyBlocksToResumeData(rd, blocks) {
  const skipFlat = shouldSkipFlatRepairForResumeData(rd);
  const data = normalizeResumeData(rd, { skipSanitize: skipFlat, skipPolish: skipFlat });
  const list = Array.isArray(blocks) ? blocks : [];

  data.summary = '';
  data.experiences = [];
  data.education = [];
  data.clients = [];
  data.projects = [];
  data.exhibitions = [];
  data.awards = [];
  data.publications = [];
  data.portfolioLinks = [];
  data.skills = [];
  data.tools = [];
  data.languages = [];

  const summaryParts = [];

  for (const raw of list) {
    const b = { ...raw };
    const type = String(b.type || '').toLowerCase();
    if (type === 'summary') {
      const t = String(b.text || '').trim();
      if (t) summaryParts.push(t);
    } else if (type === 'experience') {
      data.experiences.push({
        role: String(b.role || '').trim(),
        company: String(b.company || '').trim(),
        location: String(b.location || '').trim(),
        startDate: '',
        endDate: '',
        dates: String(b.dates || '').trim(),
        bullets: Array.isArray(b.bullets)
          ? b.bullets.map((x) => String(x || '').trim()).filter(Boolean)
          : [],
      });
    } else if (type === 'education') {
      const t = String(b.text || '').trim();
      if (t) data.education.push(t);
    } else if (type === 'project') {
      const t = String(b.text || '').trim();
      if (t) data.projects.push(t);
    } else if (type === 'client') {
      const t = String(b.text || '').trim();
      if (t) data.clients.push(t);
    } else if (type === 'exhibition') {
      const t = String(b.text || '').trim();
      if (t) data.exhibitions.push(t);
    } else if (type === 'award') {
      const t = String(b.text || '').trim();
      if (t) data.awards.push(t);
    } else if (type === 'publication') {
      const t = String(b.text || '').trim();
      if (t) data.publications.push(t);
    } else if (type === 'portfolio') {
      const t = String(b.text || '').trim();
      if (t) data.portfolioLinks.push(t);
    } else if (type === 'tool') {
      const t = String(b.text || '').trim();
      if (t) data.tools.push(t);
    } else if (type === 'skill') {
      const t = String(b.text || '').trim();
      if (t) data.skills.push(t);
    } else if (type === 'language') {
      const t = String(b.text || '').trim();
      if (t) data.languages.push(t);
    }
  }

  data.summary = summaryParts.join('\n\n').trim();
  data.blocks = list.map((b) => ({ ...b }));
  return data;
}

/**
 * Ensure resumeData.blocks matches legacy fields (bidirectional sync).
 * @param {import('./resume-data.js').ResumeData} data
 */
export function ensureResumeBlocks(data) {
  const skipFlat = shouldSkipFlatRepairForResumeData(data);
  const rd = normalizeResumeData(data, { skipSanitize: skipFlat, skipPolish: skipFlat });
  if (skipFlat) {
    if (!Array.isArray(rd.blocks) || !rd.blocks.length) {
      rd.blocks = legacyToBlocks(rd);
    }
    return rd;
  }
  const existing = Array.isArray(rd.blocks) ? rd.blocks.filter((b) => b && b.id) : [];
  if (existing.length) {
    return applyBlocksToResumeData(rd, existing);
  }
  rd.blocks = legacyToBlocks(rd);
  return applyBlocksToResumeData(rd, rd.blocks);
}

/**
 * @param {import('./resume-data.js').ResumeData} data
 * @param {string} type
 */
export function addBlock(data, type) {
  const rd = ensureResumeBlocks(data);
  const block = createEmptyBlock(type);
  rd.blocks = [...(rd.blocks || []), block];
  return applyBlocksToResumeData(rd, rd.blocks);
}

/**
 * @param {import('./resume-data.js').ResumeData} data
 * @param {string} blockId
 */
export function deleteBlock(data, blockId) {
  const rd = ensureResumeBlocks(data);
  rd.blocks = (rd.blocks || []).filter((b) => b.id !== blockId);
  return applyBlocksToResumeData(rd, rd.blocks);
}

/**
 * @param {import('./resume-data.js').ResumeData} data
 * @param {string} blockId
 */
export function duplicateBlock(data, blockId) {
  const rd = ensureResumeBlocks(data);
  const idx = (rd.blocks || []).findIndex((b) => b.id === blockId);
  if (idx < 0) return rd;
  const copy = JSON.parse(JSON.stringify(rd.blocks[idx]));
  copy.id = newBlockId(copy.type);
  const next = [...rd.blocks];
  next.splice(idx + 1, 0, copy);
  return applyBlocksToResumeData(rd, next);
}

/**
 * @param {import('./resume-data.js').ResumeData} data
 * @param {string} blockId
 * @param {number} toIndex
 */
export function moveBlockToIndex(data, blockId, toIndex) {
  const rd = ensureResumeBlocks(data);
  const blocks = [...(rd.blocks || [])];
  const from = blocks.findIndex((b) => b.id === blockId);
  if (from < 0) return rd;
  const [item] = blocks.splice(from, 1);
  const to = Math.max(0, Math.min(toIndex, blocks.length));
  blocks.splice(to, 0, item);
  return applyBlocksToResumeData(rd, blocks);
}

/**
 * @param {import('./resume-data.js').ResumeData} data
 * @param {string} blockId
 * @param {object} patch
 */
export function updateBlock(data, blockId, patch) {
  const rd = ensureResumeBlocks(data);
  rd.blocks = (rd.blocks || []).map((b) => (b.id === blockId ? { ...b, ...patch, id: b.id, type: b.type } : b));
  return applyBlocksToResumeData(rd, rd.blocks);
}

/**
 * Move unsorted line into a new block at end.
 * @param {import('./resume-data.js').ResumeData} data
 * @param {string[]} lineTexts
 * @param {string} targetType
 */
export function moveLinesToBlocks(data, lineTexts, targetType) {
  let rd = ensureResumeBlocks(data);
  const keys = new Set(lineTexts.map((t) => String(t).trim().toLowerCase()).filter(Boolean));
  const kept = [];
  for (const line of rd.unsorted) {
    const k = String(line).trim().toLowerCase();
    if (keys.has(k)) {
      const text = String(line).trim();
      if (targetType === 'experience') {
        rd.blocks.push({
          id: newBlockId('experience'),
          type: 'experience',
          role: text.slice(0, 120),
          company: '',
          location: '',
          dates: '',
          bullets: [],
        });
      } else if (targetType === 'summary') {
        rd.blocks.push({ id: newBlockId('summary'), type: 'summary', text });
      } else if (
        BLOCK_TYPES.includes(targetType) ||
        ['exhibition', 'award', 'publication', 'portfolio'].includes(targetType)
      ) {
        rd.blocks.push({ id: newBlockId(targetType), type: targetType, text });
      }
    } else kept.push(line);
  }
  rd.unsorted = kept;
  return applyBlocksToResumeData(rd, rd.blocks);
}
