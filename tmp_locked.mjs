
import { readFileSync } from 'node:fs';
import { extractLockedIdentity } from './src/core/parsing/identity-extraction.js';
import { buildStructuredResumeFromBlocks } from './src/core/parsing/structured-resume-from-blocks.js';
const raw = readFileSync('./tests/fixtures/yoaz-cv/fixture.txt','utf8');
const allLines = raw.split(/\n/).map(s=>s.trim()).filter(Boolean);
const locked = extractLockedIdentity(allLines, {
  identityLines: [],
  contactLines: [],
  headerLines: allLines.slice(0,8),
  unsortedLines: [],
  toClassifyLines: [],
  reviewQueueLines: [],
  skillsLines: [],
  interestsLines: [],
  toolsLines: [],
  fileName: null,
  contact: {},
});
console.log(JSON.stringify(locked,null,2));
