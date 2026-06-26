/**
 * Safe fallback — « À classer » bucket, export never blocked.
 */
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';
import {
  applySafeFallback,
  applyClassifyTarget,
  ensureExportableCv,
  normalizeToClassifyList,
  TO_CLASSIFY_TARGETS,
} from '../core/parsing/safe-fallback.js';
function emptyCVData() {
  return {
    name: '',
    title: '',
    email: '',
    phone: '',
    summary: '',
    experience: [],
    unknownExperience: [],
    toClassify: [],
    education: [],
    skills: [],
    tools: [],
    languages: [],
    clients: [],
    projects: [],
    unsorted: [],
    extra: [],
  };
}

function cvDataIsRenderable(d) {
  if (!d) return false;
  const tc = (d.toClassify || []).length;
  return !!(
    d.name ||
    d.title ||
    d.email ||
    d.phone ||
    (d.summary && d.summary.length > 5) ||
    (d.experience && d.experience.length) ||
    (d.unknownExperience && d.unknownExperience.length) ||
    tc ||
    (d.unsorted && d.unsorted.length)
  );
}

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

ok(TO_CLASSIFY_TARGETS.length === 10, 'ten classify targets');
ok(
  TO_CLASSIFY_TARGETS.includes('profile') &&
    TO_CLASSIFY_TARGETS.includes('tool') &&
    TO_CLASSIFY_TARGETS.includes('interest'),
  'profile + tool + interest targets'
);

const bare = emptyCVData();
const withUnknown = {
  ...bare,
  name: 'Alex Martin',
  unknownExperience: ['Creative Director — Studio X (2019–2022)', 'Freelance brand projects 2018'],
};
const fb = applySafeFallback(withUnknown, {
  cleanedText: 'Alex Martin\nCreative Director — Studio X (2019–2022)\nFreelance brand projects 2018',
});
ok(fb.toClassify?.length >= 1, 'unknown experience → toClassify');
ok(cvDataIsRenderable(fb), 'toClassify makes CV renderable');
ok(fb._exportBlocked !== true, 'export not blocked');

const noExp = applySafeFallback(
  { ...emptyCVData(), name: 'Jordan Lee', summary: 'Designer based in Paris.' },
  {
    cleanedText:
      'Jordan Lee\nDesigner based in Paris.\n2019–2021 — Lead designer at Agency Co\n2017 — Intern at Studio B',
    lowConfidenceExperience: true,
  }
);
ok(noExp.toClassify?.length >= 1, 'raw career lines → toClassify when no structured experience');
ok(!noExp.experience?.length || noExp._experienceFallback, 'fallback flag when only toClassify');

const careerItem =
  normalizeToClassifyList(noExp.toClassify).find((i) => /\b(19|20)\d{2}\b/.test(i.text || '')) ||
  noExp.toClassify[0];
const itemId = careerItem?.id;
ok(itemId, 'toClassify items have ids');
const moved = applyClassifyTarget(noExp, itemId, 'experience');
ok((moved.experience || []).length >= 1, 'classify → experience');
ok(
  normalizeToClassifyList(moved.toClassify).length < normalizeToClassifyList(noExp.toClassify).length,
  'item removed from toClassify after classify'
);

const secondId = normalizeToClassifyList(noExp.toClassify)[0]?.id || itemId;
const ignored = applyClassifyTarget(
  { ...noExp, toClassify: normalizeToClassifyList(noExp.toClassify) },
  secondId,
  'ignore'
);
ok(
  !normalizeToClassifyList(ignored.toClassify).some((i) => i.id === secondId),
  'ignore removes from toClassify'
);
ok((ignored.unsorted || []).length >= 1 || (ignored.classifiedIgnore || []).length >= 1, 'ignore retains text (not deleted)');

const profItem = normalizeToClassifyList([
  { id: 'tc-prof', text: 'Passionate about brand systems and editorial design.' },
])[0];
const prof = applyClassifyTarget({ ...emptyCVData(), toClassify: [profItem] }, profItem.id, 'profile');
ok(/brand systems/i.test(prof.summary || ''), 'classify → profile (summary)');

const toolItem = normalizeToClassifyList([{ id: 'tc-tool', text: 'Figma · After Effects' }])[0];
const tooled = applyClassifyTarget({ ...emptyCVData(), toClassify: [toolItem] }, toolItem.id, 'tool');
ok((tooled.tools || []).some((x) => /Figma/i.test(x)), 'classify → tools');

const exportable = ensureExportableCv(emptyCVData(), {
  cleanedText: 'Marie Dupont\nProduct designer with 8 years of experience.\n2020–2024 — Senior at BigCo',
});
ok(cvDataIsRenderable(exportable), 'ensureExportableCv always renderable with raw text');
ok(exportable._exportBlocked !== true, 'ensureExportableCv clears export block');

const fixture = readFileSync(join(root, 'tests/fixtures/consultant-cv/fixture.txt'), 'utf8').slice(0, 800);
const fromText = applySafeFallback(emptyCVData(), { cleanedText: fixture, rawText: fixture });
ok(fromText.toClassify?.length >= 0, 'fixture applySafeFallback runs');

console.log(failed ? `\n${failed} failed` : '\nqa-safe-fallback: all passed');
process.exit(failed ? 1 : 0);
