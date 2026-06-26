/**
 * Post-import repair — recover identity, phone, and experience from raw OCR text
 * when the structured parser under-fills fields.
 */

import {
  isValidIdentityName,
  isValidIdentityTitle,
  repairIdentityFromOcrSignals,
} from './identity-extraction.js';
import { rawHasCareerSignals } from './field-completeness-gate.js';
import { PHONE_RE } from './field-sanitize.js';
import { validatePhone } from './rich-parser.js';
import {
  detectNameCandidates,
  detectTitleCandidates,
  harvestExperienceFromLines,
  extractDateRangeFromText,
  consolidateExperiences,
  NAME_UNCERTAIN_LABEL,
  TITLE_UNCERTAIN_LABEL,
} from './parser-recovery.js';
import { shouldSkipFlatRepairForResumeData } from './cv-block-parser-bridge.js';
import {
  extractExperiencesFromSectionAnchors,
  resolveCreativeProfessionalTitle,
} from './section-anchor-extract.js';
import { postProcessOcrText, looksLikeOcrText } from './ocr-postprocess.js';
import { lineLooksLikeCareerHistory } from './generic-career-signals.js';
import {
  parseFreelanceCareerLine,
  parseUrlMergedExperienceLine,
  parseInternshipLine,
  parseDashSeparatedExperienceLine,
  parseEducationLineWithContact,
  extractInlinePhone,
} from './classification-fixes.js';
import { scoreEducationLine } from '../validation/confidence-gate.js';
import { recoverSectionsFromUnsorted } from './unsorted-section-recovery.js';

function isDateRangeLike(text) {
  const t = String(text || '').trim();
  return /\b(19|20)\d{2}\s*[-–—]\s*(\d{4}|present|présent|current|now)\b/i.test(t);
}

function nameNeedsRepair(name) {
  const n = String(name || '').trim();
  return !n || n === NAME_UNCERTAIN_LABEL || /confirmer/i.test(n);
}

function titleNeedsRepair(title) {
  const t = String(title || '').trim();
  return !t || t === TITLE_UNCERTAIN_LABEL || /compléter/i.test(t);
}

/** Shallow clone — avoids importing resume-data.js (breaks ESM boot cycle in browser). */
function cloneResumeDataForRepair(rd) {
  const d = rd || {};
  return {
    identity: { ...(d.identity || {}) },
    summary: String(d.summary || '').trim(),
    experiences: Array.isArray(d.experiences)
      ? d.experiences.map((e) => ({
          ...e,
          bullets: Array.isArray(e?.bullets) ? [...e.bullets] : [],
          clients: Array.isArray(e?.clients) ? [...e.clients] : [],
        }))
      : [],
    education: Array.isArray(d.education) ? d.education.map(String) : [],
    clients: Array.isArray(d.clients) ? d.clients.map(String) : [],
    projects: Array.isArray(d.projects) ? d.projects.map(String) : [],
    exhibitions: Array.isArray(d.exhibitions) ? d.exhibitions.map(String) : [],
    awards: Array.isArray(d.awards) ? d.awards.map(String) : [],
    publications: Array.isArray(d.publications) ? d.publications.map(String) : [],
    portfolioLinks: Array.isArray(d.portfolioLinks) ? d.portfolioLinks.map(String) : [],
    skills: Array.isArray(d.skills) ? d.skills.map(String) : [],
    tools: Array.isArray(d.tools) ? d.tools.map(String) : [],
    languages: Array.isArray(d.languages) ? d.languages.map(String) : [],
    unsorted: Array.isArray(d.unsorted) ? d.unsorted.map(String) : [],
    meta: { ...(d.meta || {}) },
  };
}

function extractPhoneFromBlob(raw) {
  const fromLine = extractInlinePhone(raw);
  if (fromLine) return fromLine;
  const m = String(raw || '').match(PHONE_RE);
  if (!m) return '';
  const p = m[0].trim();
  return validatePhone(p) && !isDateRangeLike(p) ? p : '';
}

function harvestedToExperiences(harvested, identity = {}, blob = '') {
  const out = [];
  for (const text of harvested) {
    const merged = parseUrlMergedExperienceLine(text);
    if (merged) {
      out.push({
        role: merged.role,
        company: merged.company,
        location: '',
        startDate: merged.startDate,
        endDate: merged.endDate,
        dates: merged.dates,
        bullets: merged.bullets || [],
        clients: [],
      });
      continue;
    }
    const dash = parseDashSeparatedExperienceLine(text);
    if (dash) {
      out.push({ ...dash, clients: [], location: dash.location || '' });
      continue;
    }
    const freelance = parseFreelanceCareerLine(text);
    if (freelance) {
      out.push({ ...freelance, clients: [], location: '' });
      continue;
    }
    const internship = parseInternshipLine(text);
    if (internship) {
      out.push({ ...internship, clients: [], location: '' });
      continue;
    }
    const dates = extractDateRangeFromText(text);
    const isFreelance = /\b(freelance|independent|contractor)\b/i.test(text);
    const colon = text.indexOf(':');
    const role = (colon > 0 ? text.slice(0, colon) : text).trim().slice(0, 120);
    const bullet = colon > 0 ? text.slice(colon + 1).trim() : '';
    out.push({
      role,
      company: isFreelance ? 'Independent / Freelance' : '',
      location: '',
      startDate: dates.startDate || '',
      endDate: dates.endDate || (dates.startDate ? 'Present' : ''),
      dates: dates.startDate ? `${dates.startDate}–${dates.endDate || 'Present'}` : '',
      bullets: bullet ? [bullet.slice(0, 240)] : [],
      clients: [],
    });
  }
  if (out.length) return out;
  const full = String(blob || '').trim();
  return consolidateExperiences([], full, identity);
}

/**
 * @param {import('../resume-data.js').ResumeData} rd
 * @param {{ rawText?: string, cleanedText?: string, headerLines?: string[] }} [opts]
 */
export function repairResumeDataFromRaw(rd, opts = {}) {
  if (
    opts.skipFlatRepair ||
    shouldSkipFlatRepairForResumeData(rd) ||
    rd?.meta?.blockParserBridgeApplied
  ) {
    return cloneResumeDataForRepair(rd);
  }
  const raw = String(opts.rawText || '').trim();
  let clean = String(opts.cleanedText || raw).trim();
  if (!raw && !clean) return cloneResumeDataForRepair(rd);

  if (looksLikeOcrText(raw) || looksLikeOcrText(clean)) {
    clean = postProcessOcrText(clean || raw, { ocr: true });
  }

  const lines = clean.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  let data = cloneResumeDataForRepair(rd);
  data.identity = repairIdentityFromOcrSignals(data.identity, `${raw}\n${clean}`);

  if (data.identity?.phone && (!validatePhone(data.identity.phone) || isDateRangeLike(data.identity.phone))) {
    data.identity.phone = extractPhoneFromBlob(raw);
  }
  if (!data.identity?.phone) {
    const fromRaw = extractPhoneFromBlob(raw);
    if (fromRaw) data.identity.phone = fromRaw;
  }

  for (const line of lines) {
    const eduParsed = parseEducationLineWithContact(line);
    if (eduParsed?.phone && !data.identity.phone) data.identity.phone = eduParsed.phone;
    if (eduParsed?.email && !data.identity.email) data.identity.email = eduParsed.email;
    if (eduParsed?.education && scoreEducationLine(eduParsed.education) >= 85) {
      const exists = (data.education || []).some((e) =>
        String(e).toLowerCase().includes(eduParsed.education.slice(0, 12).toLowerCase())
      );
      if (!exists) data.education.push(eduParsed.education);
    }
  }

  for (const line of lines) {
    const freelance = parseFreelanceCareerLine(line);
    if (freelance && !(data.experiences || []).length) {
      data.experiences = [{ ...freelance, clients: [], location: '' }];
      break;
    }
  }

  if (nameNeedsRepair(data.identity?.name)) {
    const det = detectNameCandidates(lines, {
      headerLines: opts.headerLines || lines.slice(0, 12),
    });
    if (det.resolvedName && isValidIdentityName(det.resolvedName)) {
      data.identity.name = det.resolvedName;
    } else {
      const blobMatch = raw.match(
        /\b([A-ZÀ-Ÿ][a-zà-ö]{2,})\s+([A-ZÀ-Ÿ][a-zà-ö]{2,})\b/
      );
      if (blobMatch) {
        const candidate = `${blobMatch[1]} ${blobMatch[2]}`.trim();
        if (isValidIdentityName(candidate)) data.identity.name = candidate;
      }
      if (nameNeedsRepair(data.identity?.name)) {
        for (const line of lines.slice(0, 15)) {
          const cleaned = line
            .replace(/[^A-Za-zÀ-ÿ' -]/g, ' ')
            .replace(/\s+/g, ' ')
            .trim();
          if (isValidIdentityName(cleaned)) {
            data.identity.name = cleaned;
            break;
          }
        }
      }
    }
  }

  if (titleNeedsRepair(data.identity?.title)) {
    const creativeTitle = resolveCreativeProfessionalTitle(lines, clean || raw);
    if (creativeTitle && isValidIdentityTitle(creativeTitle)) {
      data.identity.title = creativeTitle;
    } else {
      const titleDet = detectTitleCandidates(lines, data.identity?.name || '', {}, {});
      if (titleDet.best && isValidIdentityTitle(titleDet.best)) {
        data.identity.title = titleDet.best;
      } else {
        for (const line of lines.slice(0, 20)) {
          if (line === data.identity?.name) continue;
          if (isValidIdentityTitle(line)) {
            data.identity.title = line;
            break;
          }
        }
      }
    }
  }

  const careerBlob = `${raw}\n${clean}`;
  const shouldRecoverExperience =
    !(data.experiences || []).length &&
    (rawHasCareerSignals(careerBlob) ||
      /\bwork\s+experience\b/i.test(careerBlob) ||
      /\b(19|20)\d{2}\s*[-–—]/i.test(careerBlob));

  if (shouldRecoverExperience) {
    const anchored = extractExperiencesFromSectionAnchors(lines, clean || raw);
    if (anchored.length) {
      data.experiences = anchored;
      data.meta.warnings = [...(data.meta.warnings || []), 'EXPERIENCE_RECOVERED_SECTION_ANCHOR'];
    } else {
      const harvested = harvestExperienceFromLines(lines, {});
      const exps = harvestedToExperiences(harvested, data.identity, clean || raw);
      if (exps.length) {
        data.experiences = exps;
        data.meta.warnings = [...(data.meta.warnings || []), 'EXPERIENCE_REPAIRED_FROM_RAW'];
      } else {
        const fallback = consolidateExperiences([], clean || raw, data.identity);
        if (fallback.length) {
          data.experiences = fallback;
          data.meta.warnings = [...(data.meta.warnings || []), 'EXPERIENCE_RECOVERED_CONSOLIDATE'];
        }
      }
    }
    if (!(data.experiences || []).length) {
      const careerLines = lines.filter((l) => lineLooksLikeCareerHistory(l));
      if (careerLines.length) {
        data.unsorted = [...new Set([...(data.unsorted || []), ...careerLines])];
        data.meta.warnings = [...(data.meta.warnings || []), 'EXPERIENCE_QUEUED_UNSORTED'];
      }
    }
  }

  data.identity = repairIdentityFromOcrSignals(data.identity, `${raw}\n${clean}`);
  data = recoverSectionsFromUnsorted(data);
  return data;
}

export { repairIdentityFromOcrSignals } from './identity-extraction.js';
