/**
 * Parser Lab — human-readable snapshot of every parser decision (paste-only).
 */

import { NAME_UNCERTAIN_LABEL, NAME_CANDIDATE_SEP } from '../core/parsing/parser-recovery.js';

function listHtml(items, empty = '—') {
  const arr = (items || []).map((x) => String(x || '').trim()).filter(Boolean);
  if (!arr.length) return `<span class="lab-empty">${empty}</span>`;
  return `<ul class="lab-list">${arr.map((x) => `<li>${escapeHtml(x)}</li>`).join('')}</ul>`;
}

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function row(label, value, meta = '') {
  const v =
    value === null || value === undefined || value === ''
      ? '<span class="lab-empty">—</span>'
      : escapeHtml(String(value));
  const m = meta ? `<span class="lab-meta">${escapeHtml(meta)}</span>` : '';
  return `<div class="lab-row"><span class="lab-k">${escapeHtml(label)}</span><span class="lab-v">${v}${m}</span></div>`;
}

function experienceHtml(exps) {
  const list = exps || [];
  if (!list.length) return '<span class="lab-empty">—</span>';
  return list
    .map((e, i) => {
      const role = escapeHtml(e.role || '(no role)');
      const company = escapeHtml(e.company || '');
      const dates = [e.startDate, e.endDate].filter(Boolean).join(' – ');
      const bullets = (e.bullets || []).length;
      const head = `<strong>${i + 1}. ${role}</strong>${company ? ` · ${company}` : ''}${dates ? ` <em>${escapeHtml(dates)}</em>` : ''}`;
      const bl =
        e.bullets?.length ?
          `<ul class="lab-bullets">${e.bullets.map((b) => `<li>${escapeHtml(b)}</li>`).join('')}</ul>`
        : '';
      return `<div class="lab-exp">${head}<span class="lab-meta">${bullets} bullet(s)</span>${bl}</div>`;
    })
    .join('');
}

/**
 * @param {string} rawText
 * @param {object} pipe — runExtractionPipeline result
 */
export function buildParserLabSnapshot(rawText, pipe) {
  const structured = pipe?.structuredResume || {};
  const id = structured.identity || {};
  const cv = pipe?.validatedCVData || {};
  const name = String(id.name || '').trim();
  const uncertain =
    name === NAME_UNCERTAIN_LABEL ||
    name.includes(NAME_CANDIDATE_SEP) ||
    (structured.nameConfidence != null && structured.nameConfidence < 50);

  return {
    meta: {
      extractionMethod: pipe?.extractionMethod || 'paste',
      timingMs: pipe?.audit?.timingMs ?? null,
      canGenerate: !!pipe?.canGenerate,
      parseConfidence: pipe?.confidenceReport?.overall ?? null,
      rawChars: String(rawText || '').length,
      cleanChars: String(pipe?.cleanedText || '').length,
      rejectedCount: (pipe?.rejectedLines || []).length,
      warnings: pipe?.audit?.warnings || [],
    },
    name: {
      display: name,
      selected: structured.selectedName || '',
      candidates: structured.nameCandidates || [],
      confidence: structured.nameConfidence ?? null,
      uncertain,
    },
    title: {
      display: String(id.title || '').trim(),
      selected: structured.selectedTitle || '',
      candidates: structured.titleCandidates || [],
      confidence: structured.titleConfidence ?? null,
    },
    contact: {
      email: id.email || cv.email || '',
      phone: id.phone || cv.phone || '',
      location: id.location || cv.location || '',
      linkedin: id.linkedin || cv.linkedin || '',
      website: id.website || cv.portfolio || '',
    },
    summary: structured.summary || cv.summary || '',
    experience: structured.experiences || [],
    education: structured.education || [],
    clients: structured.clients || [],
    skills: structured.skills || [],
    tools: structured.tools || [],
    languages: structured.languages || [],
    interests: structured.interests || [],
    needsReview: structured.needsReview || [],
    rejectedLines: pipe?.rejectedLines || [],
    structuredResume: structured,
    validatedCVData: cv,
    parserDetection: pipe?.audit?.parserDetection || null,
  };
}

/** @param {ReturnType<typeof buildParserLabSnapshot>} snap */
export function renderParserLabDecisions(snap) {
  const s = snap || {};
  const m = s.meta || {};
  const warnings =
    m.warnings?.length ?
      `<div class="lab-warn">${m.warnings.map((w) => escapeHtml(w)).join('<br>')}</div>`
    : '';

  return `
<section class="lab-section">
  <h3>Pipeline</h3>
  ${row('Method', m.extractionMethod)}
  ${row('Timing', m.timingMs != null ? `${m.timingMs} ms` : '')}
  ${row('Can generate', m.canGenerate ? 'yes' : 'no')}
  ${row('Confidence', m.parseConfidence != null ? `${m.parseConfidence}%` : '')}
  ${row('Raw → clean', `${m.rawChars} → ${m.cleanChars} chars`)}
  ${row('Rejected lines', m.rejectedCount)}
  ${warnings}
</section>
<section class="lab-section">
  <h3>Name</h3>
  ${row('Display', s.name?.display, s.name?.uncertain ? 'uncertain' : s.name?.confidence != null ? `conf ${s.name.confidence}` : '')}
  ${row('Selected', s.name?.selected)}
  ${row('Candidates', (s.name?.candidates || []).join(' · ') || '—')}
</section>
<section class="lab-section">
  <h3>Title</h3>
  ${row('Display', s.title?.display, s.title?.confidence != null ? `conf ${s.title.confidence}` : '')}
  ${row('Selected', s.title?.selected)}
  ${row('Candidates', (s.title?.candidates || []).join(' · ') || '—')}
</section>
<section class="lab-section">
  <h3>Contact</h3>
  ${row('Email', s.contact?.email)}
  ${row('Phone', s.contact?.phone)}
  ${row('Location', s.contact?.location)}
  ${row('LinkedIn', s.contact?.linkedin)}
  ${row('Website', s.contact?.website)}
</section>
<section class="lab-section">
  <h3>Summary</h3>
  <p class="lab-prose">${s.summary ? escapeHtml(s.summary) : '<span class="lab-empty">—</span>'}</p>
</section>
<section class="lab-section">
  <h3>Experience <span class="lab-count">${(s.experience || []).length}</span></h3>
  <div class="lab-block">${experienceHtml(s.experience)}</div>
</section>
<section class="lab-section">
  <h3>Education <span class="lab-count">${(s.education || []).length}</span></h3>
  ${listHtml(s.education)}
</section>
<section class="lab-section">
  <h3>Clients <span class="lab-count">${(s.clients || []).length}</span></h3>
  ${listHtml(s.clients)}
</section>
<section class="lab-section">
  <h3>Skills <span class="lab-count">${(s.skills || []).length}</span></h3>
  ${listHtml(s.skills)}
</section>
<section class="lab-section">
  <h3>Tools <span class="lab-count">${(s.tools || []).length}</span></h3>
  ${listHtml(s.tools)}
</section>
<section class="lab-section">
  <h3>Languages <span class="lab-count">${(s.languages || []).length}</span></h3>
  ${listHtml(s.languages)}
</section>
<section class="lab-section">
  <h3>Interests <span class="lab-count">${(s.interests || []).length}</span></h3>
  ${listHtml(s.interests)}
</section>
${
  (s.needsReview || []).length ?
    `<section class="lab-section"><h3>Needs review</h3>${listHtml(
      (s.needsReview || []).map((n) => `${n.field}: ${n.detected} → ${n.suggestion}`)
    )}</section>`
  : ''
}
${
  (s.rejectedLines || []).length ?
    `<section class="lab-section"><h3>Rejected lines</h3>${listHtml(s.rejectedLines.slice(0, 24))}</section>`
  : ''
}`;
}
