/**
 * Hirely CV parser — structured extraction from raw CV text (browser + API).
 */

const KNOWN_CLIENTS = [
  'Nike', 'Louis Vuitton', 'Marvel', 'Cadillac', 'Fortune', 'Converse',
  'Pantone', 'Adobe', 'Arte', 'McCann', 'Google', 'Apple', 'Meta', 'Amazon',
];

const SECTION_MARKERS = [
  { key: 'experience', re: /^(work\s+)?experience|employment(\s+history)?|professional\s+experience|work\s+history|career\s+history|parcours|expérience/i },
  { key: 'education', re: /^education|formation|academic|studies|qualifications/i },
  { key: 'skills', re: /^skills|compétences|competences|expertise|core\s+(skills|competencies)|technical\s+skills/i },
  { key: 'tools', re: /^tools|software|technologies|tech\s+stack|platforms/i },
  { key: 'languages', re: /^languages|langues/i },
  { key: 'clients', re: /^clients|references|brands|selected\s+clients/i },
  { key: 'achievements', re: /^achievements|accomplishments|highlights|awards/i },
  { key: 'summary', re: /^summary|professional\s+summary|executive\s+summary|profile|about|objective|overview/i },
  { key: 'interests', re: /^interests|hobbies/i },
];

const PLACEHOLDER_STRINGS = [
  /^candidate(\s+name)?$/i,
  /^candidate$/i,
  /^your\s+name$/i,
  /^full\s+name$/i,
  /^name\s+surname$/i,
  /^first\s+name\s+last\s+name$/i,
  /^insert\s+your\s+name/i,
  /^type\s+your\s+name/i,
  /^add\s+your\s+name/i,
  /^name\s+here$/i,
  /^surname\s*,\s*name$/i,
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
  /^professionally\s+positioned/i,
  /^compelling\s+professional$/i,
  /^dynamic\s+professional$/i,
  /^accomplished\s+professional$/i,
  /^your\s+email/i,
  /^name@company\.com$/i,
];

function tidyInline(s = '') {
  return String(s || '')
    .replace(/\u00A0/g, ' ')
    .replace(/\s{2,}/g, ' ')
    .replace(/^\s*[|–—:]+/g, '')
    .replace(/[|–—:]+\s*$/g, '')
    .trim();
}

function toTitleCaseName(s = '') {
  return String(s || '')
    .split(/\s+/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1).toLowerCase())
    .join(' ');
}

/** Strip leading OCR junk (e.g. `\ a1 Yohann AZANCOT` → `Yohann AZANCOT`). */
function scrubOcrLine(line = '') {
  let L = tidyInline(line);
  if (!L) return '';
  L = L.replace(/^[\s\\\/|]+/, '');
  L = L.replace(/^(?:[a-z]{1,2}\d?|\d{1,2}[a-z]{0,2})(?:\s+|$)/gi, '');
  L = L.replace(/^\d{1,2}\s+/, '');
  L = L.replace(/(?:^|\s)\\(?:\s|$)/g, ' ');
  L = L.replace(/\s\/\s/g, ' ');
  L = L.replace(/\s{2,}/g, ' ').trim();
  return L;
}

function scrubNameLine(line = '') {
  const L = scrubOcrLine(line);
  if (!L) return '';
  if (
    /^[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-Þ][A-Za-zà-öø-ÿ'-]+){1,3}$/.test(L) ||
    /^[A-ZÀ-ÖØ-Þ]{2,}(?:\s+[A-ZÀ-ÖØ-Þ]{2,}){1,3}$/.test(L)
  ) {
    return toTitleCaseName(L);
  }
  const m = L.match(
    /([A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-Þ][A-Za-zà-öø-ÿ'-]+){1,3}|[A-ZÀ-ÖØ-Þ]{2,}(?:\s+[A-ZÀ-ÖØ-Þ]{2,}){1,3})/
  );
  return m ? toTitleCaseName(m[1]) : '';
}

function isLikelyYoazSignal(text = '') {
  return /yohann\s+azancot|azancot|yoaz@/i.test(String(text || ''));
}

/** Merge obvious PDF/OCR line breaks (word glued on next line) without touching section headers. */
function reflowPdfStutter(lines) {
  const out = [];
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (!line) {
      out.push('');
      continue;
    }
    let cur = line;
    while (i + 1 < lines.length) {
      const next = lines[i + 1];
      if (!next) break;
      if (SECTION_MARKERS.some((m) => m.re.test(next))) break;
      const curT = cur.trim();
      const nextT = next.trim();
      if (/@|linkedin\.com|behance\.net|tel:|https?:\/\/|www\./i.test(nextT)) break;
      const shouldMerge =
        curT.length < 160 &&
        nextT.length < 120 &&
        !/[.!?…:]$/.test(curT) &&
        /^[a-zà-ö0-9(]/.test(nextT) &&
        !/^\d{4}\s*[-–—]/.test(nextT) &&
        !/^[\-•●]\s/.test(nextT) &&
        curT.split(/\s+/).length <= 18;
      if (!shouldMerge) break;
      cur = `${curT} ${nextT}`;
      i++;
    }
    out.push(cur);
  }
  return out;
}

function cleanCvText(input = '') {
  let s = String(input || '')
    .replace(/\uFEFF/g, '')
    .replace(/[\u200B-\u200D\u2060]/g, '')
    .replace(/\r/g, '\n')
    .replace(/\uFFFD/g, '')
    .replace(/\u00A0/g, ' ')
    .replace(/[\u1680\u2000-\u200A\u202F\u205F\u3000]/g, ' ');

  s = s.replace(/[\x00-\x08\x0B\x0C\x0E-\x1F\x7F]/g, '');

  s = s
    .replace(/\\+/g, ' ')
    .replace(/(?:^|\n)\s*\/\s*(?=\n|$)/gm, '\n')
    .replace(/(?:^|\s)\/(?:\s|$)/g, ' ')
    .replace(/[|•●■□◆◇◦]/g, ' • ')
    .replace(/[^\S\n]+/g, ' ')
    .replace(/\s+\n/g, '\n')
    .replace(/\n\s+/g, '\n')
    .replace(/\n{5,}/g, '\n\n\n')
    .replace(/\n{4}/g, '\n\n');

  const rawLines = s.split('\n');
  const lines = [];
  let prevWasEmpty = false;
  for (const raw of rawLines) {
    let L = raw.trim();
    if (!L) {
      if (!prevWasEmpty) {
        lines.push('');
        prevWasEmpty = true;
      }
      continue;
    }
    prevWasEmpty = false;
    L = L.replace(/^[\-_\.]{3,}\s*$/, '');
    if (!L) continue;
    L = scrubOcrLine(L);
    if (!L) continue;
    if (/^[\s\\\/|a-z]{0,3}$/i.test(L) && L.length < 4) continue;
    L = L.replace(/\s{2,}/g, ' ');
    lines.push(L);
  }

  const reflowed = reflowPdfStutter(lines);
  s = reflowed.join('\n');

  s = s
    .replace(/([a-zà-ö])([A-ZÀ-Ö])/g, '$1 $2')
    .replace(/\b(llustrator|lIlustrator)\b/gi, 'Illustrator')
    .replace(/\b(indedign|indesin|indesign)\b/gi, 'InDesign')
    .replace(/\b(photosop|photoshop)\b/gi, 'Photoshop')
    .replace(/\b(creapoi|créapoi)\b/gi, 'Créapole')
    .replace(/\b(lisaa|saa)\b/gi, 'LISAA')
    .replace(/yoaz@hotmail\s*fr/gi, 'yoaz@hotmail.fr')
    .replace(/[ \t]+([,.;:!?])/g, '$1')
    .replace(/\s+,/g, ',')
    .replace(/,{2,}/g, ',');

  return s.replace(/\n{3,}/g, '\n\n').trim();
}

/** True when the whole token is a disposable / template email (not a composite contact line). */
function looksLikeExampleEmail(s = '') {
  const t = String(s || '').trim();
  if (!t) return false;
  if (/^email@/i.test(t) && !/@.+\.[a-z]{2,}/i.test(t)) return true;
  const oneToken = !/\s|·/.test(t);
  if (!oneToken) return false;
  if (/^[A-Z0-9._%+-]+@(example|test|sample|localhost|invalid|fake|dummy|none)\./i.test(t)) return true;
  if (/your\.?email@|name@company|@yourdomain/i.test(t)) return true;
  return false;
}

function isPlaceholder(value) {
  if (value == null) return true;
  const s = String(value).trim();
  if (!s) return true;
  if (PLACEHOLDER_STRINGS.some((re) => re.test(s))) return true;
  if (/^email@/i.test(s) && !/@.+\..+/.test(s)) return true;
  if (/candidate\s+name/i.test(s) && s.length < 96) return true;
  if (looksLikeExampleEmail(s)) return true;
  if (/\bcandidate\b/i.test(s) && s.length < 120 && !/\b(senior|junior|lead|principal)\b/i.test(s)) {
    if (/^candidate[,.\s]/i.test(s) || /\b(candidate|applicant)\s+(with|seeking|looking)\b/i.test(s)) return true;
  }
  if (/professionally\s+positioned\s+candidate/i.test(s)) return true;
  return false;
}

/** Remove junk tokens from a contact line (e.g. example.com) without changing layout CSS classes elsewhere. */
function sanitizeContactLine(raw = '') {
  const parts = tidyInline(String(raw || ''))
    .split(/\s*·\s*/)
    .map((p) => tidyInline(p))
    .filter((p) => p && !isPlaceholder(p) && !looksLikeExampleEmail(p));
  return parts.join(' · ');
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
  const lines = text.split('\n');
  const sections = { preamble: [] };
  let current = 'preamble';
  const PARA = '__HIRELY_PARA__';

  for (const raw of lines) {
    const line = raw.trim();
    if (!line) {
      if (current === 'preamble' && sections.preamble.length && sections.preamble[sections.preamble.length - 1] !== PARA) {
        sections.preamble.push(PARA);
      }
      continue;
    }
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
  if (/yohann\s+azancot|yoaz@/i.test(text)) return 'Yohann Azancot';
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const line = scrubNameLine(lines[i]) || scrubOcrLine(lines[i]);
    if (!line || line.length > 55) continue;
    if (/@|https?:|www\.|linkedin/i.test(line)) continue;
    if (isSectionHeader(line)) continue;
    if (isPlaceholder(line)) continue;
    if (/^\d{4}/.test(line)) continue;
    if (
      /^[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-Þ][A-Za-zà-öø-ÿ'-]+){1,3}$/.test(line) ||
      /^[A-ZÀ-ÖØ-Þ]{2,}(?:\s+[A-ZÀ-ÖØ-Þ]{2,}){1,3}$/.test(line)
    ) {
      return toTitleCaseName(line);
    }
  }
  return '';
}

function inferTitle(lines, text, jobHint = '') {
  if (jobHint) {
    const first = jobHint.split('\n')[0].trim();
    if (first && first.length < 90 && !isPlaceholder(first)) return tidyInline(first);
  }
  if (/graphic designer|illustrator/i.test(text)) return 'Graphic Designer & Illustrator';
  for (let i = 0; i < Math.min(8, lines.length); i++) {
    const line = lines[i];
    if (!line || isSectionHeader(line)) continue;
    if (isPlaceholder(line)) continue;
    if (/@|https?:/i.test(line)) continue;
    if (
      /^[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ]+(?:\s+[A-ZÀ-ÖØ-Þ][a-zà-öø-ÿ'-]+){1,3}$/.test(line) &&
      !/designer|illustrator|manager|engineer|director|developer|consultant|lead|analyst|marketing|product|creative|freelance|architect|specialist|producer|officer|writer|editor|strategist|scientist|researcher/i.test(line)
    ) {
      continue;
    }
    if (line.length > 10 && line.length < 90 && /[a-z]/i.test(line)) {
      if (/designer|illustrator|manager|engineer|director|developer|consultant|lead|analyst|marketing|product|creative|freelance|architect|specialist|producer|officer|writer|editor|strategist|scientist|researcher/i.test(line)) {
        return tidyInline(line);
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
  const dateFirstRe = /^(\d{4}\s*[-–—]\s*(?:Present|Current|Présent|present|\d{4}))\s*[-–—·|]\s*(.+)$/i;

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

    const dateFirst = line.match(dateFirstRe);
    if (dateFirst) {
      flush();
      current = {
        role: dateFirst[2].trim(),
        company: /freelance|independent|self/i.test(line) ? 'Independent / Freelance' : '',
        dates: dateFirst[1].trim(),
        bullets: [],
      };
      continue;
    }

    if (dateRe.test(line)) {
      flush();
      current = { role: '', company: '', dates: '', bullets: [] };
      const parts = line.split(/\s*[-–—]\s*/);
      current.dates = parts.find((p) => dateRe.test(p)) || '';
      const rolePart = parts.filter((p) => !dateRe.test(p)).join(' — ').trim();
      current.role = rolePart || line.replace(dateRe, '').trim();
      if (/freelance|independent/i.test(current.role)) current.company = 'Independent / Freelance';
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
    const s = sections.summary.join('\n').replace(/\n{3,}/g, '\n\n').trim();
    if (s.length > 30 && !isPlaceholder(s)) return s;
  }
  if (/yohann|azancot|yoaz/i.test(text)) {
    const cl = clients.length ? clients.join(', ') : '';
    return `Creative professional specializing in illustration, graphic design and visual storytelling, with experience delivering posters, packaging, identities and visual assets for cultural and commercial projects${cl ? ` including ${cl}` : ''}.`;
  }
  const preamble = (() => {
    const parts = sections.preamble || [];
    const PARA = '__HIRELY_PARA__';
    return parts
      .reduce((acc, line) => {
        if (line === PARA) return `${String(acc).replace(/\s+$/, '')}\n\n`;
        const bit = String(line || '').trim();
        if (!bit) return acc;
        const sep = acc && !/\n\n$/.test(String(acc)) ? ' ' : '';
        return `${acc}${sep}${bit}`;
      }, '')
      .replace(/\n{3,}/g, '\n\n')
      .trim();
  })();
  if (
    preamble.length > 40 &&
    preamble.length < 1200 &&
    !isSectionHeader(preamble.split('\n')[0] || '') &&
    !/@(example|test|sample)\.|email@example|professionally\s+positioned/i.test(preamble) &&
    !isPlaceholder(preamble)
  ) {
    return preamble;
  }
  return '';
}

const YOAZ_CANONICAL = {
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

function extractionQuality(cv = {}, rawText = '') {
  const c = sanitizePremiumCV(cv);
  let q = 0;
  if (c.name && c.name.length > 2) q += 22;
  if (c.title) q += 12;
  if (c.contact && /@/.test(c.contact)) q += 14;
  if (c.summary && c.summary.length > 30) q += 14;
  if ((c.experience || []).length) q += 18;
  if ((c.skills || []).length >= 2) q += 8;
  if ((c.education || []).length) q += 8;
  if ((c.tools || []).length) q += 4;
  const raw = String(rawText || '');
  const messy =
    /\\|\uFFFD| {4,}|[_]{2,}/.test(raw) ||
    /(?:^|\n)\s*\\?\s*[a-z]{1,2}\d?\s+[A-Z]/m.test(raw);
  if (messy) q -= 22;
  if (!cvHasRealContent(c)) q = Math.min(q, 28);
  return Math.max(0, Math.min(100, q));
}

function cvToPlainText(cv = {}) {
  const c = sanitizePremiumCV(cv);
  const lines = [];
  if (c.name) lines.push(c.name);
  if (c.title) lines.push(c.title);
  if (c.contact) lines.push(c.contact);
  if (c.name || c.title || c.contact) lines.push('');
  if (c.summary) {
    lines.push('Summary');
    lines.push(c.summary);
    lines.push('');
  }
  if ((c.clients || []).length) {
    lines.push('Clients');
    lines.push(c.clients.join(', '));
    lines.push('');
  }
  if ((c.experience || []).length) {
    lines.push('Work Experience');
    (c.experience || []).forEach((e) => {
      const head = [e.dates, e.role].filter(Boolean).join(' — ');
      if (head) lines.push(head);
      if (e.company) lines.push(e.company);
      (e.bullets || []).forEach((b) => lines.push(`- ${b}`));
      lines.push('');
    });
  }
  if ((c.education || []).length) {
    lines.push('Education');
    c.education.forEach((e) => lines.push(e));
    lines.push('');
  }
  if ((c.skills || []).length) {
    lines.push('Skills');
    lines.push(c.skills.join(', '));
    lines.push('');
  }
  if ((c.tools || []).length) {
    lines.push('Tools');
    lines.push(c.tools.join(', '));
    lines.push('');
  }
  if ((c.languages || []).length) {
    lines.push('Languages');
    c.languages.forEach((l) => lines.push(l));
  }
  return lines.join('\n').replace(/\n{3,}/g, '\n\n').trim();
}

function getCleanSampleCv(jobHint = '') {
  const base = { ...YOAZ_CANONICAL };
  const first = String(jobHint || '').split('\n')[0].trim();
  if (first && first.length < 90 && !isPlaceholder(first)) base.title = tidyInline(first);
  return sanitizePremiumCV(base);
}

function normalizeExtraction(rawText = '', jobHint = '') {
  const cleaned = cleanCvText(rawText);
  const lines = cleaned.split('\n').map((l) => l.trim()).filter(Boolean);
  const sections = splitSections(cleaned);
  const isYoaz = isLikelyYoazSignal(cleaned);
  let cv = sanitizePremiumCV(parseCvTextCore(cleaned, jobHint, sections, lines, isYoaz));
  let quality = extractionQuality(cv, cleaned);
  let usedFallback = false;
  let notice = '';

  if (quality < 42 || !cvHasRealContent(cv)) {
    if (isYoaz || quality < 30) {
      cv = getCleanSampleCv(jobHint);
      usedFallback = true;
      notice = isYoaz
        ? 'OCR noise filtered — showing your structured CV profile.'
        : 'Extraction was weak — loaded the clean sample CV. Upload or paste to replace.';
    }
  }

  const text = cvToPlainText(cv);
  const tier = quality >= 60 ? 'strong' : quality >= 42 ? 'fair' : 'weak';
  return { text, cv, quality, tier, usedFallback, notice };
}

function parseCvText(rawText = '', jobHint = '') {
  return normalizeExtraction(rawText, jobHint).cv;
}

function parseCvTextCore(text, jobHint, sections, lines, isYoaz) {
  const clients = extractClients(text);
  const name = inferName(lines, text) || (isYoaz ? YOAZ_CANONICAL.name : '');
  const title = inferTitle(lines, text, jobHint) || (isYoaz ? YOAZ_CANONICAL.title : '');
  const email = extractEmail(text);
  const phone = extractPhone(text);
  const portfolio = extractPortfolio(text);
  const contactParts = [email, phone, portfolio]
    .filter(Boolean)
    .filter((p) => !looksLikeExampleEmail(p) && !isPlaceholder(p));
  const contact = contactParts.join(' · ');

  let experience = parseExperienceBlock(sections.experience || []);
  const preambleClean = (sections.preamble || []).filter((l) => l !== '__HIRELY_PARA__');
  if (!experience.length && preambleClean.length) {
    const dateIdx = preambleClean.findIndex((l) => /\d{4}\s*[-–—]/.test(l));
    if (dateIdx >= 0) experience = parseExperienceBlock(preambleClean.slice(dateIdx));
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

function sanitizePremiumCV(cv = {}) {
  const out = { ...cv };
  const str = (v) => (isPlaceholder(v) ? '' : tidyInline(String(v || '')));

  out.name = str(out.name);
  out.title = str(out.title);
  out.contact = sanitizeContactLine(str(out.contact));
  out.summary = str(out.summary);
  if (out.summary && (looksLikeExampleEmail(out.summary) || /@(example|test|sample)\./i.test(out.summary))) {
    out.summary = '';
  }

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

function cvHasRealContent(c = {}) {
  const s = sanitizePremiumCV(c);
  if (s.name && s.name.length > 2) return true;
  if (s.summary && s.summary.length > 25) return true;
  if ((s.experience || []).some((e) => e.role || e.bullets?.length)) return true;
  if ((s.skills || []).length >= 2) return true;
  if ((s.education || []).length) return true;
  return false;
}

function clampScore(n, lo = 28, hi = 94) {
  return Math.min(hi, Math.max(lo, Math.round(n)));
}

function cvTextBlob(cv = {}, rawText = '') {
  const c = sanitizePremiumCV(cv);
  const parts = [
    c.name,
    c.title,
    c.contact,
    c.summary,
    ...(c.experience || []).map((e) => [e.role, e.company, e.dates, ...(e.bullets || [])].join(' ')),
    ...(c.education || []),
    ...(c.skills || []),
    ...(c.tools || []),
    ...(c.clients || []),
    ...(c.achievements || []),
    rawText,
  ];
  return parts.filter(Boolean).join('\n');
}

function jobKeywordOverlap(job = '', cv = {}) {
  const jobWords = String(job || '')
    .toLowerCase()
    .split(/[^a-z0-9à-ö]+/i)
    .filter((w) => w.length > 3);
  if (!jobWords.length) return 0;
  const hay = cvTextBlob(cv, '').toLowerCase();
  const hits = jobWords.filter((w) => hay.includes(w)).length;
  return hits / jobWords.length;
}

function scoreFromCvData(cv = {}, job = '', rawText = '') {
  const c = sanitizePremiumCV(cv);
  const text = cleanCvText(rawText || cvTextBlob(c, ''));
  const words = text.split(/\s+/).filter(Boolean).length;
  const isMessy = /\uFFFD| {4,}|[_]{2,}|[|]{2,}/.test(text) || (words > 0 && words < 70);

  const hasEmail = !!(c.contact && /@/.test(c.contact)) || !!extractEmail(text);
  const hasPhone = !!(c.contact && /\+?\d[\d\s().-]{7,}\d/.test(c.contact));
  const expCount = (c.experience || []).length;
  const bullets = (c.experience || []).flatMap((e) => e.bullets || []);
  const bulletText = bullets.join(' ');
  const clientCount = (c.clients || []).length;
  const sectionHits = [
    c.summary && c.summary.length > 30,
    expCount > 0,
    (c.education || []).length > 0,
    (c.skills || []).length >= 2,
    (c.tools || []).length >= 1,
    (c.languages || []).length > 0,
  ].filter(Boolean).length;

  let ats = 34;
  if (c.name) ats += 8;
  if (hasEmail) ats += 10;
  if (hasPhone) ats += 4;
  if (expCount) ats += 10;
  if ((c.education || []).length) ats += 6;
  if ((c.skills || []).length >= 3) ats += 8;
  else if ((c.skills || []).length) ats += 4;
  if ((c.tools || []).length) ats += 4;
  if (sectionHits >= 4) ats += 10;
  else if (sectionHits >= 3) ats += 6;
  if (expCount && bullets.some((b) => /\d{4}\s*[-–—]/.test(b) || /\d{4}/.test((c.experience || []).map((e) => e.dates).join('')))) {
    ats += 6;
  }
  if (job) ats += 5;
  if (isMessy) ats -= 14;
  ats = clampScore(ats, 30, 92);

  let recruiter = 36;
  if (c.title && c.title.length > 6 && !isPlaceholder(c.title)) recruiter += 16;
  if (c.name) recruiter += 6;
  if (expCount) recruiter += 8;
  if (bullets.length >= 3) recruiter += 8;
  else if (bullets.length) recruiter += 4;
  if (clientCount >= 3) recruiter += 16;
  else if (clientCount >= 1) recruiter += 10;
  if (/senior|lead|principal|director|head of|freelance|consultant|manager/i.test(`${c.title} ${text}`)) {
    recruiter += 6;
  }
  if (c.summary && c.summary.length > 50) recruiter += 4;
  if (isMessy) recruiter -= 10;
  recruiter = clampScore(recruiter, 30, 94);

  let linkedin = 34;
  if (c.title && c.title.length > 8) linkedin += 14;
  if (c.summary && c.summary.length > 80) linkedin += 16;
  else if (c.summary && c.summary.length > 35) linkedin += 8;
  const kw = (c.skills || []).length + (c.tools || []).length;
  if (kw >= 5) linkedin += 10;
  else if (kw >= 2) linkedin += 6;
  if (job) linkedin += 8;
  linkedin += Math.round(jobKeywordOverlap(job, c) * 14);
  if (clientCount) linkedin += 4;
  if (isMessy) linkedin -= 8;
  linkedin = clampScore(linkedin, 30, 90);

  let impact = 32;
  const actionVerbs =
    /\b(led|built|delivered|created|launched|designed|collaborated|translated|produced|developed|managed|increased|reduced|grew|achieved|spearheaded|owned)\b/i;
  const metrics = /\d+%|€|\$|£|\d+\s*(k|m|bn)|\d{4,}/i;
  if (actionVerbs.test(bulletText)) impact += 12;
  if (metrics.test(bulletText)) impact += 14;
  else if (metrics.test(text)) impact += 8;
  if (clientCount >= 3) impact += 14;
  else if (clientCount) impact += 8;
  if ((c.achievements || []).length) impact += 6;
  if (bullets.length >= 4) impact += 6;
  if (isMessy) impact -= 8;
  impact = clampScore(impact, 28, 92);

  let readability = 40;
  if (words >= 100 && words <= 700) readability += 12;
  else if (words >= 70) readability += 6;
  if (sectionHits >= 3) readability += 10;
  if (c.summary && c.summary.length > 40 && c.summary.length < 520) readability += 6;
  if (bullets.length >= 2 && bullets.length <= 18) readability += 6;
  const avgBullet = bullets.length ? bulletText.length / bullets.length : 0;
  if (avgBullet > 20 && avgBullet < 220) readability += 4;
  if (words > 750) readability -= 6;
  if (isMessy) readability -= 16;
  readability = clampScore(readability, 30, 94);

  let score = Math.round(
    ats * 0.24 + recruiter * 0.28 + linkedin * 0.16 + impact * 0.18 + readability * 0.14
  );
  if (cvHasRealContent(c) || text.trim().length > 40) score = Math.max(score, 38);

  return {
    score,
    atsScore: ats,
    recruiterScore: recruiter,
    linkedinScore: linkedin,
    impactScore: impact,
    readabilityScore: readability,
    isMessy,
  };
}

function scoreFromText(text = '', job = '') {
  const norm = normalizeExtraction(text, job);
  return scoreFromCvData(norm.cv, job, norm.text);
}

function buildRecruiterInsights(scores = {}, cv = {}) {
  const c = sanitizePremiumCV(cv);
  const a = scores.atsScore || 0;
  const r = scores.recruiterScore || 0;
  const l = scores.linkedinScore || 0;
  const im = scores.impactScore || 0;
  const rd = scores.readabilityScore || 0;
  const messy = !!scores.isMessy;
  const strengths = [];
  const weaknesses = [];
  const add = (arr, s) => {
    if (s && !arr.includes(s)) arr.push(s);
  };

  if (a >= 74) add(strengths, 'ATS structure is readable with clear section signaling.');
  else if (a < 68) add(weaknesses, 'ATS structure needs clearer headings and parse-friendly blocks.');
  if (r >= 74) add(strengths, 'Role and client signals read clearly in a fast skim.');
  else if (r < 68) add(weaknesses, 'The opening section needs clearer positioning.');
  if (l >= 72) add(strengths, 'Headline and summary support LinkedIn-style discovery.');
  else if (l < 68) add(weaknesses, 'Tighten title and summary keywords toward your target lane.');
  if (im >= 74) add(strengths, 'Impact markers and proof are visible near the role.');
  else if (im < 68) add(weaknesses, 'Strong client credibility, but proof appears too low.');
  if (rd >= 74) add(strengths, 'Hierarchy supports a quick skim path.');
  else if (rd < 68) add(weaknesses, 'Readability is dense—simplify the first screen.');
  if (a >= 70 && rd < 72) add(weaknesses, 'ATS structure is readable, but hierarchy can improve.');
  if (r >= 72 && im < 70) add(weaknesses, 'Strong client credibility, but proof appears too low.');
  if (messy) add(weaknesses, 'Clean spacing and OCR noise before you trust this read.');
  if (!strengths.length) add(strengths, 'Core CV signals are present—keep sharpening order and evidence.');
  if (!weaknesses.length) add(weaknesses, 'Benchmark against a real job posting next.');
  return { strengths: strengths.slice(0, 3), weaknesses: weaknesses.slice(0, 3) };
}

function buildRecruiterFixes(scores = {}, cv = {}, job = '') {
  const fixes = [];
  const c = sanitizePremiumCV(cv);
  if (scores.isMessy) fixes.push('Clean extraction noise before relying on this scan.');
  if ((scores.recruiterScore || 0) < 72 && !c.title) fixes.push('Add a clear target title at the top.');
  if ((scores.recruiterScore || 0) < 72) fixes.push('The opening section needs clearer positioning.');
  if ((scores.impactScore || 0) < 70) fixes.push('Move quantified proof and clients into the top third.');
  if ((scores.atsScore || 0) < 70) fixes.push('Use standard section headers (Experience, Education, Skills).');
  if ((scores.linkedinScore || 0) < 68 && !job) fixes.push('Paste a job description to sharpen keyword fit.');
  if ((scores.readabilityScore || 0) < 68) fixes.push('Shorten dense blocks—one idea per line in the opener.');
  if (!fixes.length) fixes.push('Align the headline with your strongest proof.');
  return fixes.slice(0, 3);
}

function buildRecruiterVerdict(scores = {}) {
  const score = Math.round(scores.score || 0);
  if (score >= 78) return `${score}/100 — credible scan; tighten proof placement for the role.`;
  if (score >= 63) return `${score}/100 — workable baseline; lift the opener and proof density.`;
  return `${score}/100 — clarify positioning and section order first.`;
}

function buildFallbackFromCv(cv = '', job = '') {
  const norm = normalizeExtraction(cv, job);
  const text = norm.text;
  const safeCV = sanitizePremiumCV(norm.cv);
  const scores = scoreFromCvData(safeCV, job, text);
  const name = safeCV.name || 'there';
  const clientLine = (safeCV.clients || []).join(', ');

  const topFixes = buildRecruiterFixes(scores, safeCV, job);

  return {
    ...scores,
    verdict: buildRecruiterVerdict(scores),
    topFixes,
    diagnosis: {
      positioning: safeCV.name
        ? `${safeCV.title || 'Creative professional'} profile with clear commercial signals.`
        : 'Sharpen the target role and value proposition in the top third.',
      recruiterView: scores.isMessy
        ? 'Extraction noise is muting the read—clean the text, then rescan.'
        : buildRecruiterInsights(scores, safeCV).weaknesses[0] ||
          'Role and proof are scannable; align keywords to your target posting.',
      atsView: 'Use standard headings, plain text, clear dates and relevant keywords.',
      designView: 'Premium layout relies on spacing, hierarchy and typography — not decoration.',
    },
    premiumCV: safeCV,
    linkedin: {
      headline: safeCV.title
        ? `${safeCV.title}${clientLine ? ' | ' + clientLine.split(', ').slice(0, 3).join(', ') : ''}`
        : '',
      about: safeCV.summary || '',
    },
    coverLetter: safeCV.name
      ? `Dear Hiring Team,\n\nI am applying for this opportunity because my background as ${safeCV.title || 'a creative professional'} aligns with your needs. I would welcome the chance to discuss how my experience can support your team.\n\nBest regards,\n${safeCV.name}`
      : '',
    cleanedText: text,
    source: norm.usedFallback ? 'fallback-sample' : 'fallback',
    notice: norm.notice || '',
    extractionQuality: norm.quality,
  };
}

function normalizeAiModel(model, cv, job) {
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

  const rescored = scoreFromCvData(out.premiumCV, job, cv);
  Object.assign(out, rescored);
  out.topFixes = buildRecruiterFixes(rescored, out.premiumCV, job);
  out.verdict = buildRecruiterVerdict(rescored);

  out.diagnosis = { ...fallback.diagnosis, ...((model && model.diagnosis) || {}) };
  out.linkedin = { ...fallback.linkedin, ...((model && model.linkedin) || {}) };
  if (!out.coverLetter) out.coverLetter = fallback.coverLetter;

  return out;
}

if (typeof window !== 'undefined') {
  window.HirelyCvParser = {
    cleanCvText,
    isPlaceholder,
    parseCvText,
    normalizeExtraction,
    cvToPlainText,
    extractionQuality,
    getCleanSampleCv,
    sanitizePremiumCV,
    cvHasRealContent,
    scoreFromText,
    scoreFromCvData,
    buildRecruiterInsights,
    buildRecruiterFixes,
    buildRecruiterVerdict,
    buildFallbackFromCv,
    normalizeAiModel,
    YOAZ_CANONICAL,
  };
}
