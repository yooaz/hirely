/**
 * Universal parser gate — structure-based acceptance, no person-specific expectations.
 */

import { readFileSync, existsSync, readdirSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runUniversalParsePipeline } from '../../src/core/parsing/universal-parse-pipeline.js';
import {
  qualifiesStrictExperience,
  lineIsContactData,
} from '../../src/core/parsing/experience-parser.js';
import {
  STRUCTURED_RESUME_JSON_MAX,
  guardStructuredResumeSize,
} from '../../src/core/pipeline/pipeline-contract.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

const FORBIDDEN_PARSER_LITERALS = [
  'Yohann Azancot',
  'yoaz@hotmail',
  'parseMcCannBlock',
  'parseFreelancerBlock',
  'YOAZ_CV_DESIGNER',
  'experienceCountMin": 10',
];

const PARSER_SCAN_SKIP = new Set([
  'creative-entity-guard.js',
  'parser-recovery.js',
  'section-validation.js',
  'corruption-detector.js',
]);

const EMAIL_RE = /[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/;
const CAREER_RE =
  /\b(experience|employment|freelance|intern|consultant|manager|director|designer|engineer|analyst)\b/i;
const EDU_RE = /\b(education|university|école|school|bachelor|master|mba|phd|degree|formation)\b/i;
const SKILL_RE =
  /\b(skills?|tools?|python|javascript|excel|photoshop|figma|sql|aws|leadership)\b/i;

function unsortedBlob(structured) {
  const lines = [
    ...(structured?.unsorted || []),
    ...(structured?.unsortedArchive || []).map((x) => (typeof x === 'string' ? x : x?.text || '')),
  ];
  return lines.join('\n').toLowerCase();
}

function hasIdentityOrContact(structured, raw) {
  const id = structured?.identity || {};
  if (String(id.name || '').trim().length >= 2) return true;
  if (EMAIL_RE.test(String(id.email || ''))) return true;
  if (PHONE_RE.test(String(id.phone || ''))) return true;
  const blob = `${unsortedBlob(structured)}\n${String(raw || '').toLowerCase()}`;
  if (EMAIL_RE.test(blob)) return true;
  if (PHONE_RE.test(blob) && !/\b(19|20)\d{2}\s*[-–]/.test(blob)) return true;
  return false;
}

function hasExperienceOrUnsorted(structured) {
  const exps = structured?.experiences || [];
  if (exps.length > 0) return true;
  const blob = unsortedBlob(structured);
  return CAREER_RE.test(blob) || /\b(19|20)\d{2}\b/.test(blob);
}

function hasEducationOrUnsorted(structured) {
  const edu = structured?.education || [];
  if (edu.length > 0) return true;
  return EDU_RE.test(unsortedBlob(structured));
}

function hasSkillsOrUnsorted(structured) {
  const skills = structured?.skills || [];
  const tools = structured?.tools || [];
  if (skills.length + tools.length > 0) return true;
  return SKILL_RE.test(unsortedBlob(structured));
}

function experienceDateLooksLikePhone(exp) {
  const d = `${exp.startDate || ''} ${exp.endDate || ''} ${exp.dates || ''}`;
  if (!d.trim()) return false;
  return lineIsContactData(d) && !/\b(19|20)\d{2}\b/.test(d);
}

function experienceLooksHallucinated(exp) {
  const company = String(exp?.company || '').trim();
  const role = String(exp?.role || '').trim();
  if (company.startsWith('- ') || company.startsWith('• ')) return true;
  if (company.length > 72 || role.length > 120) return true;
  if (!qualifiesStrictExperience(exp)) return true;
  return false;
}

function strictExperiencesValid(structured) {
  const failures = [];
  for (const exp of structured?.experiences || []) {
    if (experienceLooksHallucinated(exp)) {
      failures.push(`weak experience: ${exp.role || '?'} @ ${exp.company || '?'}`);
    }
    if (experienceDateLooksLikePhone(exp)) {
      failures.push(`date looks like phone: ${exp.dates || exp.startDate}`);
    }
  }
  return failures;
}

/**
 * Fail if parser source contains person-specific hardcoded expectations.
 * @param {string} [rootDir]
 */
export function scanParserHardcodeViolations(rootDir = root) {
  const parsingDir = join(rootDir, 'src/core/parsing');
  const violations = [];
  const files = readdirSync(parsingDir).filter((f) => f.endsWith('.js') && !PARSER_SCAN_SKIP.has(f));

  for (const file of files) {
    const content = readFileSync(join(parsingDir, file), 'utf8');
    for (const literal of FORBIDDEN_PARSER_LITERALS) {
      if (content.includes(literal)) {
        violations.push(`${file}: contains forbidden "${literal}"`);
      }
    }
  }

  const expectationsPath = join(rootDir, 'tests/golden/cv-expectations.json');
  if (existsSync(expectationsPath)) {
    const expJson = readFileSync(expectationsPath, 'utf8');
    if (/"name"\s*:\s*"/.test(expJson) && !/"name"\s*:\s*""/.test(expJson)) {
      if (/Yohann|Yoaz/i.test(expJson)) {
        violations.push('cv-expectations.json: person-specific name expectation');
      }
    }
    if (/experienceCountMin":\s*1[0-9]/.test(expJson)) {
      violations.push('cv-expectations.json: file-specific experience count bar');
    }
  }

  return violations;
}

/**
 * @param {object} caseDef
 * @param {string} [rootDir]
 */
export async function runUniversalGoldenCase(caseDef, rootDir = root) {
  const fixturePath = join(rootDir, caseDef.fixture);
  if (!existsSync(fixturePath)) {
    return {
      id: caseDef.id,
      category: caseDef.category,
      pass: false,
      failures: [`fixture missing: ${caseDef.fixture}`],
      metrics: null,
    };
  }

  const raw = readFileSync(fixturePath, 'utf8').trim();
  const failures = [];

  if (!raw.length) {
    return {
      id: caseDef.id,
      category: caseDef.category,
      pass: false,
      failures: ['empty fixture'],
      metrics: null,
    };
  }

  const result = await runUniversalParsePipeline(raw, {
    extractionMethod: caseDef.category === 'paste' ? 'paste' : 'fixture',
    useAi: false,
    throwOnPipelineLoss: true,
  });

  let structured = result.structured;
  const sizeGuard = guardStructuredResumeSize(structured, raw);
  structured = sizeGuard.resume;
  const audit = result.zeroTextLossAudit || structured?.metadata?.zeroTextLossAudit;

  const metrics = {
    rawChars: audit?.rawChars ?? raw.length,
    structuredChars: audit?.structuredChars ?? 0,
    archivedChars: audit?.archivedChars ?? 0,
    lossChars: audit?.lossChars ?? -1,
    experienceCount: structured?.experiences?.length ?? 0,
    educationCount: structured?.education?.length ?? 0,
    skillsCount: (structured?.skills?.length ?? 0) + (structured?.tools?.length ?? 0),
    unsortedCount: structured?.unsorted?.length ?? 0,
    coveragePercent: structured?.metadata?.parserCoverage?.coveragePercent ?? null,
  };

  if (!hasIdentityOrContact(structured, raw)) {
    failures.push('no identity/contact and none in unsorted');
  }
  if (!hasExperienceOrUnsorted(structured)) {
    failures.push('no experience and no career text in unsorted');
  }
  if (!hasEducationOrUnsorted(structured)) {
    failures.push('no education and no education signals in unsorted');
  }
  if (!hasSkillsOrUnsorted(structured)) {
    failures.push('no skills/tools and none in unsorted');
  }

  failures.push(...strictExperiencesValid(structured));

  if (audit && audit.lossChars !== 0) {
    failures.push(`lossChars=${audit.lossChars} (expected 0)`);
  }

  const jsonLen = JSON.stringify(structured).length;
  if (jsonLen > STRUCTURED_RESUME_JSON_MAX) {
    failures.push(`structured JSON ${jsonLen} > ${STRUCTURED_RESUME_JSON_MAX}`);
  }
  return {
    id: caseDef.id,
    category: caseDef.category,
    fixture: caseDef.fixture,
    pass: failures.length === 0,
    failures,
    metrics,
  };
}

/**
 * @param {string} [manifestPath]
 * @param {string} [rootDir]
 */
export async function runUniversalGoldenSuite(manifestPath, rootDir = root) {
  const path = manifestPath || join(rootDir, 'tests/golden-resumes/manifest.json');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  const hardcode = scanParserHardcodeViolations(rootDir);
  const caseResults = [];

  for (const caseDef of manifest.cases || []) {
    caseResults.push(await runUniversalGoldenCase(caseDef, rootDir));
  }

  const failedCases = caseResults.filter((r) => !r.pass);
  const pass = hardcode.length === 0 && failedCases.length === 0;

  return {
    pass,
    hardcodeViolations: hardcode,
    cases: caseResults,
    summary: {
      total: caseResults.length,
      passed: caseResults.length - failedCases.length,
      failed: failedCases.length,
    },
  };
}
