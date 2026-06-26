#!/usr/bin/env node
import { repairResumeDataFromRaw } from '../core/parsing/import-repair.js';
import { NAME_UNCERTAIN_LABEL } from '../core/parsing/parser-recovery.js';

let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

const raw = `Designer Edition, Logos
2011-2022
Print, Logo, Vector, Art
Freelance Illustrator / Graphic Designer
Independent · 2011 — Present
Created work for Nike and Adobe.
yoaz@hotmail.fr · +33 6 49 43 48 39`;

const rd = repairResumeDataFromRaw(
  {
    identity: { name: NAME_UNCERTAIN_LABEL, title: 'designer edition, logos', phone: '2011-2022', email: '' },
    experiences: [],
    unsorted: ['Print, Logo, Vector'],
    meta: { warnings: [] },
  },
  { rawText: raw, cleanedText: raw }
);

ok(rd.identity.phone !== '2011-2022', 'date range removed from phone');
ok(rd.experiences.length > 0, 'experience repaired from raw');
ok(rd.identity.name !== NAME_UNCERTAIN_LABEL || rd.unsorted.length > 0, 'name or unsorted retained');

console.log(failed ? `\n${failed} failed` : '\nImport repair checks passed');
process.exit(failed ? 1 : 0);
