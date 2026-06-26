/**
 * Extraction trace — visual pipeline with per-stage loss (paste / text only).
 */

const SECTION_ORDER = [
  'top',
  'contact',
  'location',
  'summary',
  'profile',
  'experience',
  'education',
  'skills',
  'tools',
  'languages',
  'clients',
  'interests',
  'projects',
  'unsorted',
];

const SECTION_DISPLAY = {
  unsorted: 'UNSORTED CONTENT',
};

const CLASSIFIED_TO_FIELD = {
  top: 'header',
  contact: 'contact',
  location: 'contact',
  summary: 'summary',
  profile: 'summary',
  experience: 'experience',
  education: 'education',
  skills: 'skills',
  tools: 'tools',
  languages: 'languages',
  clients: 'clients',
  interests: 'interests',
    projects: 'extra',
    unsorted: 'extra',
};

function nonEmptyLines(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function lineRetained(line, nextLines) {
  const t = line.trim().toLowerCase();
  if (t.length < 3) return true;
  return nextLines.some((n) => {
    const nl = n.trim().toLowerCase();
    if (!nl) return false;
    if (nl === t) return true;
    if (t.length >= 10 && (nl.includes(t) || t.includes(nl))) return true;
    if (t.length >= 6 && nl.length >= 6) {
      const a = t.split(/\s+/).filter((w) => w.length > 3);
      const hit = a.filter((w) => nl.includes(w)).length;
      if (a.length && hit / a.length >= 0.6) return true;
    }
    return false;
  });
}

/** @returns {{ removed: string[], added: string[] }} */
export function diffLineSets(prevText, nextText) {
  const prev = nonEmptyLines(prevText);
  const next = nonEmptyLines(nextText);
  const removed = prev.filter((l) => !lineRetained(l, next));
  const added = next.filter((l) => !lineRetained(l, prev));
  return { removed, added };
}

export function formatSectionsAsText(sections) {
  const lines = [];
  const keys = [
    ...SECTION_ORDER,
    ...Object.keys(sections || {}).filter((k) => !SECTION_ORDER.includes(k)),
  ];
  const seen = new Set();
  for (const key of keys) {
    if (seen.has(key)) continue;
    seen.add(key);
    const block = sections?.[key];
    if (!block?.length) continue;
    lines.push(`[${SECTION_DISPLAY[key] || key.toUpperCase()}]`);
    block.forEach((l) => lines.push(String(l).trim()));
    lines.push('');
  }
  return lines.join('\n').trim();
}

export function flattenStructuredResume(structured) {
  const s = structured || {};
  const id = s.identity || {};
  const lines = [];
  if (id.name) lines.push(id.name);
  if (id.title) lines.push(id.title);
  const contact = [id.location, id.email, id.phone, id.linkedin, id.website].filter(Boolean);
  if (contact.length) lines.push(contact.join(' · '));
  if (s.summary) {
    lines.push('');
    lines.push(s.summary);
  }
  (s.experiences || []).forEach((e) => {
    lines.push('');
    const head = [e.role, e.company, [e.startDate, e.endDate].filter(Boolean).join('–')]
      .filter(Boolean)
      .join(' — ');
    if (head) lines.push(head);
    (e.bullets || []).forEach((b) => lines.push(`· ${b}`));
  });
  if (s.education?.length) {
    lines.push('');
    lines.push('Education');
    s.education.forEach((e) => lines.push(e));
  }
  if (s.clients?.length) {
    lines.push('');
    lines.push('Clients');
    lines.push(s.clients.join(', '));
  }
  if (s.skills?.length) {
    lines.push('');
    lines.push('Skills');
    lines.push(s.skills.join(', '));
  }
  if (s.tools?.length) {
    lines.push('');
    lines.push('Tools');
    lines.push(s.tools.join(', '));
  }
  if (s.languages?.length) {
    lines.push('');
    lines.push('Languages');
    lines.push(s.languages.join(', '));
  }
  if (s.interests?.length) {
    lines.push('');
    lines.push('Interests');
    lines.push(s.interests.join(', '));
  }
  return lines.join('\n').trim();
}

function collectStructuredSearchLines(structured) {
  const s = structured || {};
  const id = s.identity || {};
  const buckets = {
    contact: [id.email, id.phone, id.location, id.linkedin, id.website].filter(Boolean),
    summary: [s.summary].filter(Boolean),
    experience: [],
    education: [...(s.education || [])],
    skills: [...(s.skills || [])],
    tools: [...(s.tools || [])],
    languages: [...(s.languages || [])],
    clients: [...(s.clients || [])],
    interests: [...(s.interests || [])],
    header: [id.name, id.title].filter(Boolean),
  };
  (s.experiences || []).forEach((e) => {
    buckets.experience.push(
      e.role,
      e.company,
      [e.startDate, e.endDate].filter(Boolean).join(' '),
      ...(e.bullets || [])
    );
  });
  return buckets;
}

function findStructuredFieldForLine(line, structured) {
  const t = String(line || '').trim().toLowerCase();
  if (t.length < 4) return null;
  const buckets = collectStructuredSearchLines(structured);
  for (const [field, values] of Object.entries(buckets)) {
    for (const v of values) {
      const vl = String(v || '').trim().toLowerCase();
      if (!vl || vl.length < 4) continue;
      if (vl === t || vl.includes(t) || t.includes(vl)) return field;
      const words = t.split(/\s+/).filter((w) => w.length > 3);
      if (words.length && words.filter((w) => vl.includes(w)).length / words.length >= 0.55) {
        return field;
      }
    }
  }
  return null;
}

export function detectReclassified(sections, structured) {
  const out = [];
  for (const [section, lines] of Object.entries(sections || {})) {
    if (!lines?.length) continue;
    const expected = CLASSIFIED_TO_FIELD[section] || section;
    for (const line of lines) {
      const trimmed = String(line || '').trim();
      if (trimmed.length < 8 || /^\[/.test(trimmed)) continue;
      const field = findStructuredFieldForLine(trimmed, structured);
      if (!field) {
        out.push({ line: trimmed, from: section, to: '(lost)' });
      } else if (field !== expected) {
        out.push({ line: trimmed, from: section, to: field });
      }
    }
  }
  return out.slice(0, 40);
}

export {
  buildOcrForensic as buildExtractionTrace,
  renderOcrForensic as renderExtractionTrace,
  buildOcrForensic,
  renderOcrForensic,
  logOcrForensic,
  pinpointCorruption,
  diffStageLines,
  FORENSIC_STAGE_IDS,
  FORENSIC_STAGE_LABELS,
} from './ocr-forensic.js';
