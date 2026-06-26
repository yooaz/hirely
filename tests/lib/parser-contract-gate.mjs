/**
 * Parser contract gate — cleaned text → structuredResume (parser only, no UI/OCR).
 */

import { readFileSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { runSectionEngineV2 } from '../../src/core/parsing/section-engine-v2.js';
import {
  qualifiesStrictExperience,
  lineIsSkillOrTagOnly,
  lineIsEducationData,
} from '../../src/core/parsing/experience-parser.js';
import { buildZeroTextLossAudit } from '../../src/core/parsing/zero-text-loss.js';
import {
  STRUCTURED_RESUME_JSON_MAX,
  slimStructuredResume,
  assertStrictStructuredResumeKeys,
} from '../../src/core/pipeline/pipeline-contract.js';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

const FORBIDDEN_TOP_KEYS = new Set([
  'metadata',
  'debug',
  'parserTrace',
  'forensic',
  'documentBlocks',
  'extractionLines',
  'needsReview',
  'nameCandidates',
  'titleCandidates',
  'identitySources',
  'unsortedArchive',
  'reviewQueue',
  'graph',
  '_resumeGraph',
  '_enterprise',
  '_sourceLines',
  '_parserReview',
  '_extractionReview',
  'rawExtraction',
  'cleanedText',
]);

const INVALID_EXP_ROLE_RE = /year\s*old|^\s*music\s*$|^\s*product design\s*$|créapole|creapole/i;

function isFakePhoneValue(value) {
  const p = String(value || '').trim();
  if (!p) return false;
  if (/^\s*(?:19|20)\d{2}\s*[-–—]\s*(?:\d{4}|present|présent|current|now|actuel)\s*$/i.test(p)) {
    return true;
  }
  if (/^\s*\d{4}\s+\d{4}\s*$/.test(p)) return true;
  const digits = p.replace(/\D/g, '');
  if (/^(19|20)\d{2}(19|20)?\d{2}$/.test(digits) && !/\+|\(/.test(p)) return true;
  return false;
}

function experienceHasDate(exp) {
  const start = String(exp?.startDate || '').trim();
  if (start.length >= 4) return true;
  const dates = String(exp?.dates || '').trim();
  return /\b(19|20)\d{2}\b/.test(`${start} ${dates}`);
}

function experienceHasRoleOrCompany(exp) {
  return Boolean(String(exp?.role || '').trim() || String(exp?.company || '').trim());
}

function collectForbiddenKeys(obj, prefix = '') {
  const hits = [];
  if (!obj || typeof obj !== 'object') return hits;
  for (const key of Object.keys(obj)) {
    const path = prefix ? `${prefix}.${key}` : key;
    if (FORBIDDEN_TOP_KEYS.has(key) || key.startsWith('_')) {
      hits.push(path);
    }
    if (obj[key] && typeof obj[key] === 'object' && !Array.isArray(obj[key]) && key === 'identity') {
      for (const ik of Object.keys(obj[key])) {
        if (ik.startsWith('_') || FORBIDDEN_TOP_KEYS.has(ik)) hits.push(`${path}.${ik}`);
      }
    }
  }
  return hits;
}

/**
 * Parse cleaned text only (no OCR / file extraction).
 * @param {string} cleanedText
 */
export function parseCleanedTextContract(cleanedText) {
  const cleaned = String(cleanedText || '').trim();
  return runSectionEngineV2(cleaned, {
    rawText: cleaned,
    extractionMethod: 'parser-contract',
    throwOnPipelineLoss: true,
  });
}

/**
 * @param {string} cleanedText
 * @param {object} engineResult
 */
export function validateParserContract(cleanedText, engineResult) {
  const failures = [];
  const cleaned = String(cleanedText || '').trim();
  const structured = engineResult?.structured;

  if (!structured || typeof structured !== 'object') {
    return {
      pass: false,
      failures: ['structuredResume missing'],
      metrics: null,
      slim: null,
    };
  }

  const slim = slimStructuredResume(structured, cleaned);
  const jsonLen = JSON.stringify(slim).length;

  if (jsonLen >= STRUCTURED_RESUME_JSON_MAX) {
    failures.push(`structuredResume JSON ${jsonLen} chars (max ${STRUCTURED_RESUME_JSON_MAX - 1})`);
  }

  const keyCheck = assertStrictStructuredResumeKeys(slim);
  if (!keyCheck.ok) {
    failures.push(`forbidden structuredResume keys: ${keyCheck.forbidden.join(', ')}`);
  }

  const nestedForbidden = collectForbiddenKeys(slim);
  if (nestedForbidden.length) {
    failures.push(`debug keys in structuredResume: ${nestedForbidden.join(', ')}`);
  }

  const audit =
    structured.metadata?.zeroTextLossAudit || buildZeroTextLossAudit(cleaned, structured);
  if (audit?.lossChars !== 0) {
    failures.push(`useful text lost (lossChars=${audit?.lossChars ?? 'unknown'})`);
  }

  const phone = slim.identity?.phone || '';
  if (phone && isFakePhoneValue(phone)) {
    failures.push(`date stored as phone: ${phone}`);
  }

  for (const exp of slim.experiences || []) {
    if (!experienceHasDate(exp)) {
      failures.push(`experience without date: ${exp.role || '?'} @ ${exp.company || '?'}`);
    }
    if (!experienceHasRoleOrCompany(exp)) {
      failures.push(`experience without role/company: ${JSON.stringify(exp).slice(0, 96)}`);
    }
    if (!qualifiesStrictExperience(exp)) {
      failures.push(
        `invalid experience kept (should be unsorted): ${exp.role || '?'} @ ${exp.company || '?'}`
      );
    }
    if (lineIsSkillOrTagOnly(exp.role) || INVALID_EXP_ROLE_RE.test(String(exp.role || ''))) {
      failures.push(`skill/tag used as role: ${exp.role}`);
    }
    if (lineIsEducationData(exp.company) || INVALID_EXP_ROLE_RE.test(String(exp.company || ''))) {
      failures.push(`school/skill used as company: ${exp.company}`);
    }
  }

  const unsortedBlob = (slim.unsorted || []).join('\n').toLowerCase();
  const rawLow = cleaned.toLowerCase();
  const garbageInInput =
    /\bmusic\b|\bcréapole\b|\bcreapole\b|year\s*old|product design/i.test(cleaned);
  if (garbageInInput) {
    const inExperiences = (slim.experiences || []).some((e) =>
      INVALID_EXP_ROLE_RE.test(`${e.role} ${e.company}`)
    );
    if (inExperiences) {
      failures.push('invalid experience not moved to unsorted');
    }
    const garbageLine = /\bmusic\b|\bcréapole\b|\bproduct design\b/i.test(rawLow);
    const inUnsorted =
      /\bmusic\b|\bcréapole\b|\bproduct design\b/i.test(unsortedBlob) ||
      (slim.experiences || []).length === 0;
    if (garbageLine && !inUnsorted && (slim.experiences || []).some((e) => /music|créapole/i.test(`${e.role} ${e.company}`))) {
      failures.push('garbage career line not in unsorted');
    }
  }

  return {
    pass: failures.length === 0,
    failures,
    metrics: {
      jsonChars: jsonLen,
      experienceCount: slim.experiences?.length ?? 0,
      educationCount: slim.education?.length ?? 0,
      skillsCount: (slim.skills?.length ?? 0) + (slim.tools?.length ?? 0),
      unsortedCount: slim.unsorted?.length ?? 0,
      lossChars: audit?.lossChars ?? null,
      coveragePercent: structured.metadata?.parserCoverage?.coveragePercent ?? null,
    },
    slim,
  };
}

/**
 * @param {object} caseDef
 * @param {string} [rootDir]
 */
export function runParserContractCase(caseDef, rootDir = root) {
  const fixturePath = join(rootDir, caseDef.fixture);
  if (!existsSync(fixturePath)) {
    return {
      id: caseDef.id,
      label: caseDef.label,
      pass: false,
      failures: [`fixture missing: ${caseDef.fixture}`],
      metrics: null,
    };
  }

  const cleaned = readFileSync(fixturePath, 'utf8').trim();
  if (!cleaned.length) {
    return {
      id: caseDef.id,
      label: caseDef.label,
      pass: false,
      failures: ['empty fixture'],
      metrics: null,
    };
  }

  let engineResult;
  try {
    engineResult = parseCleanedTextContract(cleaned);
  } catch (err) {
    return {
      id: caseDef.id,
      label: caseDef.label,
      fixture: caseDef.fixture,
      pass: false,
      failures: [`parser threw: ${err.message}`],
      metrics: null,
    };
  }

  const validation = validateParserContract(cleaned, engineResult);
  return {
    id: caseDef.id,
    label: caseDef.label,
    fixture: caseDef.fixture,
    pass: validation.pass,
    failures: validation.failures,
    metrics: validation.metrics,
  };
}

/**
 * @param {string} [manifestPath]
 * @param {string} [rootDir]
 */
export function runParserContractSuite(manifestPath, rootDir = root) {
  const path = manifestPath || join(rootDir, 'tests/parser-contract/manifest.json');
  const manifest = JSON.parse(readFileSync(path, 'utf8'));
  const cases = (manifest.cases || []).map((c) => runParserContractCase(c, rootDir));
  const failed = cases.filter((c) => !c.pass);

  return {
    pass: failed.length === 0,
    cases,
    summary: {
      total: cases.length,
      passed: cases.length - failed.length,
      failed: failed.length,
    },
  };
}
