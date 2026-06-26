/**
 * Document Understanding debug — ?debug=blocks or HIRELY_DOC_DEBUG=1
 * RAW BLOCKS · CLASSIFIED BLOCKS · STRUCTURED JSON
 */

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function blockRow(b, extra = '') {
  const bbox = b.bbox || {};
  const x = b.x ?? bbox.x ?? 0;
  const y = b.y ?? bbox.y ?? 0;
  const w = b.width ?? bbox.width ?? 0;
  const h = b.height ?? bbox.height ?? 0;
  const dict = b.dictionaryMatch || b.entityMatch;
  const dictStr = dict
    ? `${dict.entity || dict.entityType || '?'}:${dict.term || dict.entityId || ''}`
    : '—';
  return `<tr>
    <td>${escapeHtml(b.id || '')}</td>
    <td>${escapeHtml(b.type || b.bucket || 'unknown')}</td>
    <td>${b.confidence ?? '—'}%</td>
    <td>${escapeHtml(b.classificationReason || (b.signals || []).slice(0, 3).join(', '))}</td>
    <td>${escapeHtml(dictStr)}</td>
    <td>p${b.page ?? 1} (${Math.round(x)},${Math.round(y)}) ${Math.round(w)}×${Math.round(h)}</td>
    <td><pre class="du-pre">${escapeHtml((b.text || '').slice(0, 200))}</pre></td>
    ${extra}
  </tr>`;
}

/**
 * @param {object} p0 — runP0Pipeline result
 */
export function buildDocumentUnderstandingDebug(p0 = {}) {
  const rawBlocks = (p0.extractedBlocks || p0.blocks?.blocks || []).map((b, i) => ({
    id: b.id || `raw-${i}`,
    page: b.page ?? 1,
    x: b.bbox?.x ?? b.x ?? 0,
    y: b.bbox?.y ?? b.y ?? 0,
    width: b.bbox?.width ?? b.width ?? 0,
    height: b.bbox?.height ?? b.height ?? 0,
    text: b.text || '',
    confidence: b.confidence,
    column: b.column,
    sectionHint: b.sectionHint,
    readingOrder: b.readingOrder ?? i,
  }));

  const classifiedBlocks = (p0.classifiedBlocks || []).map((b) => ({
    id: b.id,
    page: b.page,
    x: b.bbox?.x ?? b.x,
    y: b.bbox?.y ?? b.y,
    width: b.bbox?.width ?? b.width,
    height: b.bbox?.height ?? b.height,
    text: b.text,
    type: b.type,
    confidence: b.confidence,
    accepted: b.accepted,
    needsReview: b.needsReview,
    classificationReason: b.classificationReason,
    dictionaryMatch: b.dictionaryMatch || b.entityMatch,
    validationViolations: b.validationViolations || [],
    signals: b.signals,
  }));

  return {
    pipelineVersion: p0.pipelineVersion || 'p0-layout',
    layoutType: p0.layout?.layoutType,
    columns: {
      splitX: p0.columns?.splitX,
      leftCount: p0.columns?.leftCount,
      rightCount: p0.columns?.rightCount,
      multiColumn: p0.columns?.multiColumn,
    },
    reading: {
      blockCount: p0.reading?.blockCount,
      usedColumnReconstruction: p0.reading?.usedColumnReconstruction,
      usedRawPdfOrder: p0.reading?.usedRawPdfOrder,
    },
    confidence: p0.confidence,
    rawBlocks,
    classifiedBlocks,
    renderBlocks: p0.renderBlocks || [],
    reviewBlocks: p0.reviewBlocks || [],
    structuredJson: p0.structuredResume || null,
    neverRawParseCv: p0.neverRawParseCv === true,
  };
}

/**
 * @param {object} debug — buildDocumentUnderstandingDebug output
 */
export function renderDocumentUnderstandingPanel(debug) {
  const rawRows = (debug.rawBlocks || []).map((b) => blockRow(b)).join('');
  const classRows = (debug.classifiedBlocks || [])
    .map((b) =>
      blockRow(b, `<td>${b.needsReview ? 'review' : 'render'}</td>`)
    )
    .join('');

  const structured = debug.structuredJson
    ? `<pre class="du-json">${escapeHtml(JSON.stringify(debug.structuredJson, null, 2).slice(0, 12000))}</pre>`
    : '<span class="du-empty">—</span>';

  return `<div class="hirely-doc-understanding" id="hirely-doc-understanding">
<style>
.hirely-doc-understanding{font:12px/1.4 system-ui,sans-serif;max-width:100%;overflow:auto}
.hirely-doc-understanding h3{margin:12px 0 6px;font-size:13px}
.du-pre,.du-json{margin:0;white-space:pre-wrap;word-break:break-word;font-size:11px;max-height:120px;overflow:auto}
.hirely-doc-understanding table{border-collapse:collapse;width:100%;font-size:11px}
.hirely-doc-understanding th,.hirely-doc-understanding td{border:1px solid #ddd;padding:4px 6px;vertical-align:top}
.hirely-doc-understanding th{background:#f4f4f4;text-align:left}
.du-meta{color:#555;margin-bottom:8px}
</style>
<div class="du-meta">
  <strong>Document Understanding</strong> · ${escapeHtml(debug.pipelineVersion)} · layout: ${escapeHtml(debug.layoutType || '—')}
  · render ${debug.confidence?.renderCount ?? 0} / review ${debug.confidence?.reviewCount ?? 0}
  · threshold ${debug.confidence?.threshold ?? 70}%
</div>
<h3>RAW BLOCKS (${(debug.rawBlocks || []).length})</h3>
<table><thead><tr><th>id</th><th>type</th><th>conf</th><th>reason</th><th>dict</th><th>geom</th><th>text</th></tr></thead><tbody>${rawRows || '<tr><td colspan="7">—</td></tr>'}</tbody></table>
<h3>CLASSIFIED BLOCKS (${(debug.classifiedBlocks || []).length})</h3>
<table><thead><tr><th>id</th><th>type</th><th>conf</th><th>reason</th><th>dict</th><th>geom</th><th>text</th><th>gate</th></tr></thead><tbody>${classRows || '<tr><td colspan="8">—</td></tr>'}</tbody></table>
<h3>STRUCTURED JSON</h3>
${structured}
</div>`;
}

export function attachDocumentUnderstandingDebug(target, p0Result) {
  const debug = buildDocumentUnderstandingDebug(p0Result);
  if (target && typeof target === 'object') {
    target.documentUnderstanding = debug;
    target.documentUnderstandingHtml = renderDocumentUnderstandingPanel(debug);
  }
  if (typeof globalThis !== 'undefined') {
    globalThis.HIRELY_DOC_DEBUG_SNAPSHOT = debug;
  }
  return debug;
}

export function isDocumentUnderstandingDebugEnabled() {
  if (typeof globalThis === 'undefined') return false;
  if (globalThis.HIRELY_DOC_DEBUG === true || globalThis.HIRELY_DOC_DEBUG === '1') return true;
  if (typeof location !== 'undefined') {
    const q = new URLSearchParams(location.search);
    return q.get('debug') === 'blocks' || q.get('debug') === 'understanding';
  }
  return false;
}
