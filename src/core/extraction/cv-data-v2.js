/**
 * cvData v2 — every field carries { value, confidence } (0–100).
 * Unknown / low-trust content is preserved in additionalSections (never lost).
 */
import { resumeDataToCvData } from '../resume-data.js';

export const CVDATA_V2_VERSION = 'CVDATA_V2';

/** @typedef {{ value: string, confidence: number }} ScalarFieldV2 */
/** @typedef {{ value: object, confidence: number }} ObjectFieldV2 */
/** @typedef {{ value: string, confidence: number }} ListItemV2 */
/** @typedef {{ type: string, url: string, label?: string }} LinkValue */
/** @typedef {{ title: string, confidence: number, lines: ListItemV2[] }} AdditionalSectionV2 */

/**
 * @param {string} value
 * @param {number} confidence
 * @returns {ScalarFieldV2}
 */
export function field(value, confidence = 0) {
  return {
    value: String(value ?? '').trim(),
    confidence: Math.max(0, Math.min(100, Math.round(Number(confidence) || 0))),
  };
}

/**
 * @param {object} value
 * @param {number} confidence
 * @returns {ObjectFieldV2}
 */
export function objectField(value, confidence = 0) {
  return {
    value: value && typeof value === 'object' ? value : {},
    confidence: Math.max(0, Math.min(100, Math.round(Number(confidence) || 0))),
  };
}

/**
 * @param {string} value
 * @param {number} confidence
 * @returns {ListItemV2}
 */
export function listItem(value, confidence = 0) {
  return field(value, confidence);
}

/** Empty cvData v2 shell. */
export function emptyCvDataV2() {
  return {
    version: CVDATA_V2_VERSION,
    name: field(''),
    title: field(''),
    email: field(''),
    phone: field(''),
    location: field(''),
    summary: field(''),
    experience: [],
    education: [],
    skills: [],
    languages: [],
    certifications: [],
    links: [],
    additionalSections: [],
    meta: {
      engine: 'recruiter-extraction-pipeline',
      charCount: 0,
      linesTotal: 0,
      linesCaptured: 0,
      overallConfidence: 0,
    },
  };
}

/**
 * Flatten scalar/list fields for legacy cvData / templates.
 * @param {object} v2
 */
export function cvDataV2ToLegacy(v2 = {}) {
  const pick = (f) => (f && typeof f === 'object' && 'value' in f ? String(f.value || '') : String(f || ''));
  const pickList = (arr) =>
    (arr || []).map((item) =>
      item && typeof item === 'object' && 'value' in item ? String(item.value || '') : String(item || '')
    );

  const experience = (v2.experience || []).map((item) => {
    const val = item?.value && typeof item.value === 'object' ? item.value : {};
    return {
      role: String(val.role || ''),
      company: String(val.company || ''),
      dates: String(val.dates || ''),
      bullets: Array.isArray(val.bullets) ? val.bullets.map(String) : [],
      _confidence: item?.confidence ?? 0,
    };
  });

  const links = v2.links || [];
  let linkedin = '';
  let portfolio = '';
  for (const link of links) {
    const url = String(link?.value?.url || link?.value || '').trim();
    if (!url) continue;
    if (/linkedin\.com/i.test(url) && !linkedin) linkedin = url;
    else if (!portfolio) portfolio = url;
  }

  const additionalUnsorted = (v2.additionalSections || []).flatMap((sec) =>
    (sec.lines || []).map((l) => String(l?.value || l || '').trim()).filter(Boolean)
  );

  return {
    name: pick(v2.name),
    title: pick(v2.title) || 'Profil professionnel',
    email: pick(v2.email),
    phone: pick(v2.phone),
    location: pick(v2.location),
    summary: pick(v2.summary),
    linkedin,
    portfolio,
    experience,
    education: pickList(v2.education),
    skills: pickList(v2.skills),
    tools: [],
    languages: pickList(v2.languages),
    certifications: pickList(v2.certifications),
    clients: [],
    projects: [],
    awards: [],
    unsorted: additionalUnsorted,
    cvDataV2: v2,
    meta: {
      ...(v2.meta || {}),
      cvDataVersion: CVDATA_V2_VERSION,
    },
  };
}

/**
 * cvData v2 → resumeData (for review pipeline).
 * @param {object} v2
 */
export function cvDataV2ToResumeData(v2 = {}) {
  const legacy = cvDataV2ToLegacy(v2);
  return {
    identity: {
      name: legacy.name,
      title: legacy.title,
      email: legacy.email,
      phone: legacy.phone,
      location: legacy.location,
      website: legacy.portfolio,
      linkedin: legacy.linkedin,
    },
    summary: legacy.summary,
    experiences: legacy.experience,
    education: legacy.education.map((line) => ({
      degree: line,
      school: '',
      dates: '',
      bullets: [],
    })),
    skills: legacy.skills,
    tools: legacy.tools,
    languages: legacy.languages,
    certifications: legacy.certifications,
    clients: [],
    projects: [],
    awards: [],
    unsorted: legacy.unsorted,
    meta: {
      cvDataVersion: CVDATA_V2_VERSION,
      overallConfidence: v2.meta?.overallConfidence ?? 0,
      recruiterPipeline: true,
    },
  };
}

/**
 * Attach overall confidence from all scored fields.
 * @param {object} v2
 */
export function finalizeCvDataV2(v2 = {}) {
  const scores = [];

  const pushScalar = (f) => {
    if (f?.value) scores.push(f.confidence || 0);
  };
  pushScalar(v2.name);
  pushScalar(v2.title);
  pushScalar(v2.email);
  pushScalar(v2.phone);
  pushScalar(v2.location);
  pushScalar(v2.summary);

  for (const arr of [
    v2.experience,
    v2.education,
    v2.skills,
    v2.languages,
    v2.certifications,
    v2.links,
  ]) {
    for (const item of arr || []) {
      if (item?.value) scores.push(item.confidence || 0);
    }
  }

  for (const sec of v2.additionalSections || []) {
    if (sec.confidence) scores.push(sec.confidence);
    for (const line of sec.lines || []) {
      if (line?.value) scores.push(line.confidence || 0);
    }
  }

  const overall = scores.length
    ? Math.round(scores.reduce((a, b) => a + b, 0) / scores.length)
    : 0;

  v2.meta = {
    ...(v2.meta || {}),
    overallConfidence: overall,
    fieldsScored: scores.length,
    at: new Date().toISOString(),
  };

  return v2;
}

/**
 * Build template cvData via existing normalizer.
 * @param {object} v2
 */
export function cvDataV2ToTemplateData(v2 = {}) {
  const rd = cvDataV2ToResumeData(v2);
  return resumeDataToCvData(rd, { skipNormalize: true });
}
