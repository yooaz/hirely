/**
 * Direct structured resume → cvData (no graph engine).
 * Product recovery path — single deterministic mapping for templates/export.
 */

import {
  NAME_UNCERTAIN_LABEL,
  TITLE_UNCERTAIN_LABEL,
} from './parser-recovery.js';
import { stripTemplateCvData } from '../pipeline/hirely-flow-lock.js';
import { extractDateRangeFromText } from './parser-recovery.js';
import { parseFreelanceCareerLine, parseInternshipLine, parseDashSeparatedExperienceLine } from './classification-fixes.js';
import { logRenderPipelineCounts } from '../runtime/render-pipeline-trace.js';

const ACTION_LINE_RE =
  /\b(created|built|designed|managed|led|delivered|developed|implemented|launched|optimized|improved|increased|reduced|grew|achieved|collaborated|créé|conçu|dirigé|géré|livré|augmenté|réduit)\b/i;

function expToLine(e) {
  if (!e || typeof e !== 'object') return '';
  const dates = String(e.dates || e.dateRange || '').trim();
  const range =
    dates ||
    [e.startDate, e.endDate].filter(Boolean).join('–');
  const head = [e.role, e.company, range].map((x) => String(x || '').trim()).filter(Boolean).join(' — ');
  const desc = String(e.rewrittenDescription || e.description || '').trim();
  const bulletList = (e.bullets || [])
    .map((b) => String(b || '').trim().slice(0, 320))
    .filter((b) => b && b.length >= 2);
  const bulletText = bulletList.join(' ');
  const preferBullets =
    bulletList.length > 0 &&
    (!desc ||
      bulletText.length > desc.length ||
      (ACTION_LINE_RE.test(bulletText) && !ACTION_LINE_RE.test(desc)));
  const bullets = preferBullets ? bulletList : desc ? [desc] : bulletList;
  if (!head && !bullets.length) return '';
  return bullets.length ? `${head}: ${bullets.join(' · ')}` : head;
}

function expToRenderable(e) {
  if (!e || typeof e !== 'object') return '';
  const role = String(e.role || '').trim().slice(0, 120);
  const company = String(e.company || '').trim().slice(0, 120);
  const cleaned = { ...e, role, company };
  if (Array.isArray(e.specialties) && e.specialties.length && (role || company)) {
    return cleaned;
  }
  return expToLine(cleaned);
}

/**
 * Reverse of expToLine — cvData.experience string → structured experience entry.
 * @param {string|object} line
 */
export function legacyExperienceLineToEntry(line) {
  if (line && typeof line === 'object') {
    const role = String(line.role || '').trim();
    const company = String(line.company || '').trim();
    if (role || company) {
      return {
        role,
        company,
        location: String(line.location || '').trim(),
        startDate: String(line.startDate || '').trim(),
        endDate: String(line.endDate || '').trim(),
        dates: String(line.dates || '').trim(),
        bullets: Array.isArray(line.bullets)
          ? line.bullets.map((b) => String(b || '').trim()).filter(Boolean)
          : [],
        clients: Array.isArray(line.clients) ? line.clients : [],
        specialties: Array.isArray(line.specialties) ? line.specialties : [],
        description: String(line.description || '').trim(),
        rewrittenDescription: String(line.rewrittenDescription || '').trim(),
        sourceLines: line.sourceLines || [],
        sourceLineId: line.sourceLineId || '',
      };
    }
  }

  const s = String(line || '').trim();
  if (!s) return null;

  const dash = parseDashSeparatedExperienceLine(s);
  if (dash) {
    return { ...dash, clients: [], location: dash.location || '' };
  }

  const freelance = parseFreelanceCareerLine(s);
  if (freelance) {
    return { ...freelance, clients: freelance.clients || [], location: '' };
  }

  const internship = parseInternshipLine(s);
  if (internship) {
    return { ...internship, clients: [], location: '' };
  }

  let bullets = [];
  let head = s;
  const colonIdx = s.lastIndexOf(':');
  if (colonIdx > 0) {
    const before = s.slice(0, colonIdx).trim();
    const after = s.slice(colonIdx + 1).trim();
    if (after && !/^:\s*\d/.test(s.slice(colonIdx))) {
      head = before;
      bullets = after.split(/\s*·\s*/).map((b) => b.trim()).filter(Boolean);
    }
  }

  const parts = head.split(/\s*—\s*/).map((p) => p.trim()).filter(Boolean);
  let role = '';
  let company = '';
  let dates = '';

  if (parts.length >= 3) {
    role = parts[0];
    company = parts[1];
    dates = parts.slice(2).join(' — ');
  } else if (parts.length === 2) {
    const dr = extractDateRangeFromText(parts[1]);
    if (dr.startDate) {
      role = parts[0];
      dates = parts[1];
    } else {
      role = parts[0];
      company = parts[1];
    }
  } else {
    role = head;
  }

  const dr = extractDateRangeFromText(dates || head);
  const startDate = dr.startDate || '';
  const endDate = dr.endDate || (startDate ? 'Present' : '');
  const dateLabel = dates || (startDate ? `${startDate}–${endDate}` : '');

  return {
    role: role.slice(0, 120),
    company: company.slice(0, 120),
    location: '',
    startDate,
    endDate,
    dates: dateLabel,
    bullets,
    clients: [],
  };
}

/**
 * @param {object} structured
 * @returns {object}
 */
export function simpleCvDataFromStructured(structured) {
  const s = structured || {};
  const id = s.identity || {};

  const experiences = [];
  for (const raw of Array.isArray(s.experiences) ? s.experiences : []) {
    if (typeof raw === 'string') {
      const line = String(raw).trim().slice(0, 280);
      if (line) experiences.push(line);
      continue;
    }
    if (!raw || typeof raw !== 'object') continue;
    const role = String(raw.role || '').trim().slice(0, 120);
    const company = String(raw.company || '').trim().slice(0, 120);
    if (Array.isArray(raw.specialties) && raw.specialties.length && (role || company)) {
      experiences.push({ ...raw, role, company });
      continue;
    }
    const dates = String(raw.dates || [raw.startDate, raw.endDate].filter(Boolean).join('–') || '').trim();
    const head = [role, company, dates].filter(Boolean).join(' — ');
    const desc = String(raw.rewrittenDescription || raw.description || '').trim().slice(0, 320);
    let body = '';
    if (Array.isArray(raw.bullets) && raw.bullets.length) {
      const parts = [];
      for (const b of raw.bullets) {
        const t = String(b || '').trim().slice(0, 200);
        if (t.length >= 2) parts.push(t);
      }
      body = parts.join(' · ');
    } else if (desc) {
      body = desc;
    }
    if (!head && !body) continue;
    experiences.push(body ? `${head}: ${body}` : head);
  }

  const list = (arr) => {
    const out = [];
    for (const x of Array.isArray(arr) ? arr : []) {
      const t = String(x || '').trim().slice(0, 120);
      if (t.length >= 2) out.push(t);
    }
    return out;
  };

  const educationList = (arr) => {
    const out = [];
    for (const x of Array.isArray(arr) ? arr : []) {
      if (typeof x === 'string') {
        const t = String(x).trim().slice(0, 200);
        if (t.length >= 2) out.push(t);
        continue;
      }
      if (!x || typeof x !== 'object') continue;
      const bits = [x.degree, x.school, x.field, x.program, x.dates, x.startDate, x.endDate]
        .map((v) => String(v || '').trim())
        .filter(Boolean);
      const line = bits.join(' — ').trim().slice(0, 200);
      if (line.length >= 2) out.push(line);
    }
    return out;
  };

  const rawName = String(id.name || '').trim();
  const rawTitle = String(id.title || '').trim();

  const cv = {
    name: rawName || NAME_UNCERTAIN_LABEL,
    title: rawTitle || TITLE_UNCERTAIN_LABEL,
    email: String(id.email || '').trim(),
    phone: String(id.phone || '').trim(),
    linkedin: String(id.linkedin || '').trim(),
    portfolio: String(id.website || id.portfolio || '').trim(),
    location: String(id.location || '').trim(),
    summary: String(s.summary || '').trim(),
    experience: experiences,
    education: educationList(s.education),
    skills: list(s.skills),
    tools: list(s.tools),
    languages: list(s.languages),
    clients: list(s.clients),
    projects: list(s.projects),
    exhibitions: list(s.exhibitions),
    awards: list(s.awards),
    publications: list(s.publications),
    press: list(s.press),
    portfolioLinks: list(s.portfolioLinks),
    extra: [],
    interests: [],
    unsorted: [],
    toClassify: [],
    unknownExperience: [],
  };

  /** ResumeData → cvData is already normalized; skip heavy normalizeCvData (browser stack). */
  const out = stripTemplateCvData({ ...cv, _fromResumeData: true, _experienceReconstructed: true });
  logRenderPipelineCounts('CVDATA_COUNTS', out);
  return out;
}
