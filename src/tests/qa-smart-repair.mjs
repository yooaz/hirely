/**
 * Smart Repair — four suggest-only targets; no auto-move on import.
 */
import { SMART_REPAIR_TARGETS, smartRepairTargetButtons } from '../ui/studio/smart-repair.js';
import { buildResumeData, moveUnsortedToSection, normalizeResumeData } from '../core/resume-data.js';

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

let passed = 0;
function ok(label) {
  passed += 1;
  console.log(`  ✓ ${label}`);
}

console.log('qa-smart-repair');

assert(
  SMART_REPAIR_TARGETS.join(',') === 'experience,education,client,skill',
  'SMART_REPAIR_TARGETS'
);
ok('four repair targets');

const labels = smartRepairTargetButtons((k) => k);
assert(labels.length === 4, 'button count');
assert(labels[0].id === 'experience' && labels[0].label === 'smartRepair_move_experience', 'labels');
ok('smartRepairTargetButtons');

const rd = normalizeResumeData({
  unsorted: ['Line A', 'Line B'],
  summary: '',
});
assert(rd.unsorted.length === 2, 'unsorted kept after normalize');
ok('no auto-move on normalize');

const built = buildResumeData({
  structured: {
    identity: { name: 'Test User', title: 'Dev' },
    summary: '',
    experiences: [],
    unsorted: ['Keep me'],
  },
  rawText: 'Keep me\nOther line',
  cleanedText: 'Keep me\nOther line',
});
assert(built.unsorted.some((l) => /keep me/i.test(l)), 'import keeps unsorted');
ok('buildResumeData retains unsorted');

const afterClick = moveUnsortedToSection(built, ['Keep me'], 'skill');
assert(!afterClick.unsorted.includes('Keep me'), 'moved on explicit action');
assert(afterClick.skills.includes('Keep me'), 'skill section');
ok('move only via moveUnsortedToSection (user click path)');

console.log(`\nqa-smart-repair: ${passed} passed`);
