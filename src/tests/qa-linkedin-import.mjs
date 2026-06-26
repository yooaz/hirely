#!/usr/bin/env node
/**
 * LinkedIn Import QA — detect, parse, merge, dedupe.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  LINKEDIN_IMPORT_ENGINE,
  mergeLinkedInSources,
  normalizeLinkedInImportSource,
  runLinkedInImportMerge,
  scoreResumeDataSource,
} from '../core/import/linkedin-import-engine.js';
import {
  detectLinkedInSource,
  LINKEDIN_SOURCE_TYPES,
} from '../core/import/linkedin-source-detect.js';
import {
  parseLinkedInExportText,
  resumeDataFromLinkedInExport,
} from '../core/import/linkedin-export-parser.js';
import { runHirelyImportFromText } from '../core/pipeline/hirely-import.js';
import { auditFinalResumeDuplicates } from '../core/validation/dedupe-final-resume.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

const LINKEDIN_EXPORT_JSON = `[
  {"First Name":"Marie","Last Name":"Dupont","Headline":"Senior Product Designer","Summary":"Product designer with 8 years in SaaS.","Location":"Paris, France","Email Address":"marie@example.com","Profile Url":"https://www.linkedin.com/in/mariedupont"}
]`;

const POSITIONS_JSON = `[
  {"Company Name":"Acme SaaS","Title":"Senior Product Designer","Started On":"Jan 2020","Finished On":"Present","Description":"Led design system\\nShipped onboarding flow"},
  {"Company Name":"Studio Nova","Title":"UI Designer","Started On":"Mar 2016","Finished On":"Dec 2019","Description":"Mobile app UI"}
]`;

const SKILLS_JSON = `[{"Name":"Figma"},{"Name":"Design Systems"},{"Name":"User Research"}]`;

const LINKEDIN_PDF_TEXT = `
Marie Dupont
Senior Product Designer
Paris, France
linkedin.com/in/mariedupont
Contact
Top Skills
Figma · Design Systems
Experience
Acme SaaS
Senior Product Designer
2020 – Present
`;

const RESUME_TEXT = `
Marie Dupont
Senior Product Designer
marie@example.com · +33 6 12 34 56 78
Paris

Summary
Product designer specializing in SaaS onboarding and design systems with measurable conversion lifts.

Experience
Senior Product Designer — Acme SaaS — 2020–Present
- Led design system used by 40+ engineers
- Increased onboarding completion by 18%

UI Designer — Studio Nova — 2016–2019
- Shipped mobile app redesign

Education
ENSAD — Design — 2012–2016

Skills
Figma, Design Systems, Prototyping, User Research
`;

async function main() {
  ok(LINKEDIN_IMPORT_ENGINE === 'LINKEDIN_IMPORT_V1', 'engine version');

  const liDetect = detectLinkedInSource({
    fileName: 'Profile.pdf',
    text: LINKEDIN_PDF_TEXT,
  });
  ok(liDetect.type === LINKEDIN_SOURCE_TYPES.linkedin_pdf, 'detect linkedin pdf');

  const exportDetect = detectLinkedInSource({
    fileName: 'Profile.json',
    text: LINKEDIN_EXPORT_JSON,
  });
  ok(exportDetect.type === LINKEDIN_SOURCE_TYPES.linkedin_export, 'detect linkedin export');

  const resumeDetect = detectLinkedInSource({
    fileName: 'cv.pdf',
    text: RESUME_TEXT,
  });
  ok(resumeDetect.type === LINKEDIN_SOURCE_TYPES.resume_pdf, 'detect resume pdf');

  const profileParsed = parseLinkedInExportText(LINKEDIN_EXPORT_JSON, 'Profile.json');
  ok(profileParsed?.profile, 'parse profile json');
  const positionsParsed = parseLinkedInExportText(POSITIONS_JSON, 'Positions.json');
  ok(positionsParsed?.positions?.length === 2, 'parse positions json');
  const skillsParsed = parseLinkedInExportText(SKILLS_JSON, 'Skills.json');
  ok(skillsParsed?.skills?.length === 3, 'parse skills json');

  const exportRd = resumeDataFromLinkedInExport({
    profile: profileParsed.profile,
    positions: positionsParsed.positions,
    skills: skillsParsed.skills,
    education: [],
    languages: [],
  });
  ok(exportRd.identity.name === 'Marie Dupont', 'export identity name');
  ok(exportRd.experiences.length === 2, 'export experiences');
  ok(exportRd.skills.length >= 3, 'export skills');

  const resumeImp = await runHirelyImportFromText(RESUME_TEXT, {
    source: 'resume-fixture',
    extractionMethod: 'paste',
  });
  const resumeRd = resumeImp.resumeData || resumeImp.cvData;

  const liSource = normalizeLinkedInImportSource({
    fileName: 'Profile.json',
    rawText: LINKEDIN_EXPORT_JSON,
    resumeData: exportRd,
  });
  ok(liSource.quality.composite > 40, 'linkedin export quality score');

  const resumeSource = normalizeLinkedInImportSource({
    fileName: 'resume.pdf',
    rawText: RESUME_TEXT,
    resumeData: resumeRd,
    sourceType: LINKEDIN_SOURCE_TYPES.resume_pdf,
  });
  ok(resumeSource.quality.composite > 40, 'resume quality score');

  const merged = mergeLinkedInSources([liSource, resumeSource]);
  ok(merged.resumeData.identity.email.includes('marie'), 'merge keeps email from best source');
  ok(merged.resumeData.experiences.length >= 2, 'merge keeps experiences');
  ok(merged.report.duplicates.length >= 0, 'duplicate report array');
  ok(merged.confidence > 0, 'merge confidence');
  ok(merged.report.winners.name || merged.report.winners.summary, 'field winners tracked');

  const dupeAudit = auditFinalResumeDuplicates(merged.resumeData);
  ok(dupeAudit.ok || dupeAudit.duplicates.length <= 2, 'final resume mostly deduped');

  const triple = runLinkedInImportMerge([
    { fileName: 'Profile.json', rawText: LINKEDIN_EXPORT_JSON, resumeData: exportRd },
    { fileName: 'linkedin-profile.pdf', rawText: LINKEDIN_PDF_TEXT, resumeData: exportRd },
    { fileName: 'resume.pdf', rawText: RESUME_TEXT, resumeData: resumeRd },
  ]);
  ok(triple.ready && triple.sources.length === 3, 'triple source merge');
  ok((triple.resumeData.skills || []).length >= 3, 'triple merge skills');

  const index = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  ok(index.includes('linkedin-import-panel.js'), 'UI script linked');
  ok(index.includes('linkedin-import.css'), 'UI css linked');
  ok(index.includes('handleLinkedInMultiImport') || index.includes('linkedinImportInput'), 'HTML wired');

  const devFixture = fs.readFileSync(
    path.join(ROOT, 'tests/fixtures/developer-cv/fixture.txt'),
    'utf8'
  );
  const devImp = await runHirelyImportFromText(devFixture, { source: 'developer-cv', extractionMethod: 'paste' });
  const devScore = scoreResumeDataSource(devImp.resumeData, {
    sourceType: LINKEDIN_SOURCE_TYPES.resume_pdf,
    fileName: 'developer.pdf',
  });
  ok(devScore.composite >= 35, `developer fixture source score (${devScore.composite})`);

  if (failed) {
    process.exitCode = 1;
    console.error(`\n${failed} LinkedIn import check(s) failed`);
  } else {
    console.log('\nAll LinkedIn import checks passed');
  }
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
