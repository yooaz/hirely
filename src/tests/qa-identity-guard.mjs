#!/usr/bin/env node
/**
 * Identity guard — portfolio keywords must not become name/title.
 */
import { buildStructuredResumeFromBlocks } from '../core/parsing/structured-resume-from-blocks.js';
import { isBadTitleCandidate, NAME_UNCERTAIN_LABEL } from '../core/parsing/parser-recovery.js';
import { isValidIdentityName, isValidIdentityTitle } from '../core/parsing/identity-extraction.js';

let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

ok(isBadTitleCandidate('Print Logo Vector Art Reading'), 'keyword line is bad title');
ok(isBadTitleCandidate('Print, Logo, Vector, Art... Reading'), 'comma keyword line is bad title');
ok(!isValidIdentityName('Print Logo Vector Art Reading'), 'keyword cluster rejected as name');
ok(!isValidIdentityTitle('\\, Ben, GRAPHIC designer 3 ILLUSTHATCH'), 'OCR garbage rejected as title');

const skillIdentityBlocks = [
  {
    type: 'identity',
    text: 'Nature\nMusic\nPrint, Logo, Vector, Art... Reading\nIllustration, Graphic design',
    confidence: 90,
    accepted: true,
    lines: [
      { text: 'Nature', cleanedText: 'Nature' },
      { text: 'Music', cleanedText: 'Music' },
      { text: 'Print, Logo, Vector, Art... Reading', cleanedText: 'Print, Logo, Vector, Art... Reading' },
      { text: 'Illustration, Graphic design', cleanedText: 'Illustration, Graphic design' },
    ],
  },
  {
    type: 'experience',
    text: '2011-2022 : Freelance Illustrator / Graphic Designer',
    confidence: 85,
    accepted: true,
    lines: [{ text: '2011-2022 : Freelance Illustrator / Graphic Designer', cleanedText: '2011-2022 : Freelance Illustrator / Graphic Designer' }],
  },
];

const beforeFake = {
  identity: { name: 'Print Logo Vector Art Reading', title: '\\, Ben, GRAPHIC designer 3 ILLUSTHATCH' },
};

const structured = buildStructuredResumeFromBlocks(skillIdentityBlocks, {
  rawText: skillIdentityBlocks.map((b) => b.text).join('\n'),
  cleanedText: skillIdentityBlocks.map((b) => b.text).join('\n'),
});

console.log('BEFORE structuredResume.identity:', JSON.stringify(beforeFake.identity));
console.log('AFTER structuredResume.identity:', JSON.stringify(structured.identity));
console.log('AFTER identitySources:', JSON.stringify(structured.identitySources));

ok(!/print logo/i.test(structured.identity?.name || ''), 'identity.name not keyword line');
ok(structured.identity?.name === NAME_UNCERTAIN_LABEL || !structured.identity?.name, 'invalid name → Nom à confirmer');
ok(!/print logo/i.test(structured.identity?.title || ''), 'identity.title not keyword line');
ok(!/illusthatch/i.test(structured.identity?.title || ''), 'identity.title not OCR garbage');
ok((structured.interests || []).length >= 1, 'keywords routed to interests');

const yoazText = [
  'Yohann Azancot',
  'Graphic Designer & Illustrator',
  'yohann@example.com',
  '+33 6 12 34 56 78',
  'Skills',
  'Print Logo Vector Art Reading',
  'Photoshop Illustrator Indesign',
].join('\n');

const yoazStructured = buildStructuredResumeFromBlocks(
  [
    {
      type: 'contact',
      text: 'yohann@example.com\n+33 6 12 34 56 78',
      confidence: 92,
      accepted: true,
      lines: [
        { text: 'yohann@example.com', cleanedText: 'yohann@example.com' },
        { text: '+33 6 12 34 56 78', cleanedText: '+33 6 12 34 56 78' },
      ],
    },
    {
      type: 'skills',
      text: 'Print Logo Vector Art Reading\nPhotoshop Illustrator Indesign',
      confidence: 88,
      accepted: true,
      lines: [
        { text: 'Print Logo Vector Art Reading', cleanedText: 'Print Logo Vector Art Reading' },
        { text: 'Photoshop Illustrator Indesign', cleanedText: 'Photoshop Illustrator Indesign' },
      ],
    },
  ],
  { rawText: yoazText, cleanedText: yoazText }
);

ok(/yohann azancot/i.test(yoazStructured.identity?.name || ''), 'valid name from top-20 lines');
ok(/graphic designer/i.test(yoazStructured.identity?.title || ''), 'valid title from top-20 lines');
ok(!/print logo/i.test(yoazStructured.identity?.name || ''), 'skills block never becomes name');
ok(yoazStructured.identitySources?.name?.lineIndex === 0, 'name source line tracked');

process.exit(failed ? 1 : 0);
