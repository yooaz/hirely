#!/usr/bin/env node
/**
 * Product suggestions — uncertain only, max 2, no CV duplicates or rewrite noise.
 */
import { sanitizeResumeForDisplay } from '../core/validation/sanitize-resume-display.js';
import { filterProductSuggestions } from '../core/parsing/suggestion-confidence-score.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

const resumeData = {
  identity: { name: 'Yohann Azancot', title: 'Graphic Designer & Illustrator' },
  summary: 'Creative professional specializing in illustration and graphic design.',
  experiences: [
    {
      role: 'Freelance Illustrator / Graphic Designer',
      company: 'Independent / Freelance',
      dates: '2011–2022',
      bullets: ['Posters, packaging, logos, editorial illustration.'],
    },
    {
      role: 'Designer',
      company: 'McCann G. Agency',
      dates: '2011–2014',
      bullets: ['Creative work for campaigns and brand assets.'],
    },
  ],
  education: ['LISAA — Web & Motion Design — 2011–2012'],
  skills: ['Illustration', 'Graphic Design', 'Packaging', 'Logo Design'],
  tools: ['Adobe Illustrator', 'Photoshop', 'InDesign'],
  languages: ['French — native', 'English — fluent'],
  clients: ['Nike'],
  unsorted: [
    'Created visual assets and illustrations for brands and publications.',
    'Illustration',
    'Graphic Design',
    'v38 A',
    '@ man visual communication',
    'visuel identity',
    'Mustrator RE scowboscc',
  ],
};

const sanitized = sanitizeResumeForDisplay(resumeData);
ok(
  !sanitized.unsorted.some((s) => /created visual assets/i.test(s)),
  'generic rewrite removed from unsorted'
);
ok(!sanitized.unsorted.includes('Illustration'), 'skill already in CV removed');
ok(sanitized.unsorted.length <= 2, `unsorted capped (${sanitized.unsorted.length})`);

const candidates = [
  { text: 'Created visual assets and illustrations for brands and publications.', category: 'experience' },
  { text: 'Illustration', category: 'skill' },
  { text: 'Graphic Design', category: 'skill' },
  { text: 'v38 A', category: 'skill' },
  { text: '@ man visual communication', category: 'education' },
  { text: 'visuel identity', category: 'skill' },
  { text: 'Mustrator RE scowboscc', category: 'skill' },
  {
    text: 'Branding and illustration for global fashion campaigns',
    category: 'skill',
    confidence: 85,
  },
];

const filtered = filterProductSuggestions(candidates, { maxVisible: 2, resumeData: sanitized });
ok(filtered.items.length <= 2, `visible max 2 (${filtered.items.length})`);
ok(
  filtered.items.every((it) => it.classification === 'LOW_CONFIDENCE'),
  'only uncertain suggestions visible'
);
ok(
  !filtered.items.some((it) => /created visual assets|illustration|graphic design/i.test(it.text)),
  'no rewrite noise or CV duplicates visible'
);
ok(!filtered.items.some((it) => /mustrator|v38/i.test(it.text)), 'no OCR garbage visible');
ok(filtered.items.length > 0, 'at least one actionable uncertain item when present');

const empty = filterProductSuggestions(
  [
    { text: 'Illustration', category: 'skill' },
    { text: 'Created visual assets and illustrations for brands.', category: 'experience' },
  ],
  { maxVisible: 2, resumeData: sanitized }
);
ok(empty.items.length === 0, 'all-noise input yields zero suggestions');

if (failed) {
  console.error(`\nqa-product-suggestions: ${failed} failure(s)\n`);
  process.exit(1);
}
console.log('\nqa-product-suggestions: all passed\n');
