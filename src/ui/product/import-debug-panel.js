/**
 * Developer-only import debug panel (?debug=true).
 * Metrics + pipeline step visibility — never shown to production users.
 */
(function (global) {
  const DISPLAY_STEPS = Object.freeze([
    'IMPORT_STARTED',
    'TEXT_EXTRACTED',
    'PARSER_DONE',
    'FINAL_RESUME_READY',
    'REVIEW_SCREEN_VISIBLE',
  ]);

  const STEP_ALIAS = Object.freeze({
    EXTRACTION_DONE: 'TEXT_EXTRACTED',
  });

  const snapshot = {
    steps: {},
    updatedAt: null,
  };

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function normalizeStep(step) {
    const key = String(step || '').split(/\s/)[0];
    return STEP_ALIAS[key] || key;
  }

  function recordStep(step) {
    const key = normalizeStep(step);
    if (!DISPLAY_STEPS.includes(key)) return;
    snapshot.steps[key] = { at: Date.now(), done: true };
    snapshot.updatedAt = Date.now();
  }

  function reset() {
    snapshot.steps = {};
    snapshot.updatedAt = Date.now();
  }

  function resolvePdfImported(ctx) {
    const file = ctx?.file;
    if (!file) return 'no';
    const name = String(file.name || '').toLowerCase();
    const type = String(file.type || '').toLowerCase();
    if (name.endsWith('.pdf') || type.includes('pdf')) return 'yes';
    return name || type ? 'no' : '—';
  }

  function resolveOcrUsed(ctx) {
    const dbg = ctx?.extractionDebug;
    if (dbg?.ocrAttempted === true) return 'yes';
    if (dbg?.ocrAttempted === false && dbg?.ocrAvailable === false) return 'disabled';
    const method = String(ctx?.extractionMethod || '').toLowerCase();
    if (/ocr|pdf-ocr/.test(method)) return 'yes';
    if (method === 'mixed') return 'mixed';
    if (/native_pdf|pdf-text|pdf_text/.test(method)) return 'no';
    if (ctx?.useOcr === true) return 'yes';
    if (ctx?.useOcr === false) return 'no';
    return method ? 'no' : '—';
  }

  function resolveParserUsed(ctx) {
    const p =
      ctx?.parserUsed ||
      ctx?.debugReport?.parser ||
      ctx?.debugReport?.parserEngine ||
      ctx?.lastPipeline?.parser ||
      (ctx?.lastPipeline?.productionPipeline ? 'production-pipeline' : null) ||
      (ctx?.structuredResume ? 'hirely-import' : null);
    return p || '—';
  }

  function stepRow(id, steps) {
    const done = !!steps[id];
    const cls = done ? 'importDebugStep importDebugStep--done' : 'importDebugStep';
    const mark = done ? '✓' : '○';
    return `<li class="${cls}" data-step="${esc(id)}"><span class="importDebugStep__mark" aria-hidden="true">${mark}</span><code>${esc(id)}</code></li>`;
  }

  function metricRow(label, value) {
    return `<div class="importDebugMetric"><span class="importDebugMetric__label">${esc(label)}</span><span class="importDebugMetric__value">${esc(value)}</span></div>`;
  }

  function formatPageLengths(pages) {
    if (!Array.isArray(pages) || !pages.length) return '—';
    return pages
      .map((p) => `p${p.page}:${p.pdfJsTextLength ?? p.charCount ?? 0}`)
      .join(' ');
  }

  function showExtractedText(ctx) {
    const dbg = ctx?.extractionDebug;
    const text =
      String(ctx?.extractedText || dbg?.extractedTextPreview || '').trim() ||
      '(aucun texte extrait)';
    const lines = [
      `file: ${dbg?.fileName || ctx?.file?.name || '—'}`,
      `rawText length: ${dbg?.totalRawTextLength ?? ctx?.textLength ?? 0}`,
      `pdf.js total: ${dbg?.pdfJsTotalLength ?? '—'}`,
      `paste reason: ${dbg?.pasteReason || '—'}`,
      '',
      '--- extracted text ---',
      text,
    ].join('\n');
    if (global.console?.log) {
      global.console.group('[Hirely] Show extracted text');
      global.console.log(lines);
      global.console.groupEnd();
    }
    try {
      global.alert(lines.slice(0, 12000));
    } catch {
      /* ignore */
    }
  }

  function render(ctx) {
    const host = global.document.getElementById('importDebugPanel');
    if (!host) return;
    if (!ctx?.debugMode) {
      host.classList.add('hidden');
      host.innerHTML = '';
      return;
    }

    const steps = { ...snapshot.steps };
    const pdf = resolvePdfImported(ctx);
    const textLen = ctx.textLength ?? ctx.rawTextLength ?? 0;
    const ocr = resolveOcrUsed(ctx);
    const parser = resolveParserUsed(ctx);
    const exp = ctx.experiences ?? 0;
    const edu = ctx.education ?? 0;
    const skills = ctx.skills ?? 0;
    const review = ctx.reviewItems ?? 0;
    const dbg = ctx.extractionDebug || null;

    host.classList.remove('hidden');
    host.innerHTML = `
      <header class="importDebugPanel__head">
        <h3 class="importDebugPanel__title">Import debug</h3>
        <span class="importDebugPanel__badge">dev</span>
      </header>
      <div class="importDebugPanel__metrics">
        ${metricRow('PDF imported', pdf)}
        ${metricRow('Text length', textLen)}
        ${metricRow('OCR used', ocr)}
        ${metricRow('Parser used', parser)}
        ${metricRow('Experiences found', exp)}
        ${metricRow('Education found', edu)}
        ${metricRow('Skills found', skills)}
        ${metricRow('Review items count', review)}
        ${dbg ? metricRow('File name', dbg.fileName || '—') : ''}
        ${dbg ? metricRow('File size', dbg.fileSize ?? '—') : ''}
        ${dbg ? metricRow('File type', dbg.fileType || '—') : ''}
        ${dbg ? metricRow('PDF pages', dbg.pdfPageCount ?? '—') : ''}
        ${dbg ? metricRow('pdf.js / page', formatPageLengths(dbg.pdfJsTextPerPage)) : ''}
        ${dbg ? metricRow('pdf.js total', dbg.pdfJsTotalLength ?? '—') : ''}
        ${dbg ? metricRow('OCR available', dbg.ocrAvailable ? 'yes' : 'no') : ''}
        ${dbg ? metricRow('OCR result len', dbg.ocrResultLength ?? 0) : ''}
        ${dbg ? metricRow('NEEDS_PASTE reason', dbg.pasteReason || '—') : ''}
      </div>
      <div class="importDebugPanel__actions">
        <button type="button" class="btn small importDebugPanel__showText" data-action="show-extracted-text">Show extracted text</button>
      </div>
      <ol class="importDebugPanel__steps" aria-label="Import pipeline steps">
        ${DISPLAY_STEPS.map((id) => stepRow(id, steps)).join('')}
      </ol>`;

    const btn = host.querySelector('[data-action="show-extracted-text"]');
    if (btn) {
      btn.onclick = () => showExtractedText(ctx);
    }
  }

  global.HirelyImportDebugPanel = {
    DISPLAY_STEPS,
    STEP_ALIAS,
    normalizeStep,
    recordStep,
    reset,
    render,
    showExtractedText,
    _snapshot: snapshot,
  };
})(typeof window !== 'undefined' ? window : globalThis);
