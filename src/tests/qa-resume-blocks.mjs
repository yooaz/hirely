/**
 * Block model — legacy sync, classify moves, reorder.
 */
import {
  ensureResumeBlocks,
  addBlock,
  deleteBlock,
  duplicateBlock,
  moveBlockToIndex,
  updateBlock,
  moveLinesToBlocks,
  legacyToBlocks,
  applyBlocksToResumeData,
  BLOCK_TYPES,
} from '../core/resume-blocks.js';
import { resumeDataToCvData, normalizeResumeData, emptyResumeData } from '../core/resume-data.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

let passed = 0;
function ok(label) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

console.log('qa-resume-blocks');

const base = emptyResumeData();
base.summary = 'Lead designer';
base.experiences = [
  { role: 'CD', company: 'Agency', location: '', dates: '2020–24', bullets: ['Shipped X'] },
];
base.education = ['MA Design'];
base.unsorted = ['Orphan line'];

let rd = ensureResumeBlocks(base);
assert(rd.blocks?.length >= 3, 'legacyToBlocks via ensure');
assert(rd.summary === 'Lead designer', 'summary synced');
assert(rd.experiences[0].role === 'CD', 'experience synced');
ok('ensureResumeBlocks from legacy');

rd = addBlock(rd, 'project');
const proj = rd.blocks.find((b) => b.type === 'project' && !b.text);
assert(proj, 'added empty project');
rd = updateBlock(rd, proj.id, { text: 'Brand refresh' });
assert(rd.projects.includes('Brand refresh'), 'project in legacy');
ok('add + update block');

const expId = rd.blocks.find((b) => b.type === 'experience')?.id;
assert(expId, 'has experience block');
rd = duplicateBlock(rd, expId);
assert(rd.blocks.filter((b) => b.type === 'experience').length === 2, 'dup experience');
ok('duplicateBlock');

rd = moveBlockToIndex(rd, proj.id, 0);
assert(rd.blocks[0].id === proj.id, 'moved to index 0');
ok('moveBlockToIndex');

rd = deleteBlock(rd, proj.id);
assert(!rd.blocks.some((b) => b.id === proj.id), 'deleted');
ok('deleteBlock');

rd = moveLinesToBlocks(rd, ['Orphan line'], 'client');
assert(!rd.unsorted.includes('Orphan line'), 'removed from unsorted');
assert(rd.clients.some((c) => c.includes('Orphan')), 'client block created');
ok('moveLinesToBlocks');

assert(BLOCK_TYPES.includes('summary') && BLOCK_TYPES.includes('language'), 'BLOCK_TYPES');
const cv = resumeDataToCvData(ensureResumeBlocks(rd));
assert(cv.name !== undefined, 'cvData from blocks-backed resume');
ok('resumeDataToCvData');

const norm = normalizeResumeData({ ...rd, blocks: rd.blocks });
assert(Array.isArray(norm.blocks), 'normalize preserves blocks');
ok('normalizeResumeData blocks');

const blocksOnly = legacyToBlocks(emptyResumeData());
const applied = applyBlocksToResumeData(emptyResumeData(), blocksOnly);
assert(Array.isArray(applied.blocks), 'applyBlocks round-trip');
ok('legacyToBlocks / applyBlocksToResumeData');

console.log(`\nqa-resume-blocks: ${passed} passed`);
