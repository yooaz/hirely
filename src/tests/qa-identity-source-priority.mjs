#!/usr/bin/env node
/**
 * P0 — Identity source priority (top15% → contact neighbor → largest header block → manual review).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  extractLockedIdentity,
  buildIdentityCandidateLines,
  buildForbiddenIdentityIndices,
  isOcrGarbageIdentityLine,
  isForbiddenIdentityLineIndex,
  IDENTITY_SOURCE_PRIORITY,
  IDENTITY_FIRST_PAGE_TOP_PCT,
  IDENTITY_CONFIDENCE_MIN,
  IDENTITY_SOURCE_PRIORITY_V1,
} from '../core/parsing/identity-extraction.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/identity-source-priority');
const REPORT_JSON = path.join(OUT_DIR, 'report.json');

let failed = 0;
const checks = [];

function record(id, pass, detail = '') {
  checks.push({ id, pass, detail });
  if (!pass) {
    failed++;
    console.error(`FAIL ${id}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`PASS ${id}`);
  }
}

const PRIORITY_TOP = [
  'wustrator snoutors illusthatch',
  'Yohann Azancot',
  'Graphic Designer & Illustrator',
  'yohann@example.com',
  '+33 6 49 43 48 39',
  'Paris',
  'Summary',
  'Brand and illustration work.',
  'Experience',
  'Designer — Lontac Impressions — Paris — 2019 – Present',
  'Education',
  'LISAA Paris — Bachelor — 2012',
  'Clients',
  'Chanel, Dior, Nike',
  'Page 2 / 2',
  'random footer ocr junk line',
];

const NEAR_EMAIL = [
  'Senior Art Director',
  'Marie Dubois',
  'marie@studio.fr',
  '+33 6 12 34 56 78',
  'Paris',
  'Experience',
  'Lead Designer — Publicis — 2018 – Present',
];

const LARGEST_HEADER = [
  'aa',
  'bb',
  'cc',
  'Julie Martin',
  'Freelance Illustrator',
  'Experience',
  'Designer — Acme Studio — 2020',
];

const NO_IDENTITY = [
  'Creative Professional',
  'contact@example.com',
  'Paris',
  'Experience',
  'Nike Inc — Lead Designer',
  'Education',
  'LISAA Paris — Bachelor',
  'Clients',
  'Chanel, Dior',
  'Page 2 / 2',
  'OCR footer garbage token',
];

record('constants_top15_pct', IDENTITY_FIRST_PAGE_TOP_PCT === 0.15);
record('constants_priority_order', IDENTITY_SOURCE_PRIORITY.top15pct < IDENTITY_SOURCE_PRIORITY.contact_neighbor);
record(
  'ocr_garbage_rejected',
  isOcrGarbageIdentityLine('wustrator snoutors illusthatch') &&
    !isOcrGarbageIdentityLine('Yohann Azancot')
);

const forbidden = buildForbiddenIdentityIndices(PRIORITY_TOP);
const expIdx = PRIORITY_TOP.findIndex((l) => /^experience/i.test(l));
const clientIdx = PRIORITY_TOP.findIndex((l) => /^clients/i.test(l));
record(
  'forbidden_experience_zone',
  expIdx >= 0 && isForbiddenIdentityLineIndex(expIdx + 1, forbidden),
  `expIdx=${expIdx}`
);
record(
  'forbidden_clients_zone',
  clientIdx >= 0 && isForbiddenIdentityLineIndex(clientIdx + 1, forbidden),
  `clientIdx=${clientIdx}`
);
record(
  'forbidden_footer_zone',
  isForbiddenIdentityLineIndex(PRIORITY_TOP.length - 1, forbidden)
);

const lockedTop = extractLockedIdentity(PRIORITY_TOP, {
  contact: { email: 'yohann@example.com', phone: '+33649434839' },
});
record(
  'priority_top15_name',
  lockedTop.name === 'Yohann Azancot',
  `name=${lockedTop.name} source=${lockedTop.nameSource?.reason}`
);
record(
  'priority_not_experience',
  !/lontac|impressions/i.test(lockedTop.name || ''),
  `name=${lockedTop.name}`
);
record(
  'priority_source_top15pct',
  lockedTop.nameSource?.reason === 'top15pct' || lockedTop.nameSource?.reason === 'largest_header_block',
  `reason=${lockedTop.nameSource?.reason}`
);
record(
  'priority_confidence_min',
  !lockedTop.name || lockedTop.nameConfidence >= IDENTITY_CONFIDENCE_MIN,
  `confidence=${lockedTop.nameConfidence}`
);

const lockedEmail = extractLockedIdentity(NEAR_EMAIL, {
  contact: { email: 'marie@studio.fr', phone: '+33612345678' },
});
record(
  'priority_contact_neighbor',
  lockedEmail.name === 'Marie Dubois',
  `name=${lockedEmail.name} reason=${lockedEmail.nameSource?.reason}`
);
record(
  'priority_not_publicis',
  !/publicis/i.test(lockedEmail.name || '')
);

const lockedLargest = extractLockedIdentity(LARGEST_HEADER, {
  firstPageLineCount: 20,
});
record(
  'priority_largest_header_block',
  lockedLargest.name === 'Julie Martin',
  `name=${lockedLargest.name} reason=${lockedLargest.nameSource?.reason}`
);

const lockedEmpty = extractLockedIdentity(NO_IDENTITY, {
  contact: { email: 'contact@example.com' },
});
record(
  'priority_manual_review_empty',
  !lockedEmpty.name,
  `name=${lockedEmpty.name || '(empty)'}`
);

const candidates = buildIdentityCandidateLines(PRIORITY_TOP, {
  contact: { email: 'yohann@example.com' },
});
const hasForbiddenCandidate = candidates.some((c) =>
  /lontac|chanel|lisaa|footer/i.test(c.line)
);
record('candidates_exclude_forbidden', !hasForbiddenCandidate);

const pass = failed === 0;
fs.mkdirSync(OUT_DIR, { recursive: true });
fs.writeFileSync(
  REPORT_JSON,
  JSON.stringify(
    {
      pass,
      version: IDENTITY_SOURCE_PRIORITY_V1,
      generatedAt: new Date().toISOString(),
      failed,
      checks,
      samples: {
        priorityTop: { name: lockedTop.name, source: lockedTop.nameSource?.reason },
        nearEmail: { name: lockedEmail.name, source: lockedEmail.nameSource?.reason },
        largestHeader: { name: lockedLargest.name, source: lockedLargest.nameSource?.reason },
        manualReview: { name: lockedEmpty.name || null },
      },
    },
    null,
    2
  )
);

console.log(`\n${pass ? 'PASS' : 'FAIL'} identity-source-priority (${checks.length - failed}/${checks.length})`);
process.exit(pass ? 0 : 1);
