/**
 * P5 — Real-world CV layout transformers (Canva, InDesign, Figma, Word, etc.).
 * Ground truth stays on canonical text; import runs on layout-transformed text.
 */

const SECTION_RE =
  /^(experience|work experience|employment|expérience|education|formation|skills|compétences|tools|languages|langues|summary|profil|profile|interests|clients|projects|certifications)\b/i;

function linesOf(text) {
  return String(text || '')
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 0);
}

function parseBlocks(text) {
  const lines = linesOf(text);
  const header = [];
  const sections = [];
  let current = { title: '_header', lines: [] };

  for (const line of lines) {
    if (SECTION_RE.test(line) && line.length < 48) {
      if (current.lines.length) sections.push(current);
      current = { title: line, lines: [] };
      continue;
    }
    if (current.title === '_header' && sections.length === 0) {
      header.push(line);
    } else {
      current.lines.push(line);
    }
  }
  if (current.lines.length) sections.push(current);
  return { header, sections };
}

function joinBlocks(header, sections, formatter) {
  return formatter({ header, sections });
}

function layoutWord({ header, sections }) {
  const out = ['CURRICULUM VITAE', '', ...header, ''];
  for (const s of sections) {
    out.push(s.title.toUpperCase());
    out.push('\t'.repeat(0));
    for (const l of s.lines) out.push(`\t${l}`);
    out.push('');
  }
  return out.join('\n');
}

function layoutPages({ header, sections }) {
  const out = ['Résumé', '—'.repeat(24), '', ...header, ''];
  for (const s of sections) {
    out.push(s.title);
    out.push('—'.repeat(12));
    out.push(...s.lines, '');
  }
  return out.join('\n');
}

function layoutCanva({ header, sections }) {
  const out = ['════════════════════════════════', ...header.map((l, i) => (i === 0 ? l.toUpperCase() : l)), '════════════════════════════════', ''];
  for (const s of sections) {
    out.push(`✦ ${s.title.toUpperCase()} ✦`);
    for (const l of s.lines) out.push(l.startsWith('-') ? `  ◆ ${l.replace(/^[-•*]\s*/, '')}` : `  ${l}`);
    out.push('');
  }
  return out.join('\n');
}

function layoutInDesign({ header, sections }) {
  const out = [...header.map((l) => l.replace(/-/g, '–'))];
  out.push('');
  for (const s of sections) {
    out.push(s.title.replace(/\s+/g, ' ').toUpperCase());
    for (const l of s.lines) out.push(l.replace(/\s+-\s+/g, ' – ').replace(/(\d{4})\s*-\s*(\d{4}|Present)/gi, '$1 – $2'));
    out.push('');
  }
  return out.join('\n');
}

function layoutFigma({ header, sections }) {
  const out = [...header.slice(0, 2), ...(header.slice(2).map((l) => l.toLowerCase())), ''];
  for (const s of sections) {
    out.push(s.title.toLowerCase());
    out.push(...s.lines);
    out.push('');
  }
  return out.join('\n');
}

function layoutLinkedIn({ header, sections }) {
  const name = header[0] || 'Candidate';
  const title = header[1] || '';
  const contact = header.slice(2).join(' · ');
  const slug = name.toLowerCase().replace(/\s+/g, '-');
  const out = [
    name,
    title,
    `linkedin.com/in/${slug}`,
    contact.replace(/·/g, '|'),
    '',
  ];
  for (const s of sections) {
    const label = /experience/i.test(s.title) ? 'Experience' : s.title;
    out.push(label);
    for (const l of s.lines) {
      if (/^[-•*]/.test(l)) out.push(l);
      else out.push(l.replace(/\s+—\s+/g, '\n'));
    }
    out.push('');
  }
  return out.join('\n');
}

function layoutEuropass({ header, sections }) {
  const out = [
    'EUROPASS',
    'CURRICULUM VITAE',
    '',
    'Personal information',
    `Name: ${header[0] || ''}`,
    ...(header[1] ? [`Headline: ${header[1]}`] : []),
    ...(header.slice(2).map((l) => `Contact: ${l}`)),
    '',
  ];
  for (const s of sections) {
    let title = s.title;
    if (/experience/i.test(title)) title = 'Work experience';
    if (/education/i.test(title)) title = 'Education and training';
    if (/skills/i.test(title)) title = 'Skills';
    if (/languages/i.test(title)) title = 'Language skills';
    if (/tools/i.test(title)) title = 'Digital skills';
    out.push(title);
    for (const l of s.lines) out.push(`• ${l.replace(/^[-•*]\s*/, '')}`);
    out.push('');
  }
  return out.join('\n');
}

function layoutCreativePortfolio({ header, sections }) {
  const out = [
    ...header,
    '',
    'PORTFOLIO — behance.net/' + (header[0] || 'creative').toLowerCase().replace(/\s+/g, ''),
    '',
  ];
  for (const s of sections) {
    out.push(`▸ ${s.title}`);
    out.push(...s.lines);
    out.push('');
  }
  return out.join('\n');
}

function layoutAgencyDesigner({ header, sections }) {
  const out = [...header, '', 'AGENCY PROFILE', ''];
  for (const s of sections) {
    if (/client/i.test(s.title)) {
      out.push('SELECTED CLIENTS');
      out.push(...s.lines);
    } else {
      out.push(s.title.toUpperCase());
      out.push(...s.lines);
    }
    out.push('');
  }
  return out.join('\n');
}

function layoutDeveloper({ header, sections }) {
  const out = [
    ...header,
    header[2] ? `GitHub · ${header[2].match(/github\.com\/\S+/)?.[0] || 'github.com/dev'}` : '',
    '',
  ].filter(Boolean);
  for (const s of sections) {
    out.push(`## ${s.title}`);
    out.push(...s.lines);
    out.push('');
  }
  return out.join('\n');
}

function layoutExecutive({ header, sections }) {
  const out = [
    (header[0] || '').toUpperCase(),
    header[1] || '',
    ...(header.slice(2)),
    '',
    'EXECUTIVE SUMMARY',
  ];
  const summary = sections.find((s) => /summary|profil/i.test(s.title));
  if (summary) out.push(...summary.lines, '');
  for (const s of sections) {
    if (summary && s === summary) continue;
    out.push(s.title.toUpperCase());
    out.push(...s.lines, '');
  }
  return out.join('\n');
}

const LAYOUT_FNS = {
  word: layoutWord,
  pages: layoutPages,
  canva: layoutCanva,
  indesign: layoutInDesign,
  figma: layoutFigma,
  linkedin: layoutLinkedIn,
  europass: layoutEuropass,
  'creative-portfolio': layoutCreativePortfolio,
  'agency-designer': layoutAgencyDesigner,
  developer: layoutDeveloper,
  executive: layoutExecutive,
};

export const P5_LAYOUT_TYPES = Object.keys(LAYOUT_FNS);

/**
 * @param {string} canonicalText
 * @param {string} layoutId
 */
export function applyHellLayout(canonicalText, layoutId) {
  const fn = LAYOUT_FNS[layoutId];
  if (!fn) return String(canonicalText || '');
  const blocks = parseBlocks(canonicalText);
  return joinBlocks(blocks.header, blocks.sections, fn);
}
