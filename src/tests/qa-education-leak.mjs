/**
 * Education must never leak into experience (schools, degrees, years).
 */
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

const SCHOOL_LINES = [
  'LISAA',
  'LISAA — Bachelor Design',
  'Créapole — Master Visual Communication',
  'Gobelins — Animation',
  'ENSAD — Design',
  'ECV Paris',
  'Penninghen — Graphic Design',
  '2019 — LISAA — Bachelor Design',
  'Master — Créapole — 2021',
];

async function load() {
  const base = pathToFileURL(path.join(root, 'src/core/parsing')).href;
  return {
    edu: await import(`${base}/education-confidence.js`),
    sanity: await import(`${base}/section-sanity.js`),
    mapper: await import(`${base}/section-mapper.js`),
    pipeline: await import(
      pathToFileURL(path.join(root, 'src/core/pipeline/production-pipeline.js')).href
    ),
  };
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const { edu, sanity, mapper, pipeline } = await load();

  for (const line of SCHOOL_LINES) {
    const sc = edu.scoreEducationConfidence(line);
    assert(sc.schoolMatch, `no school match: ${line}`);
    assert(edu.mustNeverBeExperience(line), `must not be experience: ${line}`);
    assert(!sanity.passesExperienceGate(line), `experience gate open: ${line}`);
    assert(!sanity.scoreExperience(line), `scoreExperience: ${line}`);
    const c = sanity.classifyLineWithConfidence(line);
    assert(c.bucket === 'education', `${line} → ${c.bucket}, expected education`);
    if (sc.score > 60) assert(sc.forceEducation, `forceEducation false for ${line} score=${sc.score}`);
  }

  const cv = `EXPERIENCE
LISAA — Bachelor Design
Créapole — Master Visual Communication
2018 – 2020 · Converse — Designer

EDUCATION
Gobelins — Animation 2016
ENSAD — Design

SKILLS
Figma
`;

  const blocks = mapper.collectSectionsOrderAgnostic(cv);
  const expBlob = (blocks.experience || []).join('\n');
  assert(!/\bLISAA\b/i.test(expBlob), 'LISAA in experience bucket');
  assert(!/\bCréapole\b/i.test(expBlob), 'Créapole in experience bucket');
  assert(!/\bGobelins\b/i.test(expBlob), 'Gobelins in experience bucket');
  assert(blocks.education.some((l) => /LISAA|Gobelins|ENSAD/i.test(l)), 'schools missing from education');
  assert(blocks.experience.some((l) => /Converse/i.test(l)), 'Converse job should stay in experience');

  const run = pipeline.runProductionExtractionPipeline;
  const result = await run(cv, { extractionMethod: 'paste' });
  const exp = result.validatedCVData?.experience || [];
  const eduLines = result.validatedCVData?.education || [];
  const allExp = exp.join(' ');
  assert(!/\bLISAA\b/i.test(allExp), 'pipeline: LISAA in experience');
  assert(
    eduLines.some((e) => /LISAA|Créapole|Gobelins|ENSAD/i.test(String(e))),
    'pipeline: schools missing from education'
  );

  console.log('qa-education-leak: PASS');
}

main().catch((e) => {
  console.error('qa-education-leak: FAIL', e.message);
  process.exit(1);
});
