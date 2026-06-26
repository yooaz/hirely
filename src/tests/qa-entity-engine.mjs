#!/usr/bin/env node
/**
 * Entity engine — scored recognition before section classification.
 */
import {
  resolveLineEntities,
  scoreEntityHit,
  pickPrimaryEntityHit,
  collectEntityHits,
  ENTITY_DICTIONARIES,
  ENTITY_TYPE_BOOST,
} from '../core/parsing/entity-engine.js';
import { classifyLineType } from '../core/parsing/block-line-classifier.js';

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const examples = [
  { line: 'Nike', entity: 'client', blockType: 'clients' },
  { line: 'Adobe', entity: 'client', blockType: 'clients' },
  { line: 'Marvel', entity: 'client', blockType: 'clients' },
  { line: 'Illustrator', entity: 'software', blockType: 'tools' },
  { line: 'Photoshop', entity: 'software', blockType: 'tools' },
  { line: 'LISAA', entity: 'school', blockType: 'education' },
  { line: 'Créapole', entity: 'school', blockType: 'education' },
  { line: 'LinkedIn', entity: 'social', blockType: 'contact' },
  { line: 'Instagram', entity: 'social', blockType: 'contact' },
];

for (const ex of examples) {
  const r = resolveLineEntities(ex.line);
  ok(r?.entity === ex.entity, `${ex.line} → ${ex.entity}`);
  ok(r?.blockType === ex.blockType, `${ex.line} → block ${ex.blockType}`);
  ok(r?.shouldClassify === true, `${ex.line} scores above threshold`);
  ok(r?.confidence >= 68, `${ex.line} confidence ${r?.confidence}`);
}

const lisaaDegree = resolveLineEntities('LISAA — Bachelor Design');
ok(lisaaDegree?.entity === 'school', 'LISAA beats Bachelor on same line');

const hits = collectEntityHits('LISAA — Bachelor Design');
const picked = pickPrimaryEntityHit(hits, 'LISAA — Bachelor Design');
ok(picked?.entity === 'school', 'pickPrimaryEntityHit prefers school');

ok(ENTITY_TYPE_BOOST.school >= ENTITY_TYPE_BOOST.degree, 'school boost >= degree boost');
ok(ENTITY_TYPE_BOOST.client === 30, 'client boost 30');
ok(ENTITY_DICTIONARIES.schools?.entities?.length >= 8, 'schools.json loaded');
ok(ENTITY_DICTIONARIES.degrees?.entities?.length >= 5, 'degrees.json loaded');

const classified = classifyLineType('Nike', null);
ok(classified.type === 'clients', 'classifyLineType uses entity engine for Nike');
ok(classified.signals?.includes('entity_before_section'), 'entity runs before section heuristics');

const adobeIllustrator = classifyLineType('Adobe Illustrator CC', 'tools');
ok(adobeIllustrator.type === 'tools', 'Adobe Illustrator → tools');

console.log(failed ? `\n${failed} FAILED` : '\nqa-entity-engine: PASS');
process.exit(failed ? 1 : 0);
