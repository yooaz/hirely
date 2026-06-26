/**
 * Debug-only parser observability — counts and where text may disappear.
 */

function normLine(s) {
  return String(s || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function collectResumeLines(rd) {
  const lines = [];
  if (!rd) return lines;
  const push = (t) => {
    const s = String(t || '').trim();
    if (s.length > 1) lines.push(s);
  };
  const id = rd.identity || {};
  push(id.name);
  push(id.title);
  push(id.email);
  push(id.phone);
  push(id.location);
  push(id.website);
  push(id.linkedin);
  push(rd.summary);
  for (const x of rd.education || []) push(x);
  for (const x of rd.clients || []) push(x);
  for (const x of rd.projects || []) push(x);
  for (const x of rd.skills || []) push(x);
  for (const x of rd.tools || []) push(x);
  for (const x of rd.languages || []) push(x);
  for (const x of rd.unsorted || []) push(x);
  for (const ex of rd.experiences || []) {
    push(ex.role);
    push(ex.company);
    push(ex.location);
    push(ex.dates);
    for (const b of ex.bullets || []) push(b);
  }
  return lines;
}

function charCount(lines) {
  return lines.reduce((n, l) => n + String(l).length, 0);
}

/**
 * @param {object} snapshot
 * @param {string} snapshot.rawText
 * @param {string} snapshot.cleanText
 * @param {object[]} [snapshot.blocks]
 * @param {object|null} snapshot.resumeData
 * @param {object|null} snapshot.templateData
 * @param {object|null} snapshot.structuredResume
 * @param {string[]} [snapshot.rejectedLines]
 */
export function buildParserObservabilityReport(snapshot = {}) {
  const rawText = String(snapshot.rawText || '');
  const cleanText = String(snapshot.cleanText || '');
  const blocks = Array.isArray(snapshot.blocks) ? snapshot.blocks : [];
  const rd = snapshot.resumeData || null;
  const tpl = snapshot.templateData || null;
  const sr = snapshot.structuredResume || null;
  const rejected = snapshot.rejectedLines || [];

  const cleanLines = cleanText
    .split(/\r?\n/)
    .map((l) => l.trim())
    .filter((l) => l.length > 1);
  const resumeLines = collectResumeLines(rd);
  const resumeNorm = new Set(resumeLines.map(normLine));
  const missingLines = [];
  for (const line of cleanLines) {
    const k = normLine(line);
    if (!k) continue;
    if (resumeNorm.has(k)) continue;
    let found = false;
    for (const r of resumeLines) {
      const rk = normLine(r);
      if (rk.length > 10 && (k.includes(rk) || rk.includes(k))) {
        found = true;
        break;
      }
    }
    if (!found) missingLines.push(line);
  }

  const blockChars = blocks.reduce((n, b) => n + String(b.text || '').length, 0);
  const tplUnsorted = (tpl?.unsorted || tpl?.toClassify?.map((x) => x.text) || []).length;

  return {
    counts: {
      rawText: rawText.length,
      cleanText: cleanText.length,
      cleanLines: cleanLines.length,
      blocks: blocks.length,
      blockChars,
      rejectedLines: rejected.length,
      resumeDataLines: resumeLines.length,
      resumeDataChars: charCount(resumeLines),
      unsorted: (rd?.unsorted || []).length,
      experiences: (rd?.experiences || []).length,
      structuredResumeJson: sr ? JSON.stringify(sr).length : 0,
      templateDataFields: tpl
        ? Object.keys(tpl).filter((k) => !k.startsWith('_')).length
        : 0,
      templateUnsorted: tplUnsorted,
    },
    disappearance: {
      cleanToResumeGap: Math.max(0, cleanText.length - charCount(resumeLines)),
      orphanLineCount: missingLines.length,
      orphanPreview: missingLines.slice(0, 12),
      rejectedPreview: rejected.slice(0, 8),
    },
    blocksPreview: blocks.slice(0, 8).map((b) => ({
      type: b.type || b.bucket || 'unknown',
      chars: String(b.text || '').length,
      accepted: b.accepted !== false,
    })),
  };
}

/**
 * @param {ReturnType<typeof buildParserObservabilityReport>} report
 */
export function formatParserObservabilityHtml(report, esc = (s) => String(s)) {
  if (!report) return '';
  const c = report.counts;
  const d = report.disappearance;
  const blocks =
    report.blocksPreview
      ?.map(
        (b) =>
          `<li>${esc(b.type)} · ${b.chars} chars · ${b.accepted ? 'ok' : 'rejected'}</li>`
      )
      .join('') || '<li>—</li>';
  const orphans = d.orphanPreview?.length
    ? `<pre>${esc(d.orphanPreview.join('\n'))}</pre>`
    : '<p class="hirelyDebugMeta">(none — all clean lines accounted in resumeData)</p>';
  const rej = d.rejectedPreview?.length
    ? `<pre>${esc(d.rejectedPreview.join('\n'))}</pre>`
    : '<p class="hirelyDebugMeta">(none)</p>';
  return `<div class="hirelyDebugStage" id="hirelyParserObs">
<strong>PARSER OBSERVABILITY</strong>
<div class="hirelyDebugMeta">rawText ${c.rawText} chars · cleanText ${c.cleanText} chars (${c.cleanLines} lines)</div>
<div class="hirelyDebugMeta">blocks ${c.blocks} (${c.blockChars} chars) · rejectedLines ${c.rejectedLines}</div>
<div class="hirelyDebugMeta">resumeData ${c.resumeDataLines} lines / ${c.resumeDataChars} chars · unsorted ${c.unsorted} · exp ${c.experiences}</div>
<div class="hirelyDebugMeta">structuredResume JSON ${c.structuredResumeJson} · template unsorted ${c.templateUnsorted}</div>
<div class="hirelyDebugMeta"><strong>Where content may disappear</strong> — gap ${d.cleanToResumeGap} chars · orphan lines ${d.orphanLineCount}</div>
<div class="hirelyDebugMeta">Orphan lines (in cleanText, not in resumeData):</div>${orphans}
<div class="hirelyDebugMeta">Rejected lines (should land in unsorted):</div>${rej}
<div class="hirelyDebugMeta">Blocks sample:</div><ul class="hirelyDebugMeta">${blocks}</ul>
<strong>rawText</strong><pre>${esc(String(report._rawPreview || '').slice(0, 2000))}</pre>
<strong>cleanText</strong><pre>${esc(String(report._cleanPreview || '').slice(0, 2000))}</pre>
<strong>resumeData</strong><pre>${esc(JSON.stringify(report._resumePreview || {}, null, 2).slice(0, 3500))}</pre>
<strong>templateData</strong><pre>${esc(JSON.stringify(report._templatePreview || {}, null, 2).slice(0, 2500))}</pre>
</div>`;
}
