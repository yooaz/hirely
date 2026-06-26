#!/usr/bin/env node
/**
 * Entity dictionary recognition — canonical ids, not regex-only buckets.
 */
import { matchEntitiesInLine } from '../core/parsing/entity-resolver.js';
import { matchEntityInLine } from '../data/dictionaries/entity-catalog.js';
import {
  SCHOOL_RECOGNIZER,
  CLIENT_RECOGNIZER,
  SOFTWARE_RECOGNIZER,
  LANGUAGE_RECOGNIZER,
  SOCIAL_RECOGNIZER,
} from '../data/dictionaries/entity-catalog.js';
import schoolsData from '../data/dictionaries/schools.json' with { type: 'json' };
import socialsData from '../data/dictionaries/socials.json' with { type: 'json' };

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else console.log('OK', msg);
}

const cases = [
  { line: 'LISAA — Web & Motion Design', entity: 'school', id: 'lisaa', term: 'LISAA' },
  { line: 'Créapole — Visual Communication', entity: 'school', id: 'creapole', term: 'Créapole' },
  { line: 'Nike', entity: 'client', id: 'nike', term: 'Nike' },
  { line: 'Adobe', entity: 'client', id: 'adobe', term: 'Adobe' },
  { line: 'Illustrator', entity: 'software', id: 'illustrator', term: 'Illustrator' },
  { line: 'Photoshop', entity: 'software', id: 'photoshop', term: 'Photoshop' },
  { line: 'Marvel', entity: 'client', id: 'marvel', term: 'Marvel' },
  { line: 'French — native', entity: 'language', id: 'french', term: 'French' },
  { line: 'LinkedIn', entity: 'social', id: 'linkedin', term: 'LinkedIn' },
  { line: 'Instagram @yoaz', entity: 'social', id: 'instagram', term: 'Instagram' },
];

for (const c of cases) {
  const hit = matchEntitiesInLine(c.line);
  ok(hit?.entity === c.entity, `${c.term} → ${c.entity}`);
  ok(hit?.entityId === c.id, `${c.term} entity id ${c.id}`);
  ok(hit?.term === c.term || hit?.matched === c.term, `${c.term} canonical name`);
}

ok(schoolsData.entities?.length >= 8, 'schools.json has entities array');
ok(socialsData.entities?.some((e) => e.id === 'instagram'), 'socials.json has Instagram entity');

const adobeIllustrator = matchEntityInLine('Adobe Illustrator CC', SOFTWARE_RECOGNIZER);
ok(
  adobeIllustrator?.entityId === 'illustrator' || adobeIllustrator?.term === 'Illustrator',
  'longest software entity wins in Adobe Illustrator'
);

const lisaaRec = matchEntityInLine('studied at LISAA Paris', SCHOOL_RECOGNIZER);
ok(lisaaRec?.entityId === 'lisaa', 'alias LISAA Paris → lisaa');

process.exit(failed ? 1 : 0);
