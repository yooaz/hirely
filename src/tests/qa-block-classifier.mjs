#!/usr/bin/env node
/**
 * Block classifier rules — schools/tools/clients never leak; unknown → unsorted route.
 */
import {
  classifyBlocks,
  enforceClassificationGuards,
  BLOCK_TYPES,
} from '../core/parsing/block-classifier.js';
import { buildStructuredResumeFromBlocks } from '../core/parsing/structured-resume-from-blocks.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const ALLOWED = new Set(BLOCK_TYPES);

ok(ALLOWED.size === 12, 'twelve allowed block types');
ok(ALLOWED.has('interests') && !ALLOWED.has('portfolio'), 'interests yes, portfolio no');

function blocksFromLines(lines, sectionHint = null) {
  return [
    {
      kind: 'content',
      text: lines.join('\n'),
      lines: lines.map((text, i) => ({ text, cleanedText: text, page: 1, line: i })),
      sectionHint,
      page: 1,
      bbox: { x: 0, y: 100, width: 400, height: 20 },
    },
  ];
}

const classified = classifyBlocks(
  [
    { kind: 'section_header', text: 'EXPERIENCE' },
    ...blocksFromLines(['LISAA — Bachelor Design']),
    { kind: 'section_header', text: 'CLIENTS' },
    ...blocksFromLines(['Marvel, Cadillac, Nike']),
    { kind: 'section_header', text: 'TOOLS' },
    ...blocksFromLines(['Illustrator, Photoshop, Figma']),
    ...blocksFromLines(['https://behance.net/yoaz']),
    { kind: 'section_header', text: 'PROJECTS' },
    ...blocksFromLines(['Personal project — Nike Air Max editorial']),
    ...blocksFromLines(['Random hobby line with no dictionary hit']),
  ],
  { rawText: 'fixture' }
);

function findType(text) {
  const b = classified.find((x) => String(x.text).includes(text));
  return b?.type;
}

ok(findType('LISAA') === 'education', 'school → education');
ok(findType('Marvel') === 'clients', 'client list → clients');
ok(findType('Illustrator') === 'tools', 'software → tools');
ok(findType('behance') === 'contact', 'portfolio link → contact');

const guarded = enforceClassificationGuards({
  type: 'experience',
  text: 'LISAA — Bachelor',
  confidence: 90,
  signals: [],
});
ok(guarded.type === 'education', 'guard: school never experience');

const toolGuard = enforceClassificationGuards({
  type: 'experience',
  text: 'Illustrator, InDesign',
  confidence: 90,
  signals: [],
});
ok(toolGuard.type === 'tools', 'guard: tools never experience');

const clientEdu = enforceClassificationGuards({
  type: 'education',
  text: 'Nike',
  confidence: 80,
  signals: [],
});
ok(clientEdu.type === 'clients', 'guard: clients never education');

const unknownBlock = classified.find((b) => /Random hobby/.test(b.text));
ok(unknownBlock?.type === 'unknown', 'unclassified → unknown');
ok(unknownBlock?.routeToUnsorted === true, 'unknown flagged for unsorted');

const resume = buildStructuredResumeFromBlocks(classified, {
  rawText: 'x',
  cleanedText: 'x',
});
ok(!resume.experiences.some((e) => /LISAA/i.test(String(e))), 'LISAA not in experience JSON');
ok(resume.education.some((e) => /LISAA/i.test(String(e))), 'LISAA in education');
ok(resume.clients.some((c) => /Marvel/i.test(String(c))), 'Marvel in clients');
ok(resume.tools.some((t) => /Illustrator/i.test(String(t))), 'Illustrator in tools');
ok(resume.unsorted.some((u) => /Random hobby/i.test(String(u))), 'unknown lines in unsorted');

process.exit(failed ? 1 : 0);
