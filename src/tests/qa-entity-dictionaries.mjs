#!/usr/bin/env node
/**
 * Entity dictionaries — entries, boosts, debug explanations.
 */
import schoolsData from '../data/dictionaries/schools.json' with { type: 'json' };
import clientsData from '../data/dictionaries/clients.json' with { type: 'json' };
import softwareData from '../data/dictionaries/software.json' with { type: 'json' };
import languagesData from '../data/dictionaries/languages.json' with { type: 'json' };
import creativeRolesData from '../data/dictionaries/creative_roles.json' with { type: 'json' };
import { classifyLineByDictionary, DICTIONARY_BOOST } from '../data/dictionaries/json-dictionary-match.js';
import { matchEntitiesInLine } from '../core/parsing/entity-dictionaries.js';
import {
  formatDictionaryExplanation,
  isParserClassificationDebugEnabled,
  getParserClassificationLog,
  clearParserClassificationLog,
} from '../core/parsing/parser-classification-debug.js';
import { classifyBlocks } from '../core/parsing/block-classifier.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const SCHOOLS = ['LISAA', 'Créapole', 'Gobelins', 'ENSAD', 'Penninghen', 'ECV'];
const TOOLS = ['Photoshop', 'Illustrator', 'InDesign', 'After Effects', 'Figma', 'Procreate', 'Affinity Designer'];
const ROLES = ['Graphic Designer', 'Illustrator', 'Art Director', 'Creative Director', 'Motion Designer', 'Product Designer'];

for (const s of SCHOOLS) {
  ok(schoolsData.entities.some((e) => e.name === s || (e.aliases || []).includes(s)), `schools.json: ${s}`);
}
for (const t of TOOLS) {
  ok(
    softwareData.entities.some((e) => e.name === t || (e.aliases || []).includes(t)),
    `software.json: ${t}`
  );
}
for (const r of ROLES) {
  ok(
    creativeRolesData.entities.some((e) => e.name === r || (e.aliases || []).includes(r)),
    `creative_roles.json: ${r}`
  );
}

ok(DICTIONARY_BOOST.schools === 40, 'school boost 40');
ok(DICTIONARY_BOOST.software === 30, 'software boost 30');
ok(DICTIONARY_BOOST.creative_roles === 25, 'role boost 25');

const lisaaDict = classifyLineByDictionary('LISAA — Bachelor Design');
ok(lisaaDict?.bucket === 'education' && lisaaDict.confidence >= 90, 'LISAA dict confidence');
ok(lisaaDict.parserDebug?.matchedDictionary === 'schools', 'LISAA debug dictionary id');
ok(lisaaDict.parserDebug?.matchedTerm, 'LISAA debug term');

const aff = classifyLineByDictionary('Affinity Designer, Figma');
ok(aff?.bucket === 'tools' && aff.parserDebug?.matchedDictionary === 'software', 'Affinity → tools');

const expl = formatDictionaryExplanation({
  classificationReason: 'school_entity_match',
  matchedDictionary: 'schools',
  matchedTerm: 'LISAA',
  dictionaryBoost: 40,
  bucket: 'education',
  confidenceScore: 98,
});
ok(expl.includes('schools') && expl.includes('LISAA') && expl.includes('+40'), 'debug explanation format');

globalThis.HIRELY_PARSER_CLASSIFICATION_DEBUG = true;
clearParserClassificationLog();
classifyBlocks(
  [
    { kind: 'section_header', text: 'EDUCATION' },
    {
      kind: 'content',
      text: 'Créapole — Master',
      lines: [{ text: 'Créapole — Master', cleanedText: 'Créapole — Master', page: 1 }],
    },
  ],
  { rawText: 'test' }
);
const log = getParserClassificationLog();
ok(log.length >= 1, 'debug log records classifications');
ok(log.some((r) => r.explanation && r.matchedDictionary), 'debug log has dictionary explanation');
globalThis.HIRELY_PARSER_CLASSIFICATION_DEBUG = false;

const nike = matchEntitiesInLine('Nike');
ok(nike?.entity === 'client' && nike.boost === 30, 'Nike entity client +30');

process.exit(failed ? 1 : 0);
