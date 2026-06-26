/**
 * TEXT FIRST ENGINE — any raw text → resume object (best effort, never null).
 */
import { emptyResumeData } from '../resume-data.js';
import {
  applyOcrCleanupPipeline,
  dedupeEducationEntries,
  isEducationGarbageLine,
  VERIFY_CONTENT_LABEL,
} from './ocr-cleanup-pipeline.js';
import {
  buildHonestResumeFromTextParts,
  shouldUseExtractionHonestMode,
} from './extraction-honest-mode.js';

export const TEXT_FIRST_ENGINE_VERSION = 'TEXT_FIRST_ENGINE_V2';

const SECTION_PATTERNS = Object.freeze({
  experiences: /^(expériences?|experience|work\s*history|parcours\s*professionnel|emplois?|professional\s*experience)\b/i,
  education: /^(formation|formations|education|études|studies|academic)\b/i,
  skills: /^(compétences|competences|skills|savoir[- ]faire|expertise)\b/i,
  tools: /^(outils|tools|software)\b/i,
  clients: /^(clients?|customer)\b/i,
  summary: /^(profil|profile|summary|résumé|about\s*me|à\s*propos)\b/i,
});

function cleanText(rawText) {
  return String(rawText ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .trim();
}

function linesOf(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function detectName(lines) {
  for (const line of lines.slice(0, 12)) {
    if (line.length < 2 || line.length > 80) continue;
    if (/^(curriculum|vitae|resume|résumé|cv\b|email|tel|phone|profil|profile|coordonn)/i.test(line)) {
      continue;
    }
    if (/^[\d+().\s-]+$/.test(line)) continue;
    if (/@|https?:\/\//i.test(line)) continue;
    if (/[A-Za-zÀ-ÿ]{2,}/.test(line)) return line;
  }
  return 'Nom à vérifier';
}

function detectTitle(lines, name) {
  const idx = lines.findIndex((l) => l === name);
  const candidates = idx >= 0 ? lines.slice(idx + 1, idx + 4) : lines.slice(1, 4);
  for (const line of candidates) {
    if (line.length < 3 || line.length > 90) continue;
    if (/@|https?:\/\//i.test(line)) continue;
    if (/^[\d+().\s-]+$/.test(line)) continue;
    if (SECTION_PATTERNS.experiences.test(line)) continue;
    if (SECTION_PATTERNS.education.test(line)) continue;
    if (SECTION_PATTERNS.skills.test(line)) continue;
    return line;
  }
  return '';
}

function extractContact(text) {
  const blob = String(text || '');
  const email = (blob.match(/[\w.+-]+@[\w.-]+\.\w{2,}/) || [])[0] || '';
  const phone = (blob.match(/(?:\+?\d[\d\s().-]{7,}\d)/) || [])[0] || '';
  const linkedin =
    (blob.match(/(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s,)]+/i) || [])[0] || '';
  const website = (blob.match(/https?:\/\/(?!www\.linkedin\.com)[^\s,)]+/i) || [])[0] || '';
  return { email, phone, linkedin, website };
}

function sectionKeyForLine(line) {
  const normalized = String(line || '').trim();
  const canonMap = {
    PROFIL: 'summary',
    EXPERIENCE: 'experiences',
    FORMATION: 'education',
    COMPETENCES: 'skills',
    OUTILS: 'tools',
    CLIENTS: 'clients',
    LANGUES: 'languages',
  };
  if (canonMap[normalized]) return canonMap[normalized];
  for (const [key, re] of Object.entries(SECTION_PATTERNS)) {
    if (re.test(normalized)) return key;
  }
  return null;
}

/**
 * @param {string[]} lines
 * @param {string} name
 */
function splitSections(lines, name) {
  /** @type {Record<string, string[]>} */
  const buckets = {
    summary: [],
    experiences: [],
    education: [],
    skills: [],
    tools: [],
    clients: [],
    body: [],
  };
  let current = 'body';

  for (const line of lines) {
    if (line === name) continue;
    const key = sectionKeyForLine(line);
    if (key) {
      current = key;
      continue;
    }
    buckets[current].push(line);
  }

  return buckets;
}

function bulletsFromLines(lines) {
  return lines
    .map((l) => l.replace(/^[-•*▪◦]\s*/, '').trim())
    .filter((l) => l.length > 0)
    .slice(0, 120);
}

function parseExperiences(lines) {
  const bullets = bulletsFromLines(lines);
  if (!bullets.length) return [];
  return [
    {
      role: '',
      company: '',
      dates: '',
      bullets,
    },
  ];
}

function parseSkills(lines) {
  const joined = lines.join(' ');
  const comma = joined
    .split(/[,;|•]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 64);
  if (comma.length >= 2) return comma.slice(0, 48);
  return bulletsFromLines(lines).slice(0, 48);
}

function parseEducation(lines) {
  const bullets = bulletsFromLines(lines).filter((line) => !isEducationGarbageLine(line));
  if (!bullets.length) return [];
  const entries = bullets.slice(0, 24).map((line) => {
    const parts = line.split(/\s*[–—-]\s*|\s*,\s*/);
    return {
      degree: parts[0] || line,
      school: parts[1] || '',
      dates: parts[2] || '',
      bullets: parts.length > 3 ? parts.slice(3) : [],
    };
  });
  return dedupeEducationEntries(entries);
}

/**
 * Minimal resume — never null.
 * @param {object} [meta]
 */
export function createMinimalResume(meta = {}) {
  return emptyResumeData({
    textFirstEngine: true,
    source: 'createMinimalResume',
    ...meta,
  });
}

/**
 * Best-effort resume from raw text. Never returns null.
 * Does not require experience, education, skills, or LinkedIn.
 * @param {string} rawText
 * @param {{ ocrConfidence?: number, honestMode?: boolean, lowOcr?: boolean }} [opts]
 */
export function createResumeFromText(rawText, opts = {}) {
  try {
    const pipeline = applyOcrCleanupPipeline(rawText);
    const clean = cleanText(pipeline.text);
    if (!clean && !pipeline.uncertainLines.length) {
      return createMinimalResume({ emptyInput: true });
    }

    const lines = linesOf(clean || String(rawText || ''));
    const name = detectName(lines);
    const title = detectTitle(lines, name);
    const contact = extractContact(clean || rawText);
    const buckets = splitSections(lines, name);

    if (shouldUseExtractionHonestMode(opts)) {
      return buildHonestResumeFromTextParts({
        clean,
        lines,
        name,
        title,
        contact,
        buckets,
        pipelineUncertain: pipeline.uncertainLines,
        ocrConfidence: opts.ocrConfidence,
        pipelineMeta: pipeline.meta,
        engineVersion: TEXT_FIRST_ENGINE_VERSION,
      });
    }

    const bodyLines = buckets.body.length ? buckets.body : lines.filter((l) => l !== name && l !== title);
    const summarySource = buckets.summary.length ? buckets.summary : bodyLines.slice(0, 8);
    const summary = summarySource.join('\n').slice(0, 1200);
    const verifyLines = pipeline.uncertainLines.map((l) => String(l).trim()).filter(Boolean);

    const experiences = parseExperiences(buckets.experiences);
    const education = parseEducation(buckets.education);
    const skills = parseSkills(buckets.skills);
    const tools = parseSkills(buckets.tools);
    const clients = parseSkills(buckets.clients);

    const remainingBody = bulletsFromLines(
      experiences.length ? [] : bodyLines.length ? bodyLines : [clean.slice(0, 4000)],
    );

    const unsortedBase = bodyLines.filter((l) => !summarySource.includes(l)).slice(0, 200);
    const unsorted = [
      ...verifyLines,
      ...unsortedBase.filter((l) => !verifyLines.includes(l)),
    ].filter(Boolean);

    return {
      identity: {
        name,
        title: title || 'Profil professionnel',
        email: contact.email,
        phone: contact.phone,
        location: '',
        website: contact.website,
        linkedin: contact.linkedin,
      },
      summary: summary || clean.slice(0, 1200),
      experiences,
      education,
      clients,
      projects: [],
      exhibitions: [],
      awards: [],
      publications: [],
      press: [],
      portfolioLinks: [],
      skills,
      tools,
      languages: [],
      unsorted:
        unsorted.length > 0
          ? unsorted
          : remainingBody.length
            ? remainingBody
            : clean
              ? [clean.slice(0, 4000)]
              : [],
      meta: {
        textFirstEngine: true,
        ocrCleanupPipeline: true,
        engineVersion: TEXT_FIRST_ENGINE_VERSION,
        source: 'createResumeFromText',
        charCount: clean.length,
        verifyContent: verifyLines.length ? verifyLines : undefined,
        verifyContentLabel: verifyLines.length ? VERIFY_CONTENT_LABEL : undefined,
        ocrCleanup: pipeline.meta,
        warnings: verifyLines.length ? ['OCR_VERIFY_CONTENT'] : [],
        errors: [],
      },
    };
  } catch (err) {
    const fallback = createMinimalResume({
      parseError: String(err?.message || err || 'unknown'),
    });
    const clean = cleanText(rawText);
    if (clean) {
      fallback.summary = clean.slice(0, 1200);
      fallback.unsorted = [clean.slice(0, 4000)];
      fallback.meta.warnings = ['TEXT_FIRST_PARSE_FALLBACK'];
    }
    return fallback;
  }
}
