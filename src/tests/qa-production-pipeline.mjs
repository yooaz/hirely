/**
 * 7-stage extraction pipeline — retention, sections, score, never-empty CV.
 */
import { readFileSync } from 'fs';
import { pathToFileURL } from 'url';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '../..');

async function loadPipeline() {
  const mod = await import(
    pathToFileURL(path.join(root, 'src/core/pipeline/production-pipeline.js')).href
  );
  return mod.runProductionExtractionPipeline;
}

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

const FIXTURE = `YOHANN ZANCOT
Senior Product Designer
yohann@example.com · +33 6 12 34 56 78 · Paris

SUMMARY
Product designer with 8+ years across Nike, Louis Vuitton, and Adobe Creative Cloud workflows.

EXPERIENCE
2020 – Present · Nike — Lead Designer
· Drove retail campaigns in Illustrator and Photoshop
2018 – 2020 · Converse — Designer
· Packaging and brand systems with Pantone standards

EDUCATION
LISAA — Bachelor Design
Créapole — Master Visual Communication

SKILLS
Figma, Illustrator, InDesign, Behance, Affinity Designer

CLIENTS
Marvel, Cadillac, PlayStation

LANGUAGES
French, English
`;

async function main() {
  const run = await loadPipeline();
  const creative = await run(FIXTURE, { extractionMethod: 'paste' });

  assert(
    creative.pipelineVersion === 'p0-layout' ||
      creative.pipelineVersion === 'block-v1' ||
      creative.pipelineVersion === 'p0',
    'pipeline version p0-layout'
  );
  assert(creative.stages?.document?.documentType, 'stage 1 document missing');
  assert(creative.stages?.layout?.layoutType, 'stage 2 layout missing');
  assert(creative.stages?.readingBlocks?.blockCount > 0, 'stage 2 reading blocks missing');
  assert(
    creative.stages?.documentBlocks?.documentBlocks?.length > 0,
    'stage 3 DocumentBlock[] missing'
  );
  assert(
    creative.structuredResume?.metadata?.neverRawParseCv === true,
    'pipeline must not use raw parseCV'
  );
  assert(creative.stages?.conflict, 'conflict resolver');
  assert(creative.stages?.score?.extractionScore > 0, 'extraction score');
  assert(creative.stages?.readingBlocks?.usedRawPdfOrder === false, 'must not use raw PDF order');
  assert(
    creative.extractionReport?.neverEmptyCv &&
      (creative.validatedCVData?.experience?.length ||
        creative.validatedCVData?.summary ||
        creative.validatedCVData?.name),
    'never-empty CV failed'
  );
  assert(creative.extractionReport?.rawLength > 100, 'extraction report raw length');
  assert(
    creative.retention.retentionPct >= 95,
    `retention below 95%: ${creative.retention.retentionPct}%`
  );
  assert(
    creative.structuredResume?.identity != null,
    'structuredResume.identity missing'
  );
  assert(Array.isArray(creative.structuredResume?.experiences), 'structuredResume.experiences');
  assert(
    creative.extractionReport.sectionsFound?.length >= 3,
    `sections found: ${creative.extractionReport.sectionsFound?.join(',')}`
  );

  const edu = creative.validatedCVData?.education || [];
  const exp = creative.validatedCVData?.experience || [];
  const clients = creative.validatedCVData?.clients || [];
  assert(edu.some((e) => /LISAA/i.test(String(e))), 'LISAA missing from education');
  assert(!edu.some((e) => /Nike/i.test(String(e))), 'Nike must not be in education');
  assert(exp.some((e) => /Nike/i.test(String(e))), 'Nike should be in experience');
  assert(clients.some((c) => /Marvel|PlayStation/i.test(String(c))), 'clients section populated');
  assert(
    !exp.some((e) => /LISAA|Créapole/i.test(String(e))),
    'schools must not leak into experience'
  );

  const anchors = creative.audit?.creativeDictionary?.anchors || [];
  const found = anchors.filter((a) => a.found).map((a) => a.term);
  for (const term of ['Nike', 'Adobe', 'LISAA', 'Behance']) {
    assert(found.some((f) => f.toLowerCase() === term.toLowerCase()), `anchor missing: ${term}`);
  }

  const yoazPath = path.join(root, 'tests/fixtures/yoaz-cv/fixture.txt');
  const yoaz = readFileSync(yoazPath, 'utf8');
  const yoazResult = await run(yoaz, { extractionMethod: 'paste' });
  assert(yoazResult.retention.retentionPct >= 40, 'yoaz retention');
  assert(yoazResult.extractionScore?.extractionScore >= 50, 'yoaz extraction score');

  console.log('qa-production-pipeline: PASS', {
    extractionScore: creative.extractionScore?.extractionScore,
    sections: creative.extractionReport.sectionsFound,
    layout: creative.layoutType,
    document: creative.documentType,
  });
}

main().catch((e) => {
  console.error('qa-production-pipeline: FAIL', e.message);
  process.exit(1);
});
