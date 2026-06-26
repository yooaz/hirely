#!/usr/bin/env node
/**
 * Extraction pipeline regression tests (core/extraction.js).
 */
import { loadHirelyParse } from './load-hirely-parse.mjs';
import { isBadTitleCandidate } from '../core/parsing/parser-recovery.js';
import { partitionSkillsAndInterests } from '../core/parsing/line-cleaner.js';

const SAMPLE_CV = `Yohann Azancot
Graphic Designer & Illustrator
yoaz@hotmail.fr · +33 6 49 43 48 39 · Portfolio · LinkedIn

Profile
Creative professional specializing in illustration, graphic design and visual storytelling, with experience delivering posters, packaging, identities and visual assets for cultural and commercial projects.

Experience
Freelance Illustrator / Graphic Designer
Independent / Freelance · 2011 — Present
- Created high-impact illustration and graphic design work across posters, packaging, logos and brand assets.
- Collaborated with recognized brands and cultural clients including Nike, Louis Vuitton, Marvel, Cadillac, Fortune, Converse, Pantone, Adobe, Arte and McCann.

Education
LISAA — Web & Motion Design
Créapole — Visual Communication / Product Design

Skills
Illustration, Graphic Design, Visual Identity, Poster Design, Packaging, Logo Design, Art Direction, Print Production

Tools
Photoshop, Illustrator, InDesign, Adobe Creative Suite

Languages
French — native
English — fluent`;

const MINIMAL_CV = `Marie Dupont
Product Manager
marie.dupont@email.com
+33 6 12 34 56 78
Paris, France

Summary
Product manager with 8 years in B2B SaaS, focused on roadmap delivery and cross-functional leadership.

Experience
Senior Product Manager — Acme SaaS — 2019 – Present
- Shipped billing module used by 120k users.
- Reduced churn by 12% through onboarding redesign.

Education
HEC Paris — MBA 2018

Skills
Product strategy, Agile, SQL, User research`;

function assert(cond, msg) {
  if (!cond) throw new Error(msg);
}

async function main() {
  const Parse = await loadHirelyParse();
  if (!Parse?.runExtractionPipeline) {
    console.error('HirelyParse not exported');
    process.exit(1);
  }

  const sample = await Parse.runExtractionPipeline(SAMPLE_CV, { trusted: true });
  assert(sample.canGenerate, 'sample CV must be generatable');
  const sampleName = sample.validatedCVData?.name || '';
  const sampleNameOk =
    sampleName === 'Yohann Azancot' ||
    /yohann/i.test(sampleName) ||
    (sample.structuredResume?.nameCandidates || []).some((c) => /yohann/i.test(c));
  assert(sampleNameOk, `name: ${sampleName}`);
  assert(/yoaz@hotmail\.fr/i.test(sample.validatedCVData?.email || ''), 'email missing');
  assert(sample.validatedCVData.experience.length >= 1, 'experience empty');
  assert(sample.validatedCVData.skills.length >= 3, 'skills empty');
  assert(sample.assessment.quality !== 'bad', 'sample should not be bad quality');
  console.log('OK sample CV extraction');

  const minimal = await Parse.runExtractionPipeline(MINIMAL_CV);
  assert(minimal.validation.data.email, 'minimal email');
  assert(minimal.validation.data.experience.length >= 1, 'minimal experience');
  assert(minimal.parseConfidence >= 42, `minimal confidence ${minimal.parseConfidence}`);
  console.log('OK minimal structured CV');

  const cleaned = Parse.cleanExtraction('  OCR   \n\n  Yohann   Azancot  \n\n  EXPERIENCE  \n  Designer  2020-2024  ');
  assert(!/\s{3,}/.test(cleaned.split('\n')[0] || ''), 'cleanExtraction normalizes whitespace');
  const ocr = await Parse.runExtractionPipeline(cleaned);
  assert(ocr.cleanedText.length > 20, 'short OCR text cleaned');
  console.log('OK cleanExtraction');

  const noHeaders = await Parse.runExtractionPipeline(MINIMAL_CV.replace(/^Summary\n/m, '').replace(/^Experience\n/m, ''));
  assert(noHeaders.validation.data.experience.length >= 1, 'CV without headers should still find experience');
  console.log('OK fallback section detection');

  assert(Parse.headerKeyForLine('Contact') === 'contact', 'Contact header must map to contact');
  assert(Parse.headerKeyForLine('Contact details') === 'contact', 'Contact details must map to contact');
  assert(Parse.headerKeyForLine('Location') === 'location', 'Location header must map to location');
  assert(Parse.headerKeyForLine('Address') === 'location', 'Address header must map to location');
  assert(Parse.headerKeyForLine('Contact') !== 'location', 'Contact must not map to location');
  const contactSections = Parse.detectSections('Contact\nyoaz@hotmail.fr\n+33 6 49 43 48 39\n\nExperience\nDesigner 2020-2024');
  assert((contactSections.contact || []).length >= 1, 'contact section should capture contact block');
  assert(!(contactSections.location || []).some((l) => /@/.test(l)), 'location block must not absorb email lines');
  console.log('OK contact vs location headers');

  const emailClean = Parse.cleanExtraction('Reach me at yoaz@hotmail.fr for work.');
  assert(/yoaz@hotmail\.fr/i.test(emailClean), 'email .fr must survive cleanExtraction');
  const emailPipe = await Parse.runExtractionPipeline(SAMPLE_CV, { trusted: true });
  assert(/yoaz@hotmail\.fr/i.test(emailPipe.validatedCVData?.email || ''), 'email .fr in pipeline');
  console.log('OK email .fr preservation');

  const phonePipe = await Parse.runExtractionPipeline(MINIMAL_CV);
  assert(phonePipe.validation.data.phone, `phone missing: ${phonePipe.validation.data.phone}`);
  console.log('OK phone detection');

  const brandHeaderCv = `Nike · Adobe · Marvel
Graphic Designer
yoaz@hotmail.fr

Experience
Freelance Designer 2015 — Present
- Brand work for global clients.`;
  const brandPipe = await Parse.runExtractionPipeline(brandHeaderCv);
  assert(!brandPipe.validation.data.name || !/nike/i.test(brandPipe.validation.data.name), 'brand list must not become name');
  console.log('OK clients not becoming name');

  assert(Parse.lineLooksLikeTitle('Graphic Designer & Illustrator'), 'title: designer & illustrator');
  assert(Parse.lineLooksLikeTitle('Senior Product Designer'), 'title: senior product designer');
  assert(Parse.lineLooksLikeTitle('Art Director'), 'title: art director');
  assert(Parse.lineLooksLikeTitle('Creative Director'), 'title: creative director');
  const titleCv = `Alex Martin
Freelance Illustrator
alex@example.com

Skills
Drawing`;
  const titlePipe = await Parse.runExtractionPipeline(titleCv);
  assert(/illustrator/i.test(titlePipe.validation.data.title || ''), `title after name: ${titlePipe.validation.data.title}`);
  console.log('OK name + title detection');

  const skillItems = Parse.splitListItems(
    'Illustration, Graphic Design, Art Direction, Print Production, Web / Motion Design'
  );
  assert(skillItems.includes('Art Direction'), 'Art Direction must stay whole');
  assert(skillItems.includes('Print Production'), 'Print Production must stay whole');
  assert(skillItems.some((s) => /Web\s*\/\s*Motion Design/i.test(s)), 'Web / Motion Design should remain readable');
  assert(!skillItems.some((s) => s.length === 1), 'no 1-letter skill tokens');
  assert(!skillItems.includes('Motion'), 'must not split Web / Motion Design on slash');
  const skillsPipe = await Parse.runExtractionPipeline(SAMPLE_CV, { trusted: true });
  assert(skillsPipe.validatedCVData.skills.some((s) => /art direction/i.test(s)), 'pipeline keeps Art Direction skill');
  console.log('OK skills list splitting');

  const pdfItems = [
    { x: 48, y: 720, s: 'Marie Dupont' },
    { x: 48, y: 700, s: 'Product Manager' },
    { x: 48, y: 660, s: 'Experience' },
    { x: 48, y: 640, s: 'Senior PM at Acme' },
    { x: 320, y: 720, s: 'marie.dupont@email.com' },
    { x: 320, y: 700, s: 'Paris, France' },
    { x: 320, y: 680, s: '+33 6 12 34 56 78' },
  ];
  const pdfText = Parse.buildPdfPageText(pdfItems);
  const pdfLines = pdfText.split('\n').map((l) => l.trim()).filter(Boolean);
  assert(pdfLines[0] === 'Marie Dupont', 'pdf column: name first line');
  assert(pdfLines.includes('Product Manager'), 'pdf column: title present on its own line');
  assert(pdfLines.includes('marie.dupont@email.com'), 'pdf column: sidebar email on separate line');
  const marieIdx = pdfLines.indexOf('Marie Dupont');
  const emailIdx = pdfLines.indexOf('marie.dupont@email.com');
  const titleIdx = pdfLines.indexOf('Product Manager');
  assert(emailIdx > marieIdx, 'pdf: sidebar email after main name row');
  assert(titleIdx > marieIdx, 'pdf: title after name');
  assert(!pdfLines.some((l) => /Marie Dupont.*marie\.dupont@email\.com/i.test(l)), 'pdf: must not merge sidebar into main line');
  assert(!pdfLines.some((l) => /Product Manager.*Paris/i.test(l) && /marie/i.test(l)), 'pdf: must not merge unrelated columns');
  console.log('OK pdf two-column line order');

  const longPaste = MINIMAL_CV + '\n\n' + 'Additional context about product delivery, stakeholder management, roadmap planning, and cross-functional leadership across multiple teams. '.repeat(6);
  const lenient = await Parse.runExtractionPipeline(longPaste);
  assert(lenient.canGenerate || lenient.lenientGenerate, 'long paste should allow generation');
  const built = lenient.validatedCVData;
  assert(built && (built.name || built.experience.length || built.summary), 'lenient pipeline must produce cvData');
  console.log('OK lenient generation (80+ words)');

  assert(isBadTitleCandidate('A Mail: visual communication'), 'reject OCR title fragment');
  assert(!isBadTitleCandidate('Graphic Designer & Illustrator'), 'accept real title');
  const part = partitionSkillsAndInterests(['Illustration', 'Movies', 'Reading', 'Nature']);
  assert(part.interests.includes('Movies') && part.interests.includes('Reading'), 'interests partitioned');
  assert(!part.skills.includes('Movies'), 'interests not in skills');
  const yoazEdu = sample.structuredResume?.education || sample.validatedCVData?.education || [];
  assert(yoazEdu.some((e) => /LISAA/i.test(e)), 'sample must retain LISAA education');
  assert(sample.audit?.parserDetection?.name, 'parser detection summary present');
  assert(Array.isArray(sample.audit?.parserDetection?.titleCandidates), 'title candidates in detection');

  const pdfTextRun = await Parse.runExtractionPipeline(SAMPLE_CV, {
    extractionMethod: 'pdf-text',
    pdfExtraction: {
      method: 'pdf-text',
      decision: 'pdf-text',
      why: 'Selectable text layer (test)',
      charCount: SAMPLE_CV.length,
      wordCount: 120,
      confidence: 95,
      firstPageHeaderLines: ['Yohann Azancot', 'Graphic Designer & Illustrator', 'yoaz@hotmail.fr'],
    },
  });
  assert(pdfTextRun.audit?.pdfExtraction?.method === 'pdf-text', 'pdf extraction meta on audit');
  assert(
    /yohann/i.test(pdfTextRun.audit?.parserDetection?.selectedName || pdfTextRun.validatedCVData?.name || ''),
    'pdf header boosts name selection'
  );
  console.log('OK parser recovery (title, interests, education, detection)');
  console.log('OK pdf-text identity path');

  const { postProcessOcrText } = await import('../core/parsing/ocr-postprocess.js');
  const ocrFixed = postProcessOcrText('EXPÉRlENCE\nPhotosh0p designer', { ocr: true });
  assert(ocrFixed.includes('Photoshop'), 'OCR post-process spell hints');
  assert(/EXPÉRIENCE/.test(ocrFixed), 'OCR post-process section headers');
  console.log('OK OCR post-process');

  process.exit(0);
}

try {
  await main();
} catch (e) {
  console.error('FAIL extraction:', e.message);
  process.exit(1);
}
