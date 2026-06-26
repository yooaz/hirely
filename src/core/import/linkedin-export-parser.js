/**
 * Parse LinkedIn profile data export (JSON / CSV fragments).
 */

import { emptyResumeData } from '../resume-data.js';

function clean(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function pick(obj, keys) {
  if (!obj || typeof obj !== 'object') return '';
  for (const k of keys) {
    if (obj[k] != null && String(obj[k]).trim()) return clean(obj[k]);
  }
  return '';
}

function normalizeDates(start, end) {
  const s = clean(start);
  const e = clean(end);
  if (!s && !e) return '';
  const endNorm = /present|présent|current|now/i.test(e) ? 'Present' : e;
  if (s && endNorm) return `${s} – ${endNorm}`;
  return s || endNorm;
}

/**
 * LinkedIn exports use Title Case keys in JSON arrays.
 * @param {unknown} raw
 */
export function parseLinkedInExportPayload(raw) {
  const out = {
    profile: null,
    positions: [],
    skills: [],
    education: [],
    languages: [],
  };

  if (!raw) return out;

  if (Array.isArray(raw)) {
    const sample = raw[0] || {};
    const keys = Object.keys(sample).join(' ').toLowerCase();
    if (/first name|last name|headline/.test(keys)) out.profile = sample;
    else if (/company name|title|started on/.test(keys)) out.positions = raw;
    else if (/school name|degree name/.test(keys)) out.education = raw;
    else if (/name/.test(keys) && keys.length < 24) out.skills = raw;
    return out;
  }

  if (typeof raw === 'object') {
    for (const [k, v] of Object.entries(raw)) {
      const key = k.toLowerCase();
      if (!Array.isArray(v)) continue;
      if (/profile/i.test(key)) out.profile = v[0] || null;
      else if (/position|experience/i.test(key)) out.positions = v;
      else if (/skill/i.test(key)) out.skills = v;
      else if (/education/i.test(key)) out.education = v;
      else if (/language/i.test(key)) out.languages = v;
    }
    if (!out.profile && (raw['First Name'] || raw.firstName)) out.profile = raw;
  }

  return out;
}

/**
 * @param {string} text
 * @param {string} [fileName]
 */
export function parseLinkedInExportText(text, fileName = '') {
  const trimmed = String(text || '').trim();
  if (!trimmed) return null;

  if (trimmed.startsWith('{') || trimmed.startsWith('[')) {
    try {
      const data = JSON.parse(trimmed);
      return parseLinkedInExportPayload(data);
    } catch {
      return null;
    }
  }

  if (/\.csv$/i.test(fileName) || trimmed.includes(',') && trimmed.includes('\n')) {
    return parseLinkedInCsv(trimmed);
  }

  return null;
}

function parseLinkedInCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim());
  if (lines.length < 2) return null;
  const headers = splitCsvLine(lines[0]).map((h) => h.trim());
  const rows = lines.slice(1).map((line) => {
    const cols = splitCsvLine(line);
    const row = {};
    headers.forEach((h, i) => {
      row[h] = cols[i] != null ? cols[i].trim() : '';
    });
    return row;
  });
  return parseLinkedInExportPayload(rows);
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const ch = line[i];
    if (ch === '"') {
      inQ = !inQ;
      continue;
    }
    if (ch === ',' && !inQ) {
      out.push(cur);
      cur = '';
      continue;
    }
    cur += ch;
  }
  out.push(cur);
  return out;
}

/**
 * @param {ReturnType<typeof parseLinkedInExportPayload>} parsed
 */
export function resumeDataFromLinkedInExport(parsed) {
  const base = emptyResumeData();
  if (!parsed) return base;

  const p = parsed.profile || {};
  const first = pick(p, ['First Name', 'firstName', 'first_name']);
  const last = pick(p, ['Last Name', 'lastName', 'last_name']);
  const name = clean([first, last].filter(Boolean).join(' '));
  const title = pick(p, ['Headline', 'headline', 'Title', 'title']);
  const summary = pick(p, ['Summary', 'summary', 'About', 'about']);
  const location = pick(p, ['Location', 'location', 'Geo Location', 'geoLocation']);
  const email = pick(p, ['Email Address', 'email', 'Email']);
  const linkedin = pick(p, ['Profile Url', 'Profile URL', 'linkedin', 'Public Profile Url']);

  base.identity = {
    ...base.identity,
    name: name || base.identity.name,
    title: title || base.identity.title,
    email: email || base.identity.email,
    location: location || base.identity.location,
    linkedin: linkedin || base.identity.linkedin,
  };
  if (summary) base.summary = summary;

  for (const pos of parsed.positions || []) {
    const role = pick(pos, ['Title', 'title', 'Position', 'position']);
    const company = pick(pos, ['Company Name', 'company', 'Company', 'companyName']);
    const dates = normalizeDates(
      pick(pos, ['Started On', 'startDate', 'Start Date']),
      pick(pos, ['Finished On', 'endDate', 'End Date'])
    );
    const desc = pick(pos, ['Description', 'description']);
    const bullets = desc ? desc.split(/\n+/).map(clean).filter((l) => l.length > 8) : [];
    if (!role && !company) continue;
    base.experiences.push({
      role: role || company,
      company: company || '',
      dates,
      startDate: pick(pos, ['Started On', 'startDate', 'Start Date']),
      endDate: pick(pos, ['Finished On', 'endDate', 'End Date']),
      bullets: bullets.slice(0, 8),
      description: desc,
    });
  }

  for (const edu of parsed.education || []) {
    const school = pick(edu, ['School Name', 'school', 'School', 'schoolName']);
    const degree = pick(edu, ['Degree Name', 'degree', 'Degree', 'degreeName']);
    const field = pick(edu, ['Field Of Study', 'fieldOfStudy', 'Field of Study']);
    const dates = normalizeDates(
      pick(edu, ['Start Date', 'startDate']),
      pick(edu, ['End Date', 'endDate'])
    );
    const line = [school, degree || field, dates].filter(Boolean).join(' — ');
    if (line) base.education.push(line);
  }

  for (const sk of parsed.skills || []) {
    const label = typeof sk === 'string' ? sk : pick(sk, ['Name', 'name', 'Skill', 'skill']);
    if (label) base.skills.push(label);
  }

  for (const lang of parsed.languages || []) {
    const label =
      typeof lang === 'string'
        ? lang
        : [pick(lang, ['Name', 'name']), pick(lang, ['Proficiency', 'proficiency'])].filter(Boolean).join(' — ');
    if (label) base.languages.push(label);
  }

  base.meta = { ...(base.meta || {}), linkedInExport: true, source: 'linkedin_export' };
  return base;
}
