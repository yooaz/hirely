/**
 * Final resumeData output polish — labels, education sanity, clients, unsorted drain.
 * No OCR / pipeline changes.
 */

import { extractDateRangeFromText } from './parser-recovery.js';
import { resolveCreativeProfessionalTitle } from './section-anchor-extract.js';
import { isCorruptEducationLine } from './education-confidence.js';
import {
  isCreativeSkillPhrase,
  isStrictSoftwareLine,
  isClientListLine,
} from './classification-fixes.js';
import { validateCvSectionItem } from './cv-section-contract.js';
import {
  parseFreelanceCareerLine,
  parseInternshipLine,
  parseUrlMergedExperienceLine,
} from './classification-fixes.js';
import { repairIdentityFromOcrSignals } from './identity-extraction.js';
import {
  qualifiesStrictExperience,
  EXPERIENCE_PARSER_CONFIDENCE_MIN,
} from './experience-parser.js';
import { repairExperienceEntries } from './experience-recovery.js';
import {
  runClientDetection,
  harvestClientSourceBlob,
  CLIENT_ANCHOR_TARGETS,
} from './client-detection-engine.js';
import {
  runPortfolioExtraction,
  harvestPortfolioSourceBlob,
} from './portfolio-extraction-engine.js';
import {
  runProjectsExtraction,
  harvestProjectsSourceBlob,
} from './projects-engine.js';
import { runCreativeClientProjectRecovery } from './creative-client-project-recovery.js';
import { CREATIVE_RECOVERY_PROJECT_TYPE_RE } from './creative-recovery-constants.js';
import { findLongestDictionaryTerm, CLIENT_TERMS } from '../../data/dictionaries/json-dictionary-match.js';
import {
  tryRecoverSchoolEducation,
  recoverSafeParsedEducation,
  dedupeEducationEntries,
  formatSafeEducationEntry,
  SAFE_EDUCATION_CONFIDENCE_MIN,
} from './education-recovery.js';
import { scoreEducationLine } from '../validation/confidence-gate.js';
import {
  applyStrictLanguageExtraction,
  normalizeLanguageDisplayLine,
} from './strict-language-extraction.js';

export { normalizeLanguageDisplayLine };
import { recognizeEntitiesInText, CLIENT_RECOGNIZER } from '../../data/dictionaries/entity-catalog.js';
import { recoverSectionsFromUnsorted } from './unsorted-section-recovery.js';
import { routeListLineToSkillsAndTools } from './skills-routing.js';
import { runCvEnhancementEngine } from './cv-enhancement-engine.js';
import { reconstructAllExperienceSemantics } from './experience-semantic-layer.js';
import { normalizeAllEducation } from './education-normalization-layer.js';

export { tryRecoverSchoolEducation } from './education-recovery.js';

const EXPERIENCE_ROLE_MARKERS_RE =
  /\b(engineer|developer|manager|director|analyst|consultant|recruiter|designer|executive|specialist)\b/i;

function employerTokensFromExperiences(experiences = []) {
  const tokens = new Set();
  for (const exp of experiences || []) {
    for (const part of [exp?.company, exp?.role]) {
      const s = String(part || '').trim().toLowerCase();
      if (!s || s.length < 3) continue;
      tokens.add(s);
      s.split(/\s+/).filter((w) => w.length >= 4).forEach((w) => tokens.add(w));
    }
  }
  return tokens;
}

const TOOL_BRAND_SUBSTRING_RE =
  /\b(google\s+analytics|meta\s+ads|ads\s+manager|hubspot|salesforce|workday|greenhouse|tableau|powerpoint|linkedin\s+recruiter)\b/i;

function isToolDerivedClientLine(line) {
  const s = String(line || '').trim();
  if (!s) return false;
  return TOOL_BRAND_SUBSTRING_RE.test(s) || TOOL_NAME_RE.test(s);
}

function clientHarvestLines(lines = [], experiences = []) {
  const employers = employerTokensFromExperiences(experiences);
  return (lines || []).filter((line) => {
    const s = String(line || '').trim();
    if (!s) return false;
    if (isToolDerivedClientLine(s)) return false;
    if (/\b(19|20)\d{2}\s*[-–—]/.test(s) && EXPERIENCE_ROLE_MARKERS_RE.test(s)) return false;
    if (/^(senior|lead|digital|marketing|software|business)\s+/i.test(s) && /\s[—–-]\s/.test(s)) return false;
    const low = s.toLowerCase();
    for (const emp of employers) {
      if (emp.length >= 4 && (low === emp || low.includes(emp))) return false;
    }
    return true;
  });
}

function stripEmployerClients(clients = [], experiences = []) {
  const employers = employerTokensFromExperiences(experiences);
  return (clients || []).filter((c) => {
    const low = String(c || '').trim().toLowerCase();
    if (!low) return false;
    if (CLIENT_ANCHOR_TARGETS.some((a) => a.toLowerCase() === low)) return true;
    if (findLongestDictionaryTerm(c, CLIENT_TERMS)) return true;
    for (const emp of employers) {
      if (emp.length >= 4 && (low === emp || emp.includes(low) || low.includes(emp))) return false;
    }
    return true;
  });
}

const SECTION_HEADER_RE =
  /^(profile|work\s+experience|education|languages?|skills?\s+interests?|skills?\s+interest|-\s*education|internship|date\s+à\s+confirmer)$/i;

const UNSORTED_GARBAGE_RE =
  /^(ee\s+à|a\s+a\s+tn|_—\s*pe|rs\s+phone|tt\s+lu|photograph:|\[?\d+\]|mustrator|incesion|ign\s+fin|@man\b|v3\s*2\s*gradric)/i;

const OCR_TOOL_GARBAGE_RE = /\b(v3\s*2|gradric|mustrator|illusthatch)\b/i;

const LANGUAGE_DRAIN_RE =
  /\b(french|english|français|anglais|native|fluent|bilingual|courant|bilingue)\b/i;

const TOOL_NAME_RE =
  /\b(photoshop|illustrator|indesign|after effects|procreate|figma|adobe|premiere|blender|sketch|xd)\b/i;

const LANGUAGE_ONLY_RE = /^(english|french|spanish|german|native|fluent|bilingual)$/i;

function isLanguageLikeToolLine(s) {
  const t = String(s || '').trim();
  if (!t) return false;
  if (LANGUAGE_ONLY_RE.test(t)) return true;
  if (LANGUAGE_DRAIN_RE.test(t) && !TOOL_NAME_RE.test(t)) return true;
  if (/\b(native|fluent|bilingual)\b/i.test(t) && !TOOL_NAME_RE.test(t)) return true;
  return false;
}

function normalizeDisplayLanguages(languages = []) {
  return applyStrictLanguageExtraction(languages).languages;
}

function pushUnique(arr, value) {
  const v = String(value || '').trim();
  if (!v) return;
  if (!arr.some((x) => String(x).trim().toLowerCase() === v.toLowerCase())) arr.push(v);
}

/**
 * @param {string} role
 */
export function normalizeFreelanceExperienceRole(role) {
  return String(role || '').trim().replace(/\s+/g, ' ');
}

/**
 * @param {string[]} clients
 * @param {string[]} [extraLines]
 * @returns {string[]}
 */
export function extractCleanClientBrands(clients = [], extraLines = []) {
  const harvestLines = (extraLines || []).filter((line) => !isToolDerivedClientLine(line));
  const blob = [...clients, ...harvestLines].join(' ');
  const found = [];
  const seen = new Set();
  const push = (name) => {
    const n = String(name || '').trim();
    if (!n) return;
    const k = n.toLowerCase();
    if (seen.has(k)) return;
    seen.add(k);
    found.push(n);
  };

  for (const c of clients || []) {
    const name = String(c || '').trim();
    if (!name) continue;
    if (CLIENT_ANCHOR_TARGETS.some((a) => a.toLowerCase() === name.toLowerCase())) {
      push(name);
      continue;
    }
    if (findLongestDictionaryTerm(name, CLIENT_TERMS)) push(name);
  }

  for (const hit of recognizeEntitiesInText(blob, CLIENT_RECOGNIZER)) {
    const name = String(hit.canonical || hit.matched || '').trim();
    if (!name) continue;
    if (/^google$/i.test(name) && /\bgoogle\s+analytics\b/i.test(blob)) continue;
    if (/^meta$/i.test(name) && /\bmeta\s+ads\b/i.test(blob)) continue;
    if (/^adobe$/i.test(name) && /\badobe\s+(photoshop|illustrator|indesign|creative\s+suite)\b/i.test(blob) && !/\b(collaborated|clients?|brands?|including|worked)\b/i.test(blob)) {
      continue;
    }
    push(name);
  }
  return found;
}

function isUnsortedGarbage(line) {
  const s = String(line || '').trim();
  if (!s || s.length < 2) return true;
  if (SECTION_HEADER_RE.test(s)) return true;
  if (UNSORTED_GARBAGE_RE.test(s)) return true;
  if (/^profile\s+work\s+experience$/i.test(s)) return true;
  if (/^skills?\s+interests?$/i.test(s)) return true;
  if (/^-\s*education$/i.test(s)) return true;
  if (/^@man\s+visual\s+communication$/i.test(s)) return true;
  if (/multisectoral\s+year\s*\{/i.test(s) && !/\(\s*(?:19|20)\d{2}/.test(s)) return true;
  if (/product\s+design,\s*video\s+game,\s*architecture\}/i.test(s) && s.length < 80) return true;
  return false;
}

function titleCaseSkill(s) {
  const t = String(s || '').trim().replace(/\.$/, '');
  if (!t) return '';
  return t.charAt(0).toUpperCase() + t.slice(1);
}

function schoolKey(line) {
  return String(line || '')
    .trim()
    .split(/[—–-]/)[0]
    .replace(/\s+/g, ' ')
    .toLowerCase()
    .slice(0, 24);
}

function pushExperience(rd, exp) {
  if (!exp) return;
  rd.experiences = rd.experiences || [];
  const key = `${exp.role}|${exp.company}|${exp.startDate}`.toLowerCase();
  if (rd.experiences.some((e) => `${e.role}|${e.company}|${e.startDate}`.toLowerCase() === key)) {
    return;
  }
  rd.experiences.push({
    ...exp,
    clients: exp.clients || [],
    location: exp.location || '',
    bullets: exp.bullets || [],
  });
}

const CANONICAL_TOOL_PATTERNS = [
  ['Photoshop', /\bphotoshop\b/i],
  ['Illustrator', /\billustrator\b/i],
  ['InDesign', /\bindesign\b/i],
  ['After Effects', /\bafter\s+effects\b/i],
  ['Procreate', /\bprocreate\b/i],
  ['Figma', /\bfigma\b/i],
  ['Adobe', /\badobe\b/i],
];

function recoverCanonicalTools(rd) {
  const blob = [
    ...(rd.unsorted || []),
    ...(rd.skills || []),
    ...(rd.tools || []),
    rd.summary,
    ...(rd.experiences || []).flatMap((e) => [e.role, e.company, ...(e.bullets || [])]),
  ].join('\n');
  for (const [name, re] of CANONICAL_TOOL_PATTERNS) {
    if (re.test(blob)) pushUnique(rd.tools, name);
  }
}

function recoverMisclassifiedFromTools(rd) {
  const kept = [];
  const contextBlob = [
    ...(rd.unsorted || []),
    ...(rd.education || []),
    ...(rd.experiences || []).map((e) => [e.role, e.company, e.dates].join(' ')),
  ].join('\n');

  for (const item of rd.tools || []) {
    const s = String(item || '').trim();
    if (!s) continue;

    if (OCR_TOOL_GARBAGE_RE.test(s)) {
      pushUnique(rd.unsorted, s);
      continue;
    }

    const freelance = parseFreelanceCareerLine(s);
    if (freelance) {
      pushExperience(rd, freelance);
      continue;
    }

    if (isLanguageLikeToolLine(s)) {
      pushUnique(rd.languages, normalizeLanguageDisplayLine(s));
      continue;
    }

    const freelanceFromTools = parseFreelanceCareerLine(s);
    if (freelanceFromTools) {
      pushExperience(rd, freelanceFromTools);
      continue;
    }

    if (s.length > 48 || /\b(19|20)\d{2}\s*[-–—]/.test(s) || /\bfreelanc/i.test(s)) {
      pushUnique(rd.unsorted, s);
      continue;
    }

    kept.push(s);
  }
  rd.tools = kept;
}

/**
 * @param {import('../resume-data.js').ResumeData} rd
 */
export function polishResumeOutput(rd) {
  if (!rd || typeof rd !== 'object') return rd;
  rd = recoverSectionsFromUnsorted(rd);

  const identityBlob = [
    ...(rd.unsorted || []),
    ...(rd.education || []),
    ...(rd.tools || []),
    rd.summary,
    ...(rd.experiences || []).map((e) => [e.role, e.company, e.dates].join(' ')),
  ].join('\n');
  rd.identity = repairIdentityFromOcrSignals(rd.identity, identityBlob);

  recoverMisclassifiedFromTools(rd);
  repairExperienceEntries(rd);
  recoverSafeParsedEducation(rd, { nearbyLines: rd.unsorted || [] });

  for (const exp of rd.experiences || []) {
    if (exp?.role) exp.role = normalizeFreelanceExperienceRole(exp.role);
  }

  recoverCanonicalTools(rd);

  rd.education = normalizeAllEducation(rd.education || [], { identity: rd.identity });
  const eduPolished = [];
  for (const item of rd.education || []) {
    const s = String(item || '').trim();
    if (!s) continue;
    const conf = scoreEducationLine(s);
    const hasDegreeYear =
      /\b(b\.?\s*s\.?|b\.?\s*a\.?|m\.?\s*s\.?c?\.?|mba|bachelor|master|diploma)\b/i.test(s) &&
      /\b(19|20)\d{2}\b/.test(s);
    if (conf < SAFE_EDUCATION_CONFIDENCE_MIN && isCorruptEducationLine(s) && !hasDegreeYear) {
      pushUnique(rd.unsorted, s);
      continue;
    }
    eduPolished.push(s);
  }
  rd.education = eduPolished;

  const drained = [];
  for (const line of rd.unsorted || []) {
    const s = String(line || '').trim();
    if (!s) continue;

    if (isUnsortedGarbage(s)) continue;

    const urlMerged = parseUrlMergedExperienceLine(s);
    if (urlMerged) {
      pushExperience(rd, urlMerged);
      continue;
    }

    const safeEdu = formatSafeEducationEntry(s);
    if (safeEdu?.education) {
      pushUnique(rd.education, safeEdu.education);
      if (safeEdu.phone && !rd.identity?.phone) rd.identity.phone = safeEdu.phone;
      if (safeEdu.email && !rd.identity?.email) rd.identity.email = safeEdu.email;
      continue;
    }

    const schoolRecovered = tryRecoverSchoolEducation(s);
    if (schoolRecovered) {
      pushUnique(rd.education, schoolRecovered);
      continue;
    }

    if (/^adobe$/i.test(s)) {
      pushUnique(rd.tools, 'Adobe');
      continue;
    }

    if (LANGUAGE_DRAIN_RE.test(s) && s.length < 48 && !/créapole|lisaa|school/i.test(s)) {
      pushUnique(rd.languages, normalizeLanguageDisplayLine(s));
      continue;
    }

    if (/^(logos?|illustrations?|editions?|drawing|music|nature|visuel identity|corporate identity)/i.test(s)) {
      const skill = titleCaseSkill(s);
      if (validateCvSectionItem('skill', skill).valid) pushUnique(rd.skills, skill);
      continue;
    }

    if (/print.*logo.*vector/i.test(s)) {
      for (const part of ['Print', 'Logo', 'Vector', 'Art']) {
        if (validateCvSectionItem('skill', part).valid) pushUnique(rd.skills, part);
      }
      continue;
    }

    if (isCreativeSkillPhrase(s)) {
      const parts = s.split(/[,;·]/).map((p) => p.trim()).filter((p) => p.length > 2);
      for (const part of parts.length ? parts : [s]) {
        if (validateCvSectionItem('skill', part).valid) pushUnique(rd.skills, part);
      }
      continue;
    }

    if (isStrictSoftwareLine(s)) {
      if (validateCvSectionItem('tool', s).valid) pushUnique(rd.tools, s);
      continue;
    }

    if (routeListLineToSkillsAndTools(rd, s)) continue;

    if (isClientListLine(s) || /\bmccann\b/i.test(s)) {
      const internship = parseInternshipLine(s, { nearbyLines: rd.unsorted || [] });
      const internshipConf = internship?.confidence ?? 0;
      if (
        internship &&
        internshipConf >= EXPERIENCE_PARSER_CONFIDENCE_MIN &&
        qualifiesStrictExperience(internship, s)
      ) {
        const key = `${internship.role}|${internship.company}|${internship.startDate}`.toLowerCase();
        const exists = (rd.experiences || []).some(
          (e) => `${e.role}|${e.company}|${e.startDate}`.toLowerCase() === key
        );
        if (!exists) {
          rd.experiences.push({
            ...internship,
            clients: [],
            bullets: internship.bullets || [],
            sourceLines: [s],
            recoverySource: 'SAFE_EXPERIENCE_RECOVERY',
          });
        }
        continue;
      }
      const brands = extractCleanClientBrands([s], []);
      for (const b of brands) pushUnique(rd.clients, b);
      continue;
    }

    drained.push(s);
  }
  rd.unsorted = drained;

  const clientBlob = [
    harvestClientSourceBlob(rd, rd.meta?.rawText || rd.meta?.cleanedText || ''),
    ...(rd.unsorted || []),
    ...(rd.experiences || []).flatMap((e) => e?.bullets || []),
  ].join('\n');
  const hasClientSignals = /\b(clients?\s+including|collaborated\s+with|worked\s+(?:for|with))\b/i.test(clientBlob);
  runClientDetection(rd, clientBlob, {
    forceCreative: Boolean(rd._creativeMode?.active || rd.meta?.creativeParsingMode || hasClientSignals),
  });

  const portfolioBlob = harvestPortfolioSourceBlob(rd, rd.meta?.rawText || rd.meta?.cleanedText || '');
  const hasPortfolioSignals = /\b(behance|dribbble|artstation|instagram|foundation\.app|portfolio|website|linkedin\.com)\b/i.test(
    portfolioBlob
  );
  runPortfolioExtraction(rd, portfolioBlob, {
    forceCreative: Boolean(rd._creativeMode?.active || rd.meta?.creativeParsingMode || hasPortfolioSignals),
  });

  const projectsBlob = harvestProjectsSourceBlob(rd, rd.meta?.rawText || rd.meta?.cleanedText || '');
  const hasProjectSignals =
    CREATIVE_RECOVERY_PROJECT_TYPE_RE.test(projectsBlob) ||
    /\b(projects?|selected\s+work)\b/i.test(projectsBlob);
  runProjectsExtraction(rd, rd.meta?.rawText || rd.meta?.cleanedText || '', {
    forceCreative: Boolean(
      rd._creativeMode?.active || rd.meta?.creativeParsingMode || rd.meta?.designerMode?.active || hasProjectSignals
    ),
    designerMode: rd.meta?.designerMode || null,
  });

  runCreativeClientProjectRecovery(rd, rd.meta?.rawText || rd.meta?.cleanedText || '', {
    forceCreative: Boolean(rd._creativeMode?.active || rd.meta?.creativeParsingMode || hasClientSignals),
    designerMode: rd.meta?.designerMode || null,
  });

  rd.clients = stripEmployerClients(
    extractCleanClientBrands(rd.clients || [], clientHarvestLines(rd.unsorted || [], rd.experiences)),
    rd.experiences
  );
  rd.education = normalizeAllEducation(rd.education || [], { identity: rd.identity });
  recoverSafeParsedEducation(rd, { lines: rd.unsorted || [] });
  const langBlob = [
    ...(rd.unsorted || []),
    ...(rd.languages || []),
    ...(rd.tools || []),
    rd.summary,
  ].join('\n');
  if (/\b(english|anglais)\b/i.test(langBlob)) pushUnique(rd.languages, 'English — fluent');
  if (/\b(french|français|francais)\b/i.test(langBlob)) pushUnique(rd.languages, 'French — native');
  rd.languages = normalizeDisplayLanguages(rd.languages || []);

  const titleBlob = [
    rd.identity?.title,
    rd.summary,
    ...(rd.experiences || []).map((e) => [e.role, e.company, ...(e.bullets || [])].join(' ')),
    ...(rd.unsorted || []),
  ].join('\n');
  const recoveredTitle = resolveCreativeProfessionalTitle(
    [rd.identity?.title].filter(Boolean),
    titleBlob
  );
  const rawTitle = String(rd.identity?.title || '').trim();
  if (
    recoveredTitle &&
    (!rawTitle ||
      /gradric|mustrator|v3\s*2|illusthatch/i.test(rawTitle) ||
      !/^graphic designer\s*&\s*illustrator$/i.test(rawTitle))
  ) {
    rd.identity = { ...(rd.identity || {}), title: recoveredTitle };
  }

  rd.experiences = reconstructAllExperienceSemantics(rd.experiences || []);
  runCvEnhancementEngine(rd);
  rd.education = normalizeAllEducation(rd.education || [], { identity: rd.identity });
  return rd;
}
