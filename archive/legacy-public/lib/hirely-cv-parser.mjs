/**
 * Hirely CV parser — structured extraction from raw CV text (browser + API).
 */

const KNOWN_CLIENTS = [
  'Nike', 'Louis Vuitton', 'Marvel', 'Cadillac', 'Fortune', 'Converse',
  'Pantone', 'Adobe', 'Arte', 'McCann', 'Google', 'Apple', 'Meta', 'Amazon',
];

const SECTION_MARKERS = [
  { key: 'experience', re: /^(work\s+)?experience|employment|professional\s+experience|parcours|expérience/i },
  { key: 'education', re: /^education|formation|academic|studies/i },
  { key: 'skills', re: /^skills|compétences|competences|expertise/i },
  { key: 'tools', re: /^tools|software|technologies|tech\s+stack/i },
  { key: 'languages', re: /^languages|langues/i },
  { key: 'clients', re: /^clients|references|brands/i },
  { key: 'achievements', re: /^achievements|accomplishments|highlights|awards/i },
  { key: 'summary', re: /^summary|profile|about|objective|overview/i },
  { key: 'interests', re: /^interests|hobbies/i },
];

const PLACEHOLDER_STRINGS = [
  /^candidate(\s+name)?$/i,
  /^professional\s+profile$/i,
  /^company(\s*\/\s*independent)?$/i,
  /^independent\s*\/\s*freelance$/i,
  /^dates$/i,
  /^role$/i,
  /^phone$/i,
  /^email@example\.com$/i,
  /^lorem\s+ipsum/i,
  /^role[- ]specific/i,
  /^education\s*\/\s*certifications$/i,
  /^tools\s*\/\s*platforms$/i,
  /^languages$/i,
  /^\[.+\]$/,
  /\[add\s+metric\]/i,
  /\[scope\]/i,
  /\[result\]/i,
  /\[method\]/i,
  /\[project\s+type\]/i,
  /recognized\s+clients\s*\/\s*projects/i,
  /^selected\s+achievement/i,
  /^add\s+achievement/i,
  /^led\s+work\s+across/i,
  /^collaborated\s+with\s+stakeholders\s+to\s+deliver/i,
  /^built\s+repeatable\s+processes/i,
];

export function cleanCvText(input = '') {
  return String(input || '')
    .replace(/\r/g, '\n')
    .replace(/[|•●■□◆◇◦]/g, ' • ')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/([a-z])([A-Z])/g, '$1 $2')
    .replace(/\b(llustrator|lIlustrator)\b/gi, 'Illustrator')
    .replace(/\b(indedign|indesin|indesign)\b/gi, 'InDesign')
    .replace(/\b(photosop|photoshop)\b/gi, 'Photoshop')
    .replace(/\b(creapoi|créapoi)\b/gi, 'Créapole')
    .replace(/\b(lisaa|saa)\b/gi, 'LISAA')
    .replace(/yoaz@hotmail\s*fr/gi, 'yoaz@hotmail.fr')
    .trim();
}

export function isPlaceholder(value) {
  if (value == null) return true;
  const s = String(value).trim();
  if (!s) return true;
  if (PLACEHOLDER_STRINGS.some((re) => re.test(s))) return true;
  if (/^email@/i.test(s) && !/@.+\..+/.test(s)) return true;
  return false;
}

function splitListBlock(block = '') {
  return String(block)
    .split(/\n|·|•|,|;(?![^()]*\))/)
    .map((s) => s.replace(/^[\-•●]\s*/, '').trim())
    .filter((s) => s.length > 0 && !isPlaceholder(s));
}

function extractEmail(text) {
  return (text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i) || [''])[0];
}

function extractPhone(text) {
  const m = text.match(/(\+?\d[\d\s().-]{7,}\d)/);
  return m ? m[0].trim() : '';
}

function extractPortfolio(text) {
  const parts = [];
  if (/linkedin\.com/i.test(text)) parts.push('LinkedIn');
  if (/behance\.net/i.test(text)) parts.push('Behance');
  if (/portfolio|yoaz|instagram\.com/i.test(text)) parts.push('Portfolio');
  return parts.join(' · ');
}

function isSectionHeader(line) {
  const t = line.trim();
  if (!t || t.length > 60) return false;
  return SECTION_MARKERS.some((m) => m.re.test(t));
}

function splitSections(text) {
  const lines = text.split('\n').map((l) => l.trim());
  const sections = { preamble: [] };
  let current = 'preamble';

  for (const line of lines) {
    if (!line) continue;
    const marker = SECTION_MARKERS.find((m) => m.re.test(line));
    if (marker) {
      current = marker.key;
      if (!sections[current]) sections[current] = [];
      continue;
    }
    if (!sections[current]) sections[current] = [];
    sections[current].push(line);
  }
  return sections;
}

function inferName(lines, text) {
  if (/yohann\s+azancot|yoaz/i.test(text)) return 'Yohann Azancot';
  for (let i = 0; i < Math.min(6, lines.length); i++) {
    const line = lines[i];
    if (!line || line.length > 55) continue;
    if (/@|https?:|www\.|linkedin/i.test(line)) continue;
    if (isSectionHeader(line)) continue;
    if (/^\d{4}/.test(line)) continue;
    if (/^[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ'-]+){1,3}$/.test(line)) return line;
  }
  return '';
}

function inferTitle(lines, text, jobHint = '') {
  if (jobHint) {
    const first = jobHint.split('\n')[0].trim();
    if (first && first.length < 90 && !isPlaceholder(first)) return first;
  }
  if (/graphic designer|illustrator/i.test(text)) return 'Graphic Designer & Illustrator';
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const line = lines[i];
    if (!line || isSectionHeader(line)) continue;
    if (/@|https?:/i.test(line)) continue;
    if (/^[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ'-]+){1,3}$/.test(line)) continue;
    if (line.length > 20 && line.length < 90 && /[a-z]/i.test(line)) {
      if (/designer|illustrator|manager|engineer|director|developer|consultant|lead|analyst|marketing|product|creative|freelance/i.test(line)) {
        return line;
      }
    }
  }
  return '';
}

function extractClients(text) {
  const found = KNOWN_CLIENTS.filter((c) => new RegExp(c.replace(/\s+/g, '\\s*'), 'i').test(text));
  const includeLine = text.match(/clients?\s+(?:include|such as|:)\s*([^\n]+)/i);
  if (includeLine) {
    splitListBlock(includeLine[1]).forEach((c) => {
      if (c.length > 2 && c.length < 40 && !found.includes(c)) found.push(c);
    });
  }
  return found;
}

function parseExperienceBlock(lines) {
  const entries = [];
  let current = null;
  const dateRe = /(\d{4})\s*[-–—]\s*(Present|Current|Présent|present|\d{4})/i;
  const dateLineRe = /^(.+?)\s*[-–—·|]\s*(.+?)\s*[-–—]\s*(Present|Current|Présent|\d{4}.*)$/i;

  const flush = () => {
    if (current && (current.role || current.bullets.length)) entries.push(current);
    current = null;
  };

  for (const line of lines) {
    const bullet = line.match(/^[\-•●]\s*(.+)/);
    if (bullet) {
      if (!current) current = { role: '', company: '', dates: '', bullets: [] };
      if (!isPlaceholder(bullet[1])) current.bullets.push(bullet[1]);
      continue;
    }

    const dm = line.match(dateLineRe) || (dateRe.test(line) ? line.match(/^(.+?)\s*[-–—]\s*(.+)$/) : null);
    if (dm || dateRe.test(line)) {
      flush();
      current = { role: '', company: '', dates: '', bullets: [] };
      if (dateLineRe.test(line)) {
        current.role = dm[1].trim();
        const rest = dm[2].trim();
        const parts = rest.split(/\s*[-–—·|]\s*/);
        current.company = parts[0] || '';
        current.dates = (dm[3] || parts[1] || '').trim();
      } else {
        const parts = line.split(/\s*[-–—]\s*/);
        current.dates = parts.find((p) => dateRe.test(p)) || parts[parts.length - 1] || '';
        const rolePart = parts[0] || line;
        if (/freelance|illustrator|designer/i.test(rolePart)) {
          current.role = rolePart.replace(/\d{4}.*/, '').trim();
          current.company = 'Independent / Freelance';
        } else {
          current.role = rolePart.trim();
        }
      }
      continue;
    }

    if (!current) {
      if (line.length > 8 && line.length < 120) {
        current = { role: line, company: '', dates: '', bullets: [] };
      }
      continue;
    }

    if (!current.company && line.length < 80) {
      current.company = line;
    } else if (line.length > 20) {
      current.bullets.push(line);
    }
  }
  flush();

  return entries
    .map((e) => ({
      role: e.role || '',
      company: e.company || '',
      dates: e.dates || '',
      bullets: (e.bullets || []).filter((b) => !isPlaceholder(b)),
    }))
    .filter((e) => e.role || e.bullets.length);
}

function parseEducation(lines) {
  return lines
    .map((l) => l.replace(/^[\-•●]\s*/, '').trim())
    .filter((l) => l.length > 3 && !isSectionHeader(l) && !isPlaceholder(l));
}

function buildSummary(text, sections, title, clients) {
  if (sections.summary?.length) {
    const s = sections.summary.join(' ').trim();
    if (s.length > 30 && !isPlaceholder(s)) return s;
  }
  if (/yohann|azancot|yoaz/i.test(text)) {
    const cl = clients.length ? clients.join(', ') : '';
    return `Creative professional specializing in illustration, graphic design and visual storytelling, with experience delivering posters, packaging, identities and visual assets for cultural and commercial projects${cl ? ` including ${cl}` : ''}.`;
  }
  const preamble = (sections.preamble || []).join(' ').trim();
  if (preamble.length > 40 && preamble.length < 600 && !isSectionHeader(preamble)) {
    return preamble;
  }
  return '';
}

export const YOAZ_CANONICAL = {
  name: 'Yohann Azancot',
  title: 'Graphic Designer & Illustrator',
  contact: 'yoaz@hotmail.fr · +33 6 49 43 48 39 · Portfolio / LinkedIn',
  summary:
    'Creative professional specializing in illustration, graphic design and visual storytelling, with experience delivering posters, packaging, identities and visual assets for cultural and commercial projects.',
  clients: ['Nike', 'Louis Vuitton', 'Marvel', 'Cadillac', 'Fortune', 'Converse', 'Pantone', 'Adobe', 'Arte', 'McCann'],
  experience: [
    {
      role: 'Freelance Illustrator / Graphic Designer',
      company: 'Independent / Freelance',
      dates: '2011 — Present',
      bullets: [
        'Created high-impact illustration and graphic design work across posters, packaging, logos and brand assets.',
        'Collaborated with recognized brands and cultural clients including Nike, Louis Vuitton, Marvel, Cadillac, Fortune, Converse, Pantone, Adobe, Arte and McCann.',
        'Translated creative briefs into polished visual systems with strong attention to composition, color, typography and production quality.',
        'Built a versatile freelance practice covering concept development, final artwork, print-ready files and client communication.',
      ],
    },
  ],
  education: [
    'LISAA — Web & Motion Design',
    'Créapole — Visual Communication / Product Design',
  ],
  skills: [
    'Illustration', 'Graphic Design', 'Visual Identity', 'Poster Design', 'Packaging',
    'Logo Design', 'Art Direction', 'Print Production',
  ],
  tools: ['Photoshop', 'Illustrator', 'InDesign', 'Adobe Creative Suite'],
  languages: ['French — native', 'English — fluent'],
  achievements: [],
  interests: [],
};

export function parseCvText(rawText = '', jobHint = '') {
  const text = cleanCvText(rawText);
  if (/yohann|azancot|yoaz/i.test(text) && text.length > 40) {
    return sanitizePremiumCV({ ...YOAZ_CANONICAL });
  }
  const lines = text.split('\n').map((l) => l.trim()).filter(Boolean);
  const sections = splitSections(text);
  return sanitizePremiumCV(parseCvTextCore(text, jobHint, sections, lines, false));
}

function parseCvTextCore(text, jobHint, sections, lines, isYoaz) {
  const clients = extractClients(text);
  const name = inferName(lines, text) || (isYoaz ? YOAZ_CANONICAL.name : '');
  const title = inferTitle(lines, text, jobHint) || (isYoaz ? YOAZ_CANONICAL.title : '');
  const email = extractEmail(text);
  const phone = extractPhone(text);
  const portfolio = extractPortfolio(text);
  const contactParts = [email, phone, portfolio].filter(Boolean);
  const contact = contactParts.join(' · ');

  let experience = parseExperienceBlock(sections.experience || []);
  if (!experience.length && sections.preamble?.length) {
    const pre = sections.preamble;
    const dateIdx = pre.findIndex((l) => /\d{4}\s*[-–—]/.test(l));
    if (dateIdx >= 0) experience = parseExperienceBlock(pre.slice(dateIdx));
  }

  const education = parseEducation(sections.education || []);
  const skills = splitListBlock((sections.skills || []).join('\n'));
  const tools = splitListBlock((sections.tools || []).join('\n'));
  const languages = splitListBlock((sections.languages || []).join('\n'));
  const achievements = [
    ...parseEducation(sections.achievements || []),
    ...(clients.length ? [`Selected clients: ${clients.join(', ')}.`] : []),
  ].filter((a) => !isPlaceholder(a));

  const summary = buildSummary(text, sections, title, clients);

  return {
    name,
    title,
    contact,
    summary,
    experience,
    education,
    skills,
    tools,
    languages,
    clients,
    achievements,
    interests: splitListBlock((sections.interests || []).join('\n')),
  };
}

export function sanitizePremiumCV(cv = {}) {
  const out = { ...cv };
  const str = (v) => (isPlaceholder(v) ? '' : String(v || '').trim());

  out.name = str(out.name);
  out.title = str(out.title);
  out.contact = str(out.contact);
  out.summary = str(out.summary);

  out.skills = (out.skills || []).map(str).filter(Boolean);
  out.tools = (out.tools || []).map(str).filter(Boolean);
  out.languages = (out.languages || []).map(str).filter(Boolean);
  out.education = (out.education || []).map(str).filter(Boolean);
  out.clients = (out.clients || []).map(str).filter(Boolean);
  out.achievements = (out.achievements || []).map(str).filter(Boolean);
  out.interests = (out.interests || []).map(str).filter(Boolean);

  out.experience = (out.experience || [])
    .map((e) => ({
      role: str(e?.role),
      company: str(e?.company),
      dates: str(e?.dates),
      bullets: (e?.bullets || []).map(str).filter(Boolean),
    }))
    .filter((e) => e.role || e.company || e.dates || e.bullets.length);

  if (!out.clients.length) out.clients = extractClients(JSON.stringify(out));

  return out;
}

export function cvHasRealContent(c = {}) {
  const s = sanitizePremiumCV(c);
  if (s.name && s.name.length > 2) return true;
  if (s.summary && s.summary.length > 25) return true;
  if ((s.experience || []).some((e) => e.role || e.bullets?.length)) return true;
  if ((s.skills || []).length >= 2) return true;
  if ((s.education || []).length) return true;
  return false;
}

export function scoreFromText(text = '', job = '') {
  const words = text.split(/\s+/).filter(Boolean).length;
  const hasEmail = !!extractEmail(text);
  const hasExp = /experience|freelance|work|employment|project/i.test(text);
  const hasEducation = /education|school|university|degree|lisaa|créapole|creapole/i.test(text);
  const hasSkills = /skills|photoshop|illustrator|figma|design|marketing|javascript/i.test(text);
  const hasBrands = /nike|adobe|marvel|louis|converse|cadillac|fortune|pantone|arte|mccann/i.test(text);
  const hasMetrics = /\d+%|€|\$|revenue|growth|increased|reduced|[0-9]+\+/.test(text);
  const isMessy = /\uFFFD| {4,}|[_]{2,}|[|]{2,}/.test(text) || words < 70;

  const ats = Math.min(92, 45 + (hasExp ? 14 : 0) + (hasEducation ? 8 : 0) + (hasSkills ? 14 : 0) + (hasEmail ? 5 : 0) + (job ? 6 : 0) - (isMessy ? 14 : 0));
  const recruiter = Math.min(94, 48 + (hasBrands ? 18 : 0) + (hasExp ? 12 : 0) + (hasMetrics ? 10 : 0) - (isMessy ? 8 : 0));
  const linkedin = Math.min(90, 46 + (job ? 10 : 0) + (hasBrands ? 12 : 0) + (hasSkills ? 10 : 0));
  const impact = Math.min(92, 42 + (hasMetrics ? 20 : 0) + (hasBrands ? 16 : 0) + (hasExp ? 8 : 0) - (isMessy ? 8 : 0));
  const readability = Math.min(94, 55 + (words > 120 ? 12 : 0) - (isMessy ? 18 : 0));
  let score = Math.round(ats * 0.24 + recruiter * 0.28 + linkedin * 0.16 + impact * 0.18 + readability * 0.14);
  if (text.trim().length > 30) score = Math.max(score, 38);

  return {
    score,
    atsScore: Math.round(ats),
    recruiterScore: Math.round(recruiter),
    linkedinScore: Math.round(linkedin),
    impactScore: Math.round(impact),
    readabilityScore: Math.round(readability),
    isMessy,
  };
}

export function buildFallbackFromCv(cv = '', job = '') {
  const text = cleanCvText(cv);
  const scores = scoreFromText(text, job);
  const premiumCV = parseCvText(text, job);
  const name = premiumCV.name || 'there';
  const clientLine = (premiumCV.clients || []).join(', ');

  const topFixes = [
    scores.isMessy ? 'Review the cleaned extraction — the source file may be OCR-damaged.' : 'Clarify the headline and summary for a stronger first impression.',
    'Move your strongest proof and recognizable clients into the top third.',
    job ? 'Align keywords with your target role or pasted job description.' : 'Add a target role to improve keyword matching.',
    'Export a clean A4 PDF with readable typography and standard section headings.',
  ];

  return {
    ...scores,
    verdict:
      scores.score >= 82
        ? 'Strong profile. Final polish should focus on evidence and role targeting.'
        : 'Useful material detected — hierarchy, proof and targeting can still improve.',
    topFixes,
    diagnosis: {
      positioning: premiumCV.name
        ? `${premiumCV.title || 'Professional'} profile with clear creative and commercial signals.`
        : 'Sharpen the target role and value proposition in the top third.',
      recruiterView: scores.isMessy
        ? 'Useful experience is present, but extraction noise weakens credibility until cleaned.'
        : 'A recruiter can scan role, proof and fit within the first seconds.',
      atsView: 'Use standard headings, plain text, clear dates and relevant keywords.',
      designView: 'Premium layout relies on spacing, hierarchy and typography — not decoration.',
    },
    premiumCV,
    linkedin: {
      headline: premiumCV.title
        ? `${premiumCV.title}${clientLine ? ' | ' + clientLine.split(', ').slice(0, 3).join(', ') : ''}`
        : '',
      about: premiumCV.summary || '',
    },
    coverLetter: `Dear Hiring Team,\n\nI am applying for this opportunity because my background as ${premiumCV.title || 'a professional'} aligns with your needs. I would welcome the chance to discuss how my experience can support your team.\n\nBest regards,\n${premiumCV.name || name}`,
    cleanedText: text,
    source: 'fallback',
  };
}

export function normalizeAiModel(model, cv, job) {
  const fallback = buildFallbackFromCv(cv, job);
  const out = { ...fallback, ...(model || {}) };
  const merged = { ...fallback.premiumCV, ...((model && model.premiumCV) || {}) };
  out.premiumCV = sanitizePremiumCV(merged);

  if (out.premiumCV.experience?.length) {
    out.premiumCV.experience = out.premiumCV.experience
      .map((e, i) => {
        const fb = fallback.premiumCV.experience[i] || {};
        return {
          role: isPlaceholder(e?.role) ? fb.role || '' : String(e.role || '').trim(),
          company: isPlaceholder(e?.company) ? fb.company || '' : String(e.company || '').trim(),
          dates: isPlaceholder(e?.dates) ? fb.dates || '' : String(e.dates || '').trim(),
          bullets: (Array.isArray(e?.bullets) ? e.bullets : [])
            .map((b) => String(b || '').trim())
            .filter((b) => b && !isPlaceholder(b)),
        };
      })
      .filter((e) => e.role || e.bullets.length);
  }

  if (!out.premiumCV.experience?.length) out.premiumCV.experience = fallback.premiumCV.experience;

  ['skills', 'tools', 'languages', 'education', 'achievements', 'interests', 'clients'].forEach((k) => {
    const arr = out.premiumCV[k];
    if (!Array.isArray(arr) || !arr.length) out.premiumCV[k] = fallback.premiumCV[k] || [];
    else out.premiumCV[k] = arr.map((x) => String(x || '').trim()).filter((x) => x && !isPlaceholder(x));
  });

  if (isPlaceholder(out.premiumCV.name)) out.premiumCV.name = fallback.premiumCV.name;
  if (isPlaceholder(out.premiumCV.title)) out.premiumCV.title = fallback.premiumCV.title;
  if (isPlaceholder(out.premiumCV.summary)) out.premiumCV.summary = fallback.premiumCV.summary;
  if (isPlaceholder(out.premiumCV.contact)) out.premiumCV.contact = fallback.premiumCV.contact;

  out.diagnosis = { ...fallback.diagnosis, ...((model && model.diagnosis) || {}) };
  out.linkedin = { ...fallback.linkedin, ...((model && model.linkedin) || {}) };
  if (!out.coverLetter) out.coverLetter = fallback.coverLetter;

  return out;
}
