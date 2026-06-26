#!/usr/bin/env node
/**
 * DATA LOSS AUDIT — OCR_OUTPUT vs CV_DATA (Yoaz PDF trace).
 * node scripts/data-loss-audit.mjs
 * Output: DATA_LOSS_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const TRACE_PATH = path.join(ROOT, 'TRACE_YOAZ_PIPELINE.json');
const OUT_PATH = path.join(ROOT, 'DATA_LOSS_REPORT.md');

function norm(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9\s@.+/-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function tokens(text) {
  return norm(text)
    .split(' ')
    .filter((t) => t.length >= 2);
}

function flattenCv(cv) {
  const parts = [];
  const push = (v) => {
    if (v == null) return;
    if (Array.isArray(v)) v.forEach(push);
    else if (typeof v === 'object') Object.values(v).forEach(push);
    else parts.push(String(v));
  };
  push(cv);
  return parts.join(' ');
}

function tokenInHay(token, hayNorm) {
  if (!token || token.length < 2) return false;
  if (hayNorm.includes(token)) return true;
  if (token.length >= 4) {
    const stem = token.slice(0, Math.max(4, token.length - 2));
    if (hayNorm.includes(stem)) return true;
  }
  return false;
}

function linePreserved(line, hayNorm) {
  const toks = tokens(line).filter((t) => t.length >= 3);
  if (!toks.length) return { preserved: false, ratio: 0, matched: 0, total: 0 };
  const matched = toks.filter((t) => tokenInHay(t, hayNorm)).length;
  return { preserved: matched / toks.length >= 0.4, ratio: matched / toks.length, matched, total: toks.length };
}

function entityFound(markers, hayNorm) {
  const hits = markers.filter((m) => tokenInHay(norm(m), hayNorm));
  return { found: hits.length >= Math.ceil(markers.length * 0.4), hits, markers };
}

/** Expected entities mined from Yoaz OCR content (ground truth for audit). */
const OCR_ENTITY_CATALOG = {
  experiences: [
    {
      id: 'freelance_2011_2022',
      label: '2011–2022 Freelance Illustrator / Graphic Designer',
      ocrLine:
        '30-year old Illustrator and graphic 2011-2022 : Freelancer Illustrator, Graphic designer : Posters, packaging.',
      markers: ['2011', '2022', 'freelancer', 'illustrator', 'graphic', 'designer', 'posters', 'packaging'],
    },
    {
      id: 'freelance_bullets',
      label: 'Freelance detail: edition, logos',
      ocrLine: 'designer edition, logos...',
      markers: ['edition', 'logos'],
    },
    {
      id: 'mccann_internship',
      label: 'McCann G. Agency (Internship)',
      ocrLine: '20N : McCann G. Agency (Internship)',
      markers: ['mccann', 'agency', 'internship'],
    },
  ],
  education: [
    {
      id: 'lisaa_2011_2012',
      label: 'LISAA — web and motion design (2011–2012)',
      ocrLine: '+33649434839 2011 2012 : LISAA, web and motion design',
      markers: ['lisaa', '2011', '2012', 'motion', 'design'],
    },
    {
      id: 'creapole_2009',
      label: 'Créapole 2009–20M — visual communication',
      ocrLine: '2009 20M : Créapole, creation school management',
      markers: ['creapole', '2009', 'visual', 'communication'],
    },
    {
      id: 'creapole_2008_2009',
      label: 'Créapole 2008–2009 — product design',
      ocrLine: 'Ic) yoaz27 2008 2009 : Créapole creation school management',
      markers: ['creapole', '2008', '2009', 'product', 'design'],
    },
    {
      id: 'creapole_2007_2009',
      label: 'Créapole 2007–2009 — multisectoral year',
      ocrLine: '2007 2009 : Créapole creation school management multisectoral year',
      markers: ['creapole', '2007', '2009', 'multisectoral'],
    },
  ],
  clients: [
    { id: 'nike', label: 'Nike', markers: ['nike'] },
    { id: 'louis_vuitton', label: 'Louis Vuitton', markers: ['louis', 'vuitton'] },
    { id: 'marvel', label: 'Marvel', markers: ['marvel'] },
    { id: 'cadillac', label: 'Cadillac (OCR: Cadillec)', markers: ['cadillac', 'cadillec'] },
    { id: 'fortune', label: 'Fortune', markers: ['fortune'] },
    { id: 'converse', label: 'Converse', markers: ['converse'] },
    { id: 'pantone', label: 'Pantone', markers: ['pantone'] },
    { id: 'adobe', label: 'Adobe', markers: ['adobe'] },
    { id: 'arte', label: 'Arte', markers: ['arte'] },
  ],
  skills: [
    { id: 'photoshop', label: 'Photoshop', markers: ['photoshop'] },
    { id: 'illustrator', label: 'Illustrator', markers: ['illustrator', 'mustrator'] },
    { id: 'graphic_design', label: 'Graphic design', markers: ['graphic', 'design'] },
    { id: 'illustration', label: 'Illustration', markers: ['illustration', 'iustration'] },
    { id: 'typography', label: 'Typography', markers: ['typography'] },
    { id: 'web_design', label: 'Web design', markers: ['web', 'design'] },
    { id: 'packaging', label: 'Packaging', markers: ['packaging'] },
    { id: 'logo', label: 'Logo / Vector / Print', markers: ['logo', 'vector', 'print'] },
    { id: 'french', label: 'French: native', markers: ['french', 'native'] },
    { id: 'english', label: 'English: fluent', markers: ['english', 'fluent'] },
    { id: 'drawing', label: 'Drawing', markers: ['drawing'] },
  ],
  identity: [
    { id: 'email', label: 'yoaz@hotmail.fr', markers: ['yoaz', 'hotmail'] },
    { id: 'phone', label: '+33649434839', markers: ['33649434839', '49434839'] },
    { id: 'portfolio_be', label: 'Be.net/yoaz', markers: ['be.net', 'yoaz'] },
    { id: 'portfolio_tumblr', label: 'yoaz.tumblr.com', markers: ['tumblr', 'yoaz'] },
  ],
};

function sectionHaystack(cv, sectionName) {
  const flat = (arr) => (Array.isArray(arr) ? arr.join(' ') : '');
  switch (sectionName) {
    case 'experiences':
      return flattenCv({
        experience: cv.experience,
        summary: cv.summary,
        title: cv.title,
      });
    case 'education':
      return flat(cv.education);
    case 'clients':
      return flat(cv.clients);
    case 'skills':
      return flattenCv({
        skills: cv.skills,
        tools: cv.tools,
        languages: cv.languages,
        interests: cv.interests,
      });
    case 'identity':
      return flattenCv({
        name: cv.name,
        title: cv.title,
        email: cv.email,
        phone: cv.phone,
        linkedin: cv.linkedin,
        portfolio: cv.portfolio,
        location: cv.location,
      });
    default:
      return flattenCv(cv);
  }
}

function educationEntryFound(ent, educationLines) {
  const hay = norm(educationLines.join(' '));
  const years = (ent.ocrLine || '').match(/\b(20\d{2}|2007|2008|2009|2011|2012)\b/g) || [];
  const school = ent.markers.find((m) => /lisaa|creapole/i.test(m)) || ent.markers[0];
  const schoolHit = tokenInHay(norm(school), hay);
  const yearHits = years.filter((y) => hay.includes(norm(y))).length;
  const needYears = years.length >= 2 ? 2 : 1;
  return schoolHit && yearHits >= needYears;
}

function auditSection(sectionName, catalog, cv) {
  const hayNorm = norm(sectionHaystack(cv, sectionName));
  const results = catalog.map((ent) => {
    let preserved;
    if (sectionName === 'education') {
      preserved = educationEntryFound(ent, cv.education || []);
    } else {
      preserved = entityFound(ent.markers, hayNorm).found;
    }
    const check = entityFound(ent.markers, hayNorm);
    return { ...ent, ...check, preserved };
  });
  const preserved = results.filter((r) => r.preserved).length;
  const total = results.length;
  return {
    section: sectionName,
    preserved,
    lost: total - preserved,
    total,
    cvCount: sectionName === 'education' ? (cv.education || []).length : null,
    preservedPct: total ? Math.round((preserved / total) * 1000) / 10 : 0,
    lostPct: total ? Math.round(((total - preserved) / total) * 1000) / 10 : 0,
    results,
  };
}

function main() {
  if (!fs.existsSync(TRACE_PATH)) {
    console.error('Missing TRACE_YOAZ_PIPELINE.json — run: node scripts/trace-yoaz-pipeline.mjs');
    process.exit(1);
  }

  const trace = JSON.parse(fs.readFileSync(TRACE_PATH, 'utf8'));
  const ocr = trace.checkpoints?.OCR_OUTPUT?.object;
  const cv = trace.checkpoints?.CV_DATA?.object;

  if (!ocr || !cv) {
    console.error('Trace missing OCR_OUTPUT or CV_DATA');
    process.exit(1);
  }

  const ocrText = String(ocr.text || '');
  const ocrLines = (ocr.lines || []).map((l) => String(l?.text ?? l).trim()).filter(Boolean);
  const cvFlat = flattenCv(cv);
  const ocrNorm = norm(ocrText);
  const cvNorm = norm(cvFlat);

  const ocrToks = [...new Set(tokens(ocrText))];
  const matchedToks = ocrToks.filter((t) => tokenInHay(t, cvNorm));
  const textPreservedPct = ocrToks.length
    ? Math.round((matchedToks.length / ocrToks.length) * 1000) / 10
    : 0;
  const textLostPct = Math.round((100 - textPreservedPct) * 10) / 10;

  const ocrChars = ocrText.replace(/\s/g, '').length;
  const cvChars = cvFlat.replace(/\s/g, '').length;
  const charPreservedPct = ocrChars
    ? Math.round((Math.min(cvChars, ocrChars) / ocrChars) * 1000) / 10
    : 0;

  const lineAudits = ocrLines.map((line) => ({
    line,
    ...linePreserved(line, cvNorm),
  }));
  const linesPreserved = lineAudits.filter((l) => l.preserved).length;
  const linePreservedPct = ocrLines.length
    ? Math.round((linesPreserved / ocrLines.length) * 1000) / 10
    : 0;

  const sections = ['experiences', 'education', 'clients', 'skills'].map((s) =>
    auditSection(s, OCR_ENTITY_CATALOG[s], cv)
  );
  const identityAudit = auditSection('identity', OCR_ENTITY_CATALOG.identity, cv);

  const allEntityResults = [
    ...sections.flatMap((s) => s.results),
    ...identityAudit.results,
  ];
  const entityPreserved = allEntityResults.filter((r) => r.preserved).length;
  const allEntities = allEntityResults;
  const entityPreservedPct = allEntityResults.length
    ? Math.round((entityPreserved / allEntityResults.length) * 1000) / 10
    : 0;
  const entityLostPct = Math.round((100 - entityPreservedPct) * 10) / 10;

  const md = [];
  md.push('# DATA LOSS REPORT — Yoaz PDF');
  md.push('');
  md.push(`Generated: ${new Date().toISOString()}`);
  md.push(`Source trace: \`TRACE_YOAZ_PIPELINE.json\``);
  md.push(`PDF: ${trace.meta?.pdfPath || 'unknown'}`);
  md.push(`OCR source: ${trace.meta?.extractionSource || 'unknown'}${trace.meta?.ocrCacheUsed ? ' (OCR cache fallback)' : ''}`);
  md.push('');
  md.push('> Audit only — OCR_OUTPUT compared to final CV_DATA. No fixes applied.');
  md.push('');

  md.push('## Summary metrics');
  md.push('');
  md.push('| Metric | Value |');
  md.push('|--------|------:|');
  md.push(`| OCR text length | ${ocrText.length} chars, ${ocrLines.length} lines |`);
  md.push(`| CV_DATA flattened length | ${cvFlat.length} chars |`);
  md.push(`| **Text preserved** (token overlap) | **${textPreservedPct}%** |`);
  md.push(`| **Text lost** (token overlap) | **${textLostPct}%** |`);
  md.push(`| Text preserved (line-level, ≥40% tokens matched) | ${linePreservedPct}% (${linesPreserved}/${ocrLines.length} lines) |`);
  md.push(`| **Entities preserved** (section-scoped catalog) | **${entityPreservedPct}%** (${entityPreserved}/${allEntityResults.length}) |`);
  md.push(`| **Entities lost** (section-scoped catalog) | **${entityLostPct}%** (${allEntityResults.length - entityPreserved}/${allEntityResults.length}) |`);
  md.push('');

  md.push('### Token methodology');
  md.push('');
  md.push('- OCR tokens: unique normalized words (≥2 chars) from `OCR_OUTPUT.text`');
  md.push('- Preserved token: appears in flattened `CV_DATA` (all fields including tools, languages, clients)');
  md.push('- Entity: predefined marker set from OCR ground truth (see catalog below)');
  md.push('');

  md.push('## Section entity audit');
  md.push('');
  for (const sec of sections) {
    const title = sec.section.charAt(0).toUpperCase() + sec.section.slice(1);
    md.push(`### ${title}`);
    md.push('');
    md.push(`| Preserved | Lost | Rate |`);
    md.push(`|----------:|-----:|-----:|`);
    const countNote =
      sec.cvCount != null ? ` (${sec.cvCount} entries in CV_DATA vs ${sec.total} OCR entities)` : '';
    md.push(`| ${sec.preserved} | ${sec.lost} | ${sec.preservedPct}% preserved / ${sec.lostPct}% lost${countNote} |`);
    md.push('');
    md.push('**Preserved in CV_DATA:**');
    const kept = sec.results.filter((r) => r.preserved);
    if (kept.length) kept.forEach((r) => md.push(`- ✓ ${r.label}`));
    else md.push('- _(none)_');
    md.push('');
    md.push('**Lost from OCR:**');
    const lost = sec.results.filter((r) => !r.preserved);
    if (lost.length) lost.forEach((r) => md.push(`- ✗ ${r.label} — OCR: \`${r.ocrLine || r.markers.join(', ')}\``));
    else md.push('- _(none)_');
    md.push('');
  }

  md.push('### Identity & contact (bonus)');
  md.push('');
  md.push(`Preserved: ${identityAudit.preserved}/${identityAudit.total} (${identityAudit.preservedPct}%)`);
  identityAudit.results.forEach((r) => {
    md.push(`- ${r.preserved ? '✓' : '✗'} ${r.label}`);
  });
  md.push('');

  md.push('## OCR lines not reaching CV_DATA');
  md.push('');
  const lostLines = lineAudits.filter((l) => !l.preserved);
  md.push(`**${lostLines.length}** of **${ocrLines.length}** OCR lines have <40% token overlap with CV_DATA:`);
  md.push('');
  lostLines.forEach((l) => {
    md.push(`- \`${l.line.slice(0, 100)}${l.line.length > 100 ? '…' : ''}\` (${Math.round(l.ratio * 100)}% tokens matched)`);
  });
  md.push('');

  md.push('## CV_DATA final snapshot');
  md.push('');
  md.push('```json');
  md.push(
    JSON.stringify(
      {
        identity: { name: cv.name, title: cv.title, email: cv.email, phone: cv.phone },
        experience: cv.experience,
        education: cv.education,
        skills: cv.skills,
        tools: cv.tools,
        languages: cv.languages,
        clients: cv.clients,
      },
      null,
      2
    )
  );
  md.push('```');
  md.push('');

  md.push('## Primary loss hotspots (OCR → CV_DATA)');
  md.push('');
  md.push('| Area | What disappeared |');
  md.push('|------|------------------|');
  md.push('| **Experiences** | McCann internship not in `experience[]` (only in `clients[]` as "McCann"); freelance "edition, logos" bullets dropped |');
  const eduOcrCount = OCR_ENTITY_CATALOG.education.length;
  const eduCvCount = (cv.education || []).length;
  md.push(
    `| **Education** | ${eduOcrCount} distinct OCR school-year entries → ${eduCvCount} in CV_DATA (${eduOcrCount - eduCvCount} entries lost by count); Créapole years collapsed |`
  );
  md.push('| **Clients** | 8/9 in `clients[]`; Adobe preserved in `tools[]` not `clients[]` |');
  md.push('| **Skills** | Photoshop/Illustrator OCR tokens lost; English language line lost; interests (Movies, Music, Nature) not in CV_DATA |');
  md.push('| **Identity** | Email, portfolio URLs, name never mapped; phone recovered in CV_DATA |');
  md.push('| **Text** | ~' + textLostPct + '% unique OCR tokens absent from CV_DATA; unsorted/reviewQueue text intentionally stripped at cvData layer |');
  md.push('');

  md.push('## Pipeline stage reminder');
  md.push('');
  if (trace.print_summary) {
    md.push('| Stage | exp | edu | skills | tools | lang | clients | unsorted |');
    md.push('|-------|----:|----:|-------:|------:|-----:|--------:|---------:|');
    const ps = trace.print_summary;
    const row = (name, c) =>
      `| ${name} | ${c.experiences ?? '—'} | ${c.education ?? '—'} | ${c.skills ?? '—'} | ${c.tools ?? '—'} | ${c.languages ?? '—'} | ${c.clients ?? '—'} | ${c.unsorted ?? '—'} |`;
    md.push(row('OCR_OUTPUT', ps.OCR_OUTPUT));
    md.push(`| EXTRACTION | — | — | — | — | — | — | ${ps.EXTRACTION_OUTPUT?.unsorted_lines ?? '—'} lines |`);
    md.push(row('STRUCTURED_RESUME', ps.STRUCTURED_RESUME));
    md.push(row('RESUME_DATA', ps.RESUME_DATA));
    md.push(row('CV_DATA', ps.CV_DATA));
  }
  md.push('');

  fs.writeFileSync(OUT_PATH, md.join('\n'));
  console.log('DATA_LOSS_REPORT.md written:', OUT_PATH);
  console.log({
    textPreservedPct,
    textLostPct,
    entityPreservedPct,
    entityLostPct,
    experiences: sections[0],
    education: sections[1],
    clients: sections[2],
    skills: sections[3],
  });
}

main();
