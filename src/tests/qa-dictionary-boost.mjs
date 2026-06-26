#!/usr/bin/env node
/**
 * P0 dictionary JSON boosts — school +40, client +30, software +30.
 */
import {
  DICTIONARY_BOOST,
  classifyLineByDictionary,
  SCHOOL_TERMS,
  CLIENT_TERMS,
  TOOL_TERMS,
} from '../data/dictionaries/json-dictionary-match.js';
import { matchEntitiesInLine, ENTITY_BOOST } from '../core/parsing/entity-dictionaries.js';
import { classifyLineType } from '../core/parsing/block-line-classifier.js';
import schoolsData from '../data/dictionaries/schools.json' with { type: 'json' };
import clientsData from '../data/dictionaries/clients.json' with { type: 'json' };
import softwareData from '../data/dictionaries/software.json' with { type: 'json' };
import languagesData from '../data/dictionaries/languages.json' with { type: 'json' };

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

ok(DICTIONARY_BOOST.schools === 40, 'school boost +40');
ok(DICTIONARY_BOOST.clients === 30, 'client boost +30');
ok(DICTIONARY_BOOST.software === 30, 'software boost +30');
ok(ENTITY_BOOST.school === 40, 'ENTITY_BOOST school 40');
ok(ENTITY_BOOST.client === 30, 'ENTITY_BOOST client 30');
ok(ENTITY_BOOST.software === 30, 'ENTITY_BOOST software 30');

for (const school of ['LISAA', 'Créapole', 'ENSAD', 'Gobelins', 'Penninghen', 'ECV']) {
  ok(SCHOOL_TERMS.some((t) => t.toLowerCase() === school.toLowerCase()), `schools.json has ${school}`);
}

for (const client of [
  'Nike',
  'Adobe',
  'Converse',
  'Marvel',
  'Pantone',
  'Cadillac',
  'Louis Vuitton',
  'Apple',
  'Fortune',
]) {
  ok(CLIENT_TERMS.some((t) => t === client), `clients.json has ${client}`);
}

for (const tool of ['Illustrator', 'Photoshop', 'InDesign', 'After Effects', 'Figma', 'Procreate']) {
  ok(TOOL_TERMS.some((t) => t === tool), `software.json has ${tool}`);
}

const lisaa = matchEntitiesInLine('LISAA — Bachelor Design');
ok(lisaa?.entity === 'school' && lisaa.boost === 40, 'LISAA entity +40');

const nike = matchEntitiesInLine('Nike');
ok(nike?.entity === 'client' && nike.boost === 30, 'Nike client +30');

const ps = matchEntitiesInLine('Photoshop');
ok(ps?.entity === 'software' && ps.boost === 30, 'Photoshop software +30');

const dictLisaa = classifyLineByDictionary('Penninghen — Graphic Design');
ok(dictLisaa?.bucket === 'education' && dictLisaa.parserDebug.dictionaryBoost === 40, 'Penninghen dict education');

const lineNike = classifyLineType('Fortune', 'clients');
ok(lineNike.type === 'clients' && lineNike.confidence >= 70, 'Fortune → clients via boost');

ok(schoolsData.boost === 40, 'schools.json boost field');
ok(clientsData.boost === 30, 'clients.json boost field');
ok(softwareData.boost === 30, 'software.json boost field');
ok(languagesData.terms.includes('French'), 'languages.json has French');

process.exit(failed ? 1 : 0);
