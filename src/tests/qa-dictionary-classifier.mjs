/**
 * Dictionary-assisted parser classification — education / clients / tools never → experience.
 */
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

async function load() {
  const base = pathToFileURL(path.join(root, 'src/data/dictionaries/json-dictionary-match.js')).href;
  const sanity = pathToFileURL(path.join(root, 'src/core/parsing/section-sanity.js')).href;
  const mapper = pathToFileURL(path.join(root, 'src/core/parsing/section-mapper.js')).href;
  return {
    dict: await import(base),
    sanity: await import(sanity),
    mapper: await import(mapper),
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const CASES = [
  { line: 'LISAA — Bachelor Design', bucket: 'education', term: 'LISAA' },
  { line: 'Créapole — Master Visual Communication', bucket: 'education', term: 'Créapole' },
  { line: 'Nike', bucket: 'clients', term: 'Nike' },
  { line: 'Adobe', bucket: 'clients', term: 'Adobe' },
  { line: 'Illustrator', bucket: 'tools', term: 'Illustrator' },
  { line: 'Figma, Illustrator, Photoshop', bucket: 'tools', term: 'Illustrator' },
];

async function main() {
  const { dict, sanity, mapper } = await load();

  for (const c of CASES) {
    const hit = dict.classifyLineByDictionary(c.line);
    assert(hit, `no dict hit: ${c.line}`);
    assert(hit.bucket === c.bucket, `${c.line} → ${hit.bucket}, expected ${c.bucket}`);
    assert(
      hit.parserDebug.matchedTerm?.toLowerCase().includes(c.term.toLowerCase().slice(0, 4)),
      `term mismatch ${c.line}: ${hit.parserDebug.matchedTerm}`
    );
    assert(!sanity.passesExperienceGate(c.line), `experience gate open: ${c.line}`);
    const classified = sanity.classifyLineWithConfidence(c.line);
    assert(classified.bucket === c.bucket, `classified ${c.line} as ${classified.bucket}`);
    assert(
      classified.parserDebug?.classificationReason || classified.signals?.length,
      `missing debug for ${c.line}`
    );
  }

  const cv = `EXPERIENCE
2020 – Present · Nike — Lead Designer
· Campaign work in Illustrator

EDUCATION
LISAA — Bachelor Design

CLIENTS
Marvel, Cadillac

SKILLS
Figma, Photoshop

TOOLS
Illustrator, InDesign
`;

  const blocks = mapper.collectSectionsOrderAgnostic(cv);
  assert(!blocks.experience.some((l) => /LISAA/i.test(l)), 'LISAA in experience');
  assert(!blocks.experience.some((l) => /^Marvel/i.test(l)), 'Marvel in experience');
  assert(!blocks.skills.some((l) => /\bIllustrator\b/i.test(l) && !/Photoshop/i.test(l)), 'Illustrator only in skills');
  assert(blocks.education.some((l) => /LISAA/i.test(l)), 'LISAA missing from education');
  assert(blocks.clients.some((l) => /Marvel/i.test(l)), 'Marvel missing from clients');
  assert(blocks.tools.some((l) => /Illustrator/i.test(l)), 'Illustrator missing from tools');
  assert(blocks.experience.some((l) => /Nike/i.test(l) && /Designer/i.test(l)), 'Nike job missing from experience');

  console.log('qa-dictionary-classifier: PASS');
}

main().catch((e) => {
  console.error('qa-dictionary-classifier: FAIL', e.message);
  process.exit(1);
});
