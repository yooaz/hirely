/**
 * Recruiter-grade text extraction → cvData v2.
 *
 * Detects: name, title, email, phone, location, summary, experience,
 * education, skills, languages, certifications, links.
 * Every field: { value, confidence }. Unknown → additionalSections.
 */
import {
  field,
  listItem,
  objectField,
  emptyCvDataV2,
  finalizeCvDataV2,
  cvDataV2ToLegacy,
  cvDataV2ToResumeData,
  cvDataV2ToTemplateData,
  CVDATA_V2_VERSION,
} from './cv-data-v2.js';
import { extractLockedIdentity, isValidIdentityName, isValidIdentityTitle } from '../parsing/identity-extraction.js';
import {
  scoreIdentityName,
  scoreIdentityTitle,
  scoreIdentityEmail,
  scoreIdentityPhone,
  scoreExperienceConfidence,
  scoreEducationLine,
  scoreSkillLine,
  scoreSummaryLine,
} from '../validation/confidence-gate.js';
import {
  scoreLocationField,
  scoreWebsiteField,
  scoreLinkedInField,
  scoreLanguageField,
  scoreCertificationField,
  scoreExperienceField,
} from './field-confidence-v2.js';
import { postProcessOcrText, looksLikeOcrText } from '../parsing/ocr-postprocess.js';

export const RECRUITER_EXTRACTION_PIPELINE_VERSION = 'RECRUITER_EXTRACTION_PIPELINE_V2';

const SECTION_PATTERNS = Object.freeze({
  summary: /^(profil|profile|summary|résumé|resume|about\s*me|à\s*propos|objective|objectif)\b/i,
  experience:
    /^(expériences?|experience|work\s*history|employment|parcours\s*professionnel|professional\s*experience|emplois?|career)\b/i,
  education: /^(formation|formations|education|études|studies|academic|diplômes?)\b/i,
  skills: /^(compétences|skills|savoir[- ]faire|expertise|technical\s*skills|core\s*competencies)\b/i,
  languages: /^(langues?|languages?|language\s*skills)\b/i,
  certifications:
    /^(certifications?|certificates?|credentials?|licenses?|licences?|accreditations?)\b/i,
  links: /^(links?|liens|portfolio|websites?|sites?|social)\b/i,
});

const EMAIL_RE = /[\w.+-]+@[\w.-]+\.\w{2,}/gi;
const PHONE_RE = /(?:\+?\d[\d\s().-]{7,}\d)/g;
const URL_RE = /(?:https?:\/\/)?(?:www\.)?[\w.-]+\.[a-z]{2,}(?:\/[^\s,)]+)?/gi;
const LINKEDIN_RE = /(?:https?:\/\/)?(?:www\.)?linkedin\.com\/[^\s,)]+/gi;
const DATE_LINE_RE =
  /\b(19|20)\d{2}\s*[-–—]\s*(?:present|actuel|current|aujourd'hui|(19|20)\d{2})\b/i;
const LOCATION_LINE_RE =
  /^[A-ZÀ-ÿ][a-zà-ÿ]+(?:\s+[A-ZÀ-ÿ][a-zà-ÿ]+)*,\s*[A-ZÀ-ÿ][a-zà-ÿ\s-]{2,}$/;

function cleanText(raw) {
  return String(raw ?? '')
    .replace(/\r\n/g, '\n')
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{4,}/g, '\n\n\n')
    .trim();
}

function linesOf(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function sectionKey(line) {
  for (const [key, re] of Object.entries(SECTION_PATTERNS)) {
    if (re.test(line)) return key;
  }
  return null;
}

/**
 * @param {string[]} lines
 */
function splitSections(lines) {
  /** @type {Record<string, string[]>} */
  const buckets = {
    header: [],
    summary: [],
    experience: [],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    links: [],
    body: [],
  };
  let current = 'body';
  const used = new Set();

  for (const line of lines) {
    const key = sectionKey(line);
    if (key) {
      current = key;
      used.add(line);
      continue;
    }
    buckets[current].push(line);
  }

  if (!buckets.header.length) {
    buckets.header = lines.slice(0, Math.min(14, lines.length)).filter((l) => !used.has(l));
  }

  return buckets;
}

/**
 * @param {string} blob
 */
function extractContacts(blob) {
  const emails = [...new Set((blob.match(EMAIL_RE) || []).map((e) => e.trim()))];
  const phones = [...new Set((blob.match(PHONE_RE) || []).map((p) => p.trim()))];
  const linkedins = [...new Set((blob.match(LINKEDIN_RE) || []).map((u) => u.trim()))];
  const urls = [...new Set((blob.match(URL_RE) || []).map((u) => u.trim()))];
  const websites = urls.filter((u) => !/linkedin\.com/i.test(u));

  return {
    email: emails[0] || '',
    phone: phones[0] || '',
    linkedin: linkedins[0] || '',
    website: websites[0] || '',
    allUrls: urls,
  };
}

/**
 * @param {string} line
 */
function detectLocationLine(line) {
  const s = String(line || '').trim();
  if (!s || s.length > 80) return '';
  if (/@|https?:\/\//i.test(s)) return '';
  if (DATE_LINE_RE.test(s)) return '';
  if (/\b(recruiter|manager|engineer|designer|developer|consultant|director)\b/i.test(s) && /\b(19|20)\d{2}\b/.test(s)) {
    return '';
  }
  if (LOCATION_LINE_RE.test(s)) return s;
  if (
    /\b(paris|lyon|london|new york|berlin|amsterdam|brussels|remote|télétravail|teletravail|france|uk|usa)\b/i.test(
      s
    ) &&
    s.length >= 4 &&
    s.length <= 60
  ) {
    return s;
  }
  return '';
}

/**
 * @param {string[]} lines
 */
function parseExperienceEntries(lines) {
  const entries = [];
  let current = null;

  const flush = () => {
    if (current && (current.role || current.company || current.bullets.length)) {
      entries.push(current);
    }
    current = null;
  };

  for (const raw of lines) {
    const line = String(raw || '').trim();
    if (!line) continue;

    const hasDate = DATE_LINE_RE.test(line) || /\b(19|20)\d{2}\b/.test(line);
    const parts = line.split(/\s*[—–-]\s*/).map((p) => p.trim()).filter(Boolean);

    if (hasDate && parts.length >= 2) {
      flush();
      current = {
        role: parts[0] || '',
        company: parts[1] || '',
        dates: parts.slice(2).join(' ') || line.match(DATE_LINE_RE)?.[0] || '',
        bullets: [],
      };
      continue;
    }

    if (/^[-•*▪◦]\s/.test(line)) {
      if (!current) current = { role: '', company: '', dates: '', bullets: [] };
      current.bullets.push(line.replace(/^[-•*▪◦]\s*/, '').trim());
      continue;
    }

    if (!current) {
      current = { role: line, company: '', dates: '', bullets: [] };
    } else if (!current.company && line.length < 80) {
      current.company = line;
    } else {
      current.bullets.push(line);
    }
  }
  flush();

  if (!entries.length && lines.length) {
    return [
      {
        role: '',
        company: '',
        dates: '',
        bullets: lines.map((l) => String(l).replace(/^[-•*▪◦]\s*/, '').trim()).filter(Boolean),
      },
    ];
  }

  return entries.slice(0, 24);
}

function parseListLines(lines) {
  const joined = lines.join(' ');
  const split = joined
    .split(/[,;|•]/)
    .map((s) => s.trim())
    .filter((s) => s.length > 1 && s.length < 80);
  if (split.length >= 2) return split.slice(0, 48);
  return lines
    .map((l) => l.replace(/^[-•*▪◦]\s*/, '').trim())
    .filter(Boolean)
    .slice(0, 48);
}

/**
 * @param {string[]} lines
 * @param {Set<string>} consumed
 */
function collectAdditional(lines, consumed) {
  const orphan = lines.filter((l) => !consumed.has(l));
  if (!orphan.length) return [];
  return [
    {
      title: 'Additional content',
      confidence: 55,
      lines: orphan.map((l) => listItem(l, 50)),
    },
  ];
}

/**
 * Run recruiter extraction on raw text.
 * @param {string} rawText
 * @param {object} [opts]
 */
export function runRecruiterExtractionPipeline(rawText, opts = {}) {
  let text = cleanText(rawText);
  const ocrDetected = opts.ocrDetected ?? looksLikeOcrText(text);
  if (ocrDetected || opts.forceOcrRepair) {
    text = postProcessOcrText(text, { aggressive: opts.aggressiveOcr !== false });
  }

  const v2 = emptyCvDataV2();
  v2.meta.charCount = text.length;
  v2.meta.ocrDetected = ocrDetected;
  v2.meta.extractionMethod = opts.extractionMethod || 'paste';

  if (!text) {
    v2.additionalSections.push({
      title: 'Empty document',
      confidence: 0,
      lines: [listItem('', 0)],
    });
    return finalizePipelineResult(v2, text, opts);
  }

  const lines = linesOf(text);
  v2.meta.linesTotal = lines.length;
  const consumed = new Set();
  const buckets = splitSections(lines);
  const contacts = extractContacts(text);

  const locked = extractLockedIdentity(lines, {
    headerLines: buckets.header.length ? buckets.header : lines.slice(0, 12),
    contact: { email: contacts.email, phone: contacts.phone },
  });

  const nameVal =
    locked.name && isValidIdentityName(locked.name)
      ? locked.name
      : lines.find((l) => isValidIdentityName(l) && l.length < 72) || '';
  const titleVal =
    locked.title && isValidIdentityTitle(locked.title)
      ? locked.title
      : lines.slice(1, 5).find((l) => isValidIdentityTitle(l)) || '';

  if (nameVal) consumed.add(nameVal);
  if (titleVal) consumed.add(titleVal);

  v2.name = field(nameVal, nameVal ? scoreIdentityName(nameVal, []) : 0);
  v2.title = field(titleVal, titleVal ? scoreIdentityTitle(titleVal) : 0);

  if (contacts.email) {
    consumed.add(contacts.email);
    v2.email = field(contacts.email, scoreIdentityEmail(contacts.email));
  }
  if (contacts.phone) {
    consumed.add(contacts.phone);
    v2.phone = field(contacts.phone, scoreIdentityPhone(contacts.phone));
  }

  for (const line of [...buckets.header, ...lines.slice(0, 8)]) {
    const loc = detectLocationLine(line);
    if (loc && !v2.location.value) {
      consumed.add(line);
      v2.location = field(loc, scoreLocationField(loc));
      break;
    }
  }

  const summaryText = buckets.summary.join('\n').trim();
  if (summaryText) {
    buckets.summary.forEach((l) => consumed.add(l));
    v2.summary = field(summaryText.slice(0, 2000), scoreSummaryLine(summaryText));
  }

  const expEntries = parseExperienceEntries(buckets.experience);
  buckets.experience.forEach((l) => consumed.add(l));
  v2.experience = expEntries.map((exp) =>
    objectField(exp, scoreExperienceField(exp))
  );

  buckets.education.forEach((l) => consumed.add(l));
  v2.education = parseListLines(buckets.education).map((line) =>
    listItem(line, scoreEducationLine(line))
  );

  buckets.skills.forEach((l) => consumed.add(l));
  v2.skills = parseListLines(buckets.skills).map((line) =>
    listItem(line, scoreSkillLine(line))
  );

  buckets.languages.forEach((l) => consumed.add(l));
  v2.languages = parseListLines(buckets.languages).map((line) =>
    listItem(line, scoreLanguageField(line))
  );

  buckets.certifications.forEach((l) => consumed.add(l));
  v2.certifications = parseListLines(buckets.certifications).map((line) =>
    listItem(line, scoreCertificationField(line))
  );

  const linkItems = [];
  if (contacts.linkedin) {
    linkItems.push({
      value: { type: 'linkedin', url: contacts.linkedin, label: 'LinkedIn' },
      confidence: scoreLinkedInField(contacts.linkedin),
    });
  }
  if (contacts.website) {
    linkItems.push({
      value: { type: 'website', url: contacts.website, label: 'Website' },
      confidence: scoreWebsiteField(contacts.website),
    });
  }
  for (const url of contacts.allUrls) {
    if (linkItems.some((l) => l.value.url === url)) continue;
    linkItems.push({
      value: { type: 'link', url, label: url.replace(/^https?:\/\//i, '').slice(0, 48) },
      confidence: scoreWebsiteField(url),
    });
  }
  buckets.links.forEach((l) => consumed.add(l));
  v2.links = linkItems.slice(0, 12).map((l) => ({
    value: l.value,
    confidence: l.confidence,
  }));

  if (!v2.summary.value && buckets.body.length) {
    const bodySummary = buckets.body.slice(0, 6).join('\n').trim();
    if (bodySummary.length >= 40) {
      v2.summary = field(bodySummary.slice(0, 1200), scoreSummaryLine(bodySummary) - 8);
      buckets.body.slice(0, 6).forEach((l) => consumed.add(l));
    }
  }

  v2.additionalSections = collectAdditional(lines, consumed);
  v2.meta.linesCaptured = consumed.size;

  return finalizePipelineResult(v2, text, opts);
}

function finalizePipelineResult(v2, rawText, opts) {
  finalizeCvDataV2(v2);
  const legacy = cvDataV2ToLegacy(v2);
  const resumeData = cvDataV2ToResumeData(v2);
  const templateData = cvDataV2ToTemplateData(v2);

  return {
    version: RECRUITER_EXTRACTION_PIPELINE_VERSION,
    cvDataV2: v2,
    cvData: legacy,
    resumeData,
    templateData,
    rawText,
    metrics: {
      overallConfidence: v2.meta.overallConfidence,
      fieldsScored: v2.meta.fieldsScored,
      linesTotal: v2.meta.linesTotal,
      linesCaptured: v2.meta.linesCaptured,
      additionalSections: v2.additionalSections.length,
    },
    success: !!(v2.name.value || v2.experience.length || v2.summary.value),
    partial: !v2.name.value || v2.meta.overallConfidence < 70,
  };
}

export { CVDATA_V2_VERSION };
