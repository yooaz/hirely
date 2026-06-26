/**
 * PDF Accuracy Lab — scientific extraction quality report.
 * Pipeline: PDF → raw text → layout blocks → classified → JSON → final CV
 */

import { textStats, linesRemoved, structuredCharCount } from './stats.js';
import { measureTextRetention } from '../core/extraction/stages/extraction-archive.js';
import { structuredToCvData } from '../core/parsing/structured-resume.js';
import { countByType } from '../core/parsing/block-classifier.js';

function esc(s) {
  return String(s ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normLine(s) {
  return String(s || '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

/**
 * Flatten structured resume to comparable text blob.
 * @param {object} structured
 */
export function flattenStructuredText(structured) {
  if (!structured) return '';
  const cv = structuredToCvData(structured);
  const parts = [
    cv.name,
    cv.title,
    cv.email,
    cv.phone,
    cv.location,
    cv.linkedin,
    cv.portfolio,
    cv.summary,
    ...(cv.experience || []),
    ...(cv.education || []),
    ...(cv.skills || []),
    ...(cv.tools || []),
    ...(cv.languages || []),
    ...(cv.clients || []),
    ...(cv.interests || []),
    ...(cv.awards || []),
    ...(cv.publications || []),
  ];
  return parts
    .flat()
    .map((x) => String(x || '').trim())
    .filter((x) => x.length > 1)
    .join('\n');
}

/**
 * Lines from raw extraction not found in render output.
 * @param {string} rawText
 * @param {object[]} renderBlocks
 * @param {object} structured
 */
export function findDroppedLines(rawText, renderBlocks = [], structured = null) {
  const renderBlob = [
    ...renderBlocks.map((b) => b.text || ''),
    flattenStructuredText(structured),
  ]
    .join('\n')
    .toLowerCase();

  const dropped = [];
  const rawLines = String(rawText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter((l) => l.length > 2);

  for (const line of rawLines) {
    const n = normLine(line);
    if (n.length < 4) continue;
    if (renderBlob.includes(n)) continue;
    const tokens = n.split(' ').filter((t) => t.length > 3);
    const partial = tokens.length >= 2 && tokens.every((t) => renderBlob.includes(t));
    if (!partial) dropped.push(line);
  }
  return dropped;
}

/**
 * @param {object[]} classifiedBlocks
 */
export function findClassificationErrors(classifiedBlocks = []) {
  const errors = [];
  for (const b of classifiedBlocks) {
    for (const v of b.validationViolations || []) {
      errors.push({
        blockId: b.id,
        rule: v.rule,
        from: v.from,
        to: v.to,
        text: (v.text || b.text || '').slice(0, 120),
        severity: 'corrected',
      });
    }
    if (b.needsReview || b.accepted === false) {
      errors.push({
        blockId: b.id,
        rule: b.type === 'unknown' ? 'unknown_block' : 'low_confidence',
        from: b.type,
        to: 'review_queue',
        text: (b.text || '').slice(0, 120),
        severity: 'review',
        confidence: b.confidence,
        reason: b.classificationReason,
      });
    }
    if (b.type === 'experience' && b.dictionaryMatch?.entity === 'school') {
      errors.push({
        blockId: b.id,
        rule: 'school_in_experience',
        from: 'experience',
        to: 'education',
        text: (b.text || '').slice(0, 120),
        severity: 'leak',
      });
    }
  }
  return errors;
}

/**
 * @param {object} input
 * @param {object} input.detailed — extractFromFileDetailed result
 * @param {object} input.p0 — runP0Pipeline result
 * @param {object} [input.production] — runProductionExtractionPipeline result
 * @param {string} [input.fileName]
 * @param {number} [input.pageCount]
 */
export function buildPdfAccuracyReport(input = {}) {
  const { detailed, p0, production, fileName = '', pageCount = 0 } = input;
  const enterprise = detailed?.enterprise || {};
  const rawText = enterprise.rawExtraction || detailed?.text || '';
  const cleanedText = enterprise.cleanedText || rawText;
  const structured = p0?.structuredResume || production?.structuredResume || null;
  const cvData = production?.validatedCVData || (structured ? structuredToCvData(structured) : null);
  const renderBlocks = p0?.renderBlocks || [];
  const classifiedBlocks = p0?.classifiedBlocks || [];

  const rawStats = textStats(rawText);
  const cleanStats = textStats(cleanedText);
  const removed = linesRemoved(rawText, cleanedText);
  const retention = measureTextRetention(rawText, cleanedText, cvData, enterprise.lines || []);
  const structuredText = flattenStructuredText(structured);
  const droppedLines = findDroppedLines(rawText, renderBlocks, structured);
  const classificationErrors = findClassificationErrors(classifiedBlocks);
  const sectionTypes = countByType(classifiedBlocks);

  const detectedSections = Object.entries(sectionTypes)
    .filter(([, n]) => n > 0)
    .map(([k]) => k);

  return {
    fileName,
    pageCount: pageCount || enterprise.metadata?.pages || detailed?.pdfExtraction?.pages || 1,
    extractionMethod: detailed?.method || enterprise.method,
    pdfRoute: detailed?.pdfExtraction?.routing?.route || detailed?.pdfExtraction?.method,
    metrics: {
      pages: pageCount || enterprise.metadata?.pages || 1,
      rawChars: rawStats.chars,
      rawLines: rawStats.nonEmptyLines,
      cleanChars: cleanStats.chars,
      textBlocks: p0?.reading?.blockCount ?? p0?.blocks?.blocks?.length ?? 0,
      geometricBlocks: p0?.blocks?.blocks?.length ?? 0,
      classifiedBlocks: classifiedBlocks.length,
      renderBlocks: renderBlocks.length,
      reviewBlocks: p0?.reviewBlocks?.length ?? 0,
      columns: {
        splitX: p0?.columns?.splitX,
        leftCount: p0?.columns?.leftCount,
        rightCount: p0?.columns?.rightCount,
        multiColumn: p0?.columns?.multiColumn,
      },
      layoutType: p0?.layout?.layoutType,
      layoutConfidence: p0?.layout?.confidence,
      detectedSections,
      sectionTypeCounts: sectionTypes,
      confidenceOverall: p0?.confidence?.overallConfidence ?? 0,
      confidenceThreshold: p0?.confidence?.threshold ?? 70,
      textLossPct: retention.lossPct,
      retentionPct: retention.retentionPct,
      linesRemoved: removed.count,
      classificationErrorCount: classificationErrors.length,
      droppedLineCount: droppedLines.length,
    },
    stages: {
      rawText,
      cleanedText,
      rawLines: (enterprise.lines || []).map((l, i) => ({
        i,
        page: l.page ?? 1,
        x: Math.round(l.x ?? 0),
        y: Math.round(l.y ?? 0),
        w: Math.round(l.width ?? 0),
        h: Math.round(l.height ?? 0),
        text: l.text || l.cleanedText || '',
        confidence: l.confidence,
      })),
      layout: p0?.layout || null,
      columns: p0?.columns || null,
      reading: p0?.reading || null,
      layoutBlocks: (p0?.reading?.orderedBlocks || []).map((b) => ({
        id: b.id,
        column: b.column,
        sectionHint: b.sectionHint || b.sectionKey,
        x: Math.round(b.x ?? 0),
        y: Math.round(b.y ?? 0),
        text: String(b.text || '').slice(0, 500),
        lineCount: b.lineCount,
      })),
      classifiedBlocks: classifiedBlocks.map((b) => ({
        id: b.id,
        type: b.type,
        confidence: b.confidence,
        accepted: b.accepted,
        page: b.page,
        column: b.column,
        classificationReason: b.classificationReason,
        dictionaryMatch: b.dictionaryMatch || b.entityMatch,
        validationViolations: b.validationViolations,
        text: b.text,
      })),
      structuredResume: structured,
      structuredText,
      cvData,
    },
    droppedLines: droppedLines.slice(0, 80),
    classificationErrors: classificationErrors.slice(0, 40),
    comparison: buildSideBySideComparison(rawText, structuredText, droppedLines),
    p0,
    production,
  };
}

function buildSideBySideComparison(rawText, structuredText, droppedLines) {
  const rawLines = String(rawText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const outLines = String(structuredText || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
  const droppedSet = new Set(droppedLines.map(normLine));

  const rows = [];
  const max = Math.max(rawLines.length, outLines.length, 1);
  for (let i = 0; i < Math.min(max, 120); i++) {
    const raw = rawLines[i] || '';
    const out = outLines[i] || '';
    let status = 'matched';
    if (!raw && out) status = 'added';
    else if (raw && !out) status = 'missing';
    else if (raw && out && normLine(raw) !== normLine(out)) status = 'changed';
    if (raw && droppedSet.has(normLine(raw))) status = 'dropped';
    rows.push({ raw, out, status });
  }
  return rows;
}

export function renderMetricsBar(metrics) {
  const m = metrics || {};
  return `<div class="pal-metrics">
    <div class="pal-metric"><span class="pal-metric-k">Pages</span><span class="pal-metric-v">${m.pages ?? '—'}</span></div>
    <div class="pal-metric"><span class="pal-metric-k">Text blocks</span><span class="pal-metric-v">${m.textBlocks ?? 0}</span></div>
    <div class="pal-metric"><span class="pal-metric-k">Columns</span><span class="pal-metric-v">${m.columns?.multiColumn ? `L${m.columns.leftCount} / R${m.columns.rightCount}` : 'single'}</span></div>
    <div class="pal-metric"><span class="pal-metric-k">Layout</span><span class="pal-metric-v">${esc(m.layoutType || '—')}</span></div>
    <div class="pal-metric"><span class="pal-metric-k">Sections</span><span class="pal-metric-v">${esc((m.detectedSections || []).join(', ') || '—')}</span></div>
    <div class="pal-metric"><span class="pal-metric-k">Confidence</span><span class="pal-metric-v">${m.confidenceOverall ?? 0}%</span></div>
    <div class="pal-metric pal-metric--warn"><span class="pal-metric-k">Text loss</span><span class="pal-metric-v">${m.textLossPct ?? 0}%</span></div>
    <div class="pal-metric pal-metric--err"><span class="pal-metric-k">Classif. errors</span><span class="pal-metric-v">${m.classificationErrorCount ?? 0}</span></div>
    <div class="pal-metric"><span class="pal-metric-k">Dropped lines</span><span class="pal-metric-v">${m.droppedLineCount ?? 0}</span></div>
  </div>`;
}

function renderBlockTable(blocks, cols) {
  if (!blocks?.length) return '<p class="pal-empty">—</p>';
  const head = cols.map((c) => `<th>${esc(c.label)}</th>`).join('');
  const body = blocks
    .map((b) => {
      const cells = cols
        .map((c) => {
          const v = c.render(b);
          return `<td>${typeof v === 'string' && v.includes('<') ? v : esc(v)}</td>`;
        })
        .join('');
      return `<tr>${cells}</tr>`;
    })
    .join('');
  return `<table class="pal-table"><thead><tr>${head}</tr></thead><tbody>${body}</tbody></table>`;
}

export function renderPdfAccuracyLab(report) {
  if (!report) return '<p class="pal-empty">No report</p>';
  const m = report.metrics;

  const rawLinesHtml = (report.stages.rawLines || [])
    .map(
      (l) =>
        `<div class="pal-line" data-page="${l.page}"><span class="pal-line-meta">p${l.page} (${l.x},${l.y})</span> ${esc(l.text)}</div>`
    )
    .join('');

  const compareRows = (report.comparison || [])
    .map((r) => {
      const cls = `pal-cmp-row pal-cmp-row--${r.status}`;
      return `<div class="${cls}">
        <div class="pal-cmp-col"><span class="pal-cmp-tag">RAW</span>${esc(r.raw) || '<em class="pal-empty">—</em>'}</div>
        <div class="pal-cmp-col"><span class="pal-cmp-tag">OUT</span>${esc(r.out) || '<em class="pal-empty">—</em>'}</div>
        <span class="pal-cmp-status">${esc(r.status)}</span>
      </div>`;
    })
    .join('');

  const errorsHtml = (report.classificationErrors || [])
    .map(
      (e) =>
        `<li class="pal-err pal-err--${e.severity}"><strong>${esc(e.rule)}</strong> ${esc(e.from)}→${esc(e.to)} · ${esc(e.text)}${e.confidence != null ? ` (${e.confidence}%)` : ''}</li>`
    )
    .join('');

  const droppedHtml = (report.droppedLines || [])
    .map((l) => `<li class="pal-drop">${esc(l)}</li>`)
    .join('');

  return `
${renderMetricsBar(m)}
<div class="pal-pipeline">
  <section class="pal-stage">
    <header class="pal-stage-head"><h2>1 · ORIGINAL PDF</h2><span>${esc(report.fileName)} · ${report.pageCount} pg · ${esc(report.extractionMethod)}</span></header>
    <div class="pal-stage-body pal-stage-body--pdf"><div id="palPdfPreview" class="pal-pdf-preview"></div></div>
  </section>
  <div class="pal-arrow">↓</div>
  <section class="pal-stage">
    <header class="pal-stage-head"><h2>2 · RAW PDF TEXT</h2><span>${m.rawChars} chars · ${m.rawLines} lines · route ${esc(report.pdfRoute || '—')}</span></header>
    <div class="pal-stage-body"><pre class="pal-pre">${esc(report.stages.rawText)}</pre></div>
    <details class="pal-details"><summary>Line geometry (${report.stages.rawLines?.length || 0})</summary><div class="pal-lines">${rawLinesHtml || '<p class="pal-empty">No positioned lines</p>'}</div></details>
  </section>
  <div class="pal-arrow">↓</div>
  <section class="pal-stage">
    <header class="pal-stage-head"><h2>3 · LAYOUT BLOCKS</h2><span>${esc(m.layoutType)} · split ${m.columns?.splitX ?? '—'} · ${m.textBlocks} blocks</span></header>
    <div class="pal-stage-body">${renderBlockTable(report.stages.layoutBlocks, [
      { label: 'Col', render: (b) => b.column || '—' },
      { label: 'Hint', render: (b) => b.sectionHint || '—' },
      { label: 'Geom', render: (b) => `(${b.x},${b.y})` },
      { label: 'Text', render: (b) => `<pre class="pal-pre-inline">${esc((b.text || '').slice(0, 200))}</pre>` },
    ])}</div>
  </section>
  <div class="pal-arrow">↓</div>
  <section class="pal-stage">
    <header class="pal-stage-head"><h2>4 · CLASSIFIED BLOCKS</h2><span>render ${m.renderBlocks} · review ${m.reviewBlocks}</span></header>
    <div class="pal-stage-body">${renderBlockTable(report.stages.classifiedBlocks, [
      { label: 'Type', render: (b) => b.type },
      { label: 'Conf', render: (b) => `${b.confidence}%` },
      { label: 'Gate', render: (b) => (b.accepted ? 'render' : 'review') },
      { label: 'Dict', render: (b) => (b.dictionaryMatch ? `${b.dictionaryMatch.entity}:${b.dictionaryMatch.term}` : '—') },
      { label: 'Reason', render: (b) => b.classificationReason || '—' },
      { label: 'Text', render: (b) => `<pre class="pal-pre-inline">${esc((b.text || '').slice(0, 160))}</pre>` },
    ])}</div>
    ${errorsHtml ? `<div class="pal-errors"><h3>Classification issues</h3><ul>${errorsHtml}</ul></div>` : ''}
  </section>
  <div class="pal-arrow">↓</div>
  <section class="pal-stage">
    <header class="pal-stage-head"><h2>5 · STRUCTURED JSON</h2><span>loss ${m.textLossPct}% · retention ${m.retentionPct}%</span></header>
    <div class="pal-stage-body"><pre class="pal-pre pal-pre--json">${esc(JSON.stringify(report.stages.structuredResume, null, 2))}</pre></div>
  </section>
  <div class="pal-arrow">↓</div>
  <section class="pal-stage">
    <header class="pal-stage-head"><h2>6 · FINAL CV</h2><span>read-only preview · no export</span></header>
    <div class="pal-stage-body pal-stage-body--cv"><div id="palCvPreview" class="pal-cv-preview"></div></div>
  </section>
</div>
<section class="pal-compare">
  <header class="pal-stage-head"><h2>Side-by-side · where information disappears</h2><span>${report.droppedLines?.length || 0} dropped lines</span></header>
  <div class="pal-compare-grid">${compareRows || '<p class="pal-empty">Run analysis first</p>'}</div>
  ${droppedHtml ? `<div class="pal-dropped"><h3>Dropped lines (not in structured output)</h3><ul>${droppedHtml}</ul></div>` : ''}
</section>`;
}
