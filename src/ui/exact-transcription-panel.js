/**
 * Exact transcription UI — CSP-safe PDF preview + line-by-line dump.
 */

import {
  renderExactTranscriptionPdfPage,
  disposeExactTranscriptionPdfPreview,
} from './exact-transcription-pdf-preview.js';
import { isZeroWordBbox } from '../core/extraction/ocr-geometry.js';

const DEFAULT_UI = {
  showWords: true,
  showRaw: false,
  showWordOverlay: false,
};

function isImportEngineDebugUi() {
  try {
    const q = new URLSearchParams(globalThis.location?.search || '').get('debug');
    return q === 'true' || q === '1';
  } catch {
    return false;
  }
}

/**
 * @param {HTMLElement} el
 */
function getUiState(el) {
  if (!el._exactUi) el._exactUi = { ...DEFAULT_UI };
  return el._exactUi;
}

/**
 * @param {object} line
 * @param {object} ui
 */
function lineDisplayText(line, ui) {
  if (ui.showRaw) return line.raw_text || line.text || '';
  return line.text || line.raw_text || '';
}

/**
 * @param {object} page
 */
function pagePlainText(page, ui) {
  return (page?.raw_lines || []).map((l) => lineDisplayText(l, ui)).filter(Boolean).join('\n');
}

/**
 * @param {HTMLCanvasElement} canvas
 * @param {object[]} words
 * @param {number} previewScale
 */
function drawWordBoxOverlay(canvas, words, previewScale = 1) {
  if (!canvas || !words?.length) return;
  const ctx = canvas.getContext('2d');
  if (!ctx) return;
  const scale = previewScale > 0 ? previewScale : 1;
  for (const w of words) {
    const bb = w.bbox;
    if (!bb) continue;
    const bw = bb.w ?? bb.width ?? 0;
    const bh = bb.h ?? bb.height ?? 0;
    if (!bw || !bh) {
      ctx.strokeStyle = 'rgba(255, 0, 0, 0.85)';
    } else if (w.inferred) {
      ctx.strokeStyle = 'rgba(255, 165, 0, 0.75)';
    } else {
      ctx.strokeStyle = 'rgba(0, 180, 90, 0.85)';
    }
    ctx.lineWidth = 1;
    ctx.strokeRect(bb.x * scale, bb.y * scale, Math.max(1, bw * scale), Math.max(1, bh * scale));
  }
}

/**
 * @param {HTMLElement} el
 * @param {object} transcription
 * @param {File|Blob|null} sourceFile
 * @param {number} activePage
 */
async function paintPdfPreview(docCol, el, sourceFile, activePage, transcription, ui) {
  const status = await renderExactTranscriptionPdfPage(docCol, sourceFile, activePage);
  el._exactPreviewMeta = status;
  if (ui?.showWordOverlay && status.ok) {
    const canvas = docCol.querySelector('canvas.exactTranscriptionPdfCanvas');
    const page = transcription?.pages?.find((p) => p.page_number === activePage);
    const words = page?.raw_words?.length ? page.raw_words : (page?.raw_lines || []).flatMap((l) => l.words || []);
    drawWordBoxOverlay(canvas, words, status.scale || 1);
  }
}

/**
 * @param {HTMLElement} el
 * @param {object} transcription
 * @param {File|Blob|null} [sourceFile]
 * @param {object} [opts]
 */
export async function renderExactTranscriptionPanel(el, transcription, sourceFile = null, opts = {}) {
  if (!el || !transcription) return;
  if (!isImportEngineDebugUi()) {
    el.classList.add('hidden');
    el.innerHTML = '';
    return;
  }
  const pages = transcription.pages || [];
  const activePage = Number(opts.page ?? el.dataset.activePage) || pages[0]?.page_number || 1;
  const ui = getUiState(el);
  if (opts.showWords != null) ui.showWords = !!opts.showWords;
  if (opts.showRaw != null) ui.showRaw = !!opts.showRaw;
  if (opts.showWordOverlay != null) ui.showWordOverlay = !!opts.showWordOverlay;

  el.dataset.activePage = String(activePage);
  el.classList.remove('hidden');

  const weak = transcription.metrics?.weak_pages || [];
  const portfolio = transcription.metrics?.portfolio_like_pages || [];
  const ocr = transcription.diff_report?.ocr_confidence_summary;

  el.innerHTML = '';

  const head = document.createElement('header');
  head.className = 'exactTranscriptionHead';
  head.innerHTML = `
    <span class="kicker level3">Exact transcription</span>
    <h2>Transcription fidèle</h2>
    <p class="exactTranscriptionMeta" id="exactTranscriptionMeta"></p>
  `;
  el.appendChild(head);

  const meta = head.querySelector('#exactTranscriptionMeta');
  if (meta) {
    meta.textContent = [
      transcription.file_name,
      `${transcription.page_count || pages.length} page(s)`,
      `${transcription.line_count || 0} ligne(s)`,
      transcription.extraction_method || '—',
      weak.length ? `pages faibles: ${weak.join(', ')}` : null,
      portfolio.length ? `portfolio: ${portfolio.join(', ')}` : null,
    ]
      .filter(Boolean)
      .join(' · ');
  }

  const toolbar = document.createElement('div');
  toolbar.id = 'exactTranscriptionToggle';
  toolbar.className = 'exactTranscriptionToolbar';
  const geom = transcription.metrics?.geometry || {};
  toolbar.innerHTML = `
    <label class="exactTranscriptionToggle"><input type="checkbox" id="exactShowWords" ${ui.showWords ? 'checked' : ''} /> Mots / boxes</label>
    <label class="exactTranscriptionToggle"><input type="checkbox" id="exactShowWordOverlay" ${ui.showWordOverlay ? 'checked' : ''} /> Overlay boxes (page)</label>
    <label class="exactTranscriptionToggle"><input type="checkbox" id="exactShowRaw" ${ui.showRaw ? 'checked' : ''} /> Texte brut</label>
    <button type="button" class="btn small ghost" id="exactCopyPage">Copier page</button>
    <button type="button" class="btn small ghost" id="exactExportJson">Exporter JSON</button>
    <button type="button" class="btn small ghost" id="exactExportWords">Exporter mots OCR</button>
  `;
  el.appendChild(toolbar);

  toolbar.querySelector('#exactShowWords')?.addEventListener('change', (e) => {
    ui.showWords = e.target.checked;
    void renderExactTranscriptionPanel(el, transcription, sourceFile, { page: activePage });
  });
  toolbar.querySelector('#exactShowWordOverlay')?.addEventListener('change', (e) => {
    ui.showWordOverlay = e.target.checked;
    void renderExactTranscriptionPanel(el, transcription, sourceFile, { page: activePage });
  });
  toolbar.querySelector('#exactShowRaw')?.addEventListener('change', (e) => {
    ui.showRaw = e.target.checked;
    void renderExactTranscriptionPanel(el, transcription, sourceFile, { page: activePage });
  });
  toolbar.querySelector('#exactCopyPage')?.addEventListener('click', async () => {
    const page = pages.find((p) => p.page_number === activePage) || pages[0];
    const text = pagePlainText(page, ui);
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      /* ignore */
    }
  });
  toolbar.querySelector('#exactExportJson')?.addEventListener('click', () => {
    const blob = new Blob([JSON.stringify(transcription, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(transcription.file_name || 'transcription').replace(/[^\w.-]+/g, '_')}-exact.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  });
  toolbar.querySelector('#exactExportWords')?.addEventListener('click', () => {
    const page = pages.find((p) => p.page_number === activePage) || pages[0];
    const wordsByPage = transcription.artifacts?.ocr_words_by_page || {};
    const payload = {
      document_id: transcription.document_id,
      page_number: page?.page_number || activePage,
      raw_words: page?.raw_words || [],
      ocr_words_by_page: wordsByPage,
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${(transcription.file_name || 'transcription').replace(/[^\w.-]+/g, '_')}-p${activePage}-ocr-words.json`;
    a.click();
    setTimeout(() => URL.revokeObjectURL(a.href), 500);
  });

  const layout = document.createElement('div');
  layout.className = 'exactTranscriptionLayout';

  const docCol = document.createElement('div');
  docCol.className = 'exactTranscriptionDoc';
  docCol.innerHTML = '<p class="exactTranscriptionDocPlaceholder">Chargement aperçu…</p>';
  layout.appendChild(docCol);

  const textCol = document.createElement('div');
  textCol.className = 'exactTranscriptionText';

  const page = pages.find((p) => p.page_number === activePage) || pages[0];

  const summary = document.createElement('div');
  summary.className = 'exactTranscriptionSummary';
  const cs = page?.confidence_summary || {};
  const pageReal = (page?.raw_lines || []).filter((l) => l.real_word_boxes).length;
  const pageInferred = (page?.raw_lines || []).filter((l) => l.weak_reason === 'inferred_word_boxes_only').length;
  summary.innerHTML = `
    <div><strong>Page ${activePage}</strong> · method ${page?.extraction_method || '—'}</div>
    <div><strong>OCR confidence</strong>: lines ${cs.avg_line_confidence ?? ocr?.avg ?? cs.avg ?? '—'} · words ${cs.avg_word_confidence ?? '—'} · low lines ${cs.low_confidence_line_count ?? ocr?.low_confidence_lines ?? cs.low_count ?? 0}</div>
    <div><strong>Geometry</strong>: real-box lines ${pageReal} · inferred-only ${pageInferred} · pipeline zero-bbox bugs ${geom.zero_bbox_pipeline_bugs ?? 0} · stripped ${geom.zero_bbox_words_stripped ?? 0}</div>
    <div><strong>Coordinates</strong>: ${page?.coordinates_present ? 'yes' : 'no'} · preview: pdfjs-canvas · overlay ${ui.showWordOverlay ? 'on' : 'off'}</div>
    <div><strong>Parser</strong>: skipped (exact mode)</div>
  `;
  textCol.appendChild(summary);

  const nav = document.createElement('nav');
  nav.className = 'exactTranscriptionPageNav';
  nav.setAttribute('aria-label', 'Pages');
  for (const p of pages) {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'exactTranscriptionPageBtn';
    if (weak.includes(p.page_number)) btn.classList.add('exactTranscriptionPageBtn--weak');
    if (portfolio.includes(p.page_number)) btn.classList.add('exactTranscriptionPageBtn--portfolio');
    btn.textContent = `Page ${p.page_number}`;
    btn.dataset.page = String(p.page_number);
    if (p.page_number === activePage) btn.setAttribute('aria-current', 'page');
    btn.addEventListener('click', () => {
      void renderExactTranscriptionPanel(el, transcription, sourceFile, { page: p.page_number });
    });
    nav.appendChild(btn);
  }
  textCol.appendChild(nav);

  const linesHost = document.createElement('div');
  linesHost.className = 'exactTranscriptionLines';
  const lines = page?.raw_lines || [];

  if (!lines.length) {
    const empty = document.createElement('p');
    empty.className = 'exactTranscriptionDocPlaceholder';
    empty.textContent = 'Aucune ligne extraite pour cette page.';
    linesHost.appendChild(empty);
  } else {
    for (const line of lines) {
      const row = document.createElement('div');
      row.className = 'exactTranscriptionLine';
      if (line.confidence < 60 || line.weak_reason) row.classList.add('exactTranscriptionLine--low');

      const idx = document.createElement('span');
      idx.className = 'exactTranscriptionLineIndex';
      idx.textContent = `${line.page_number}:${line.line_index}`;

      const text = document.createElement('div');
      text.className = 'exactTranscriptionLineText';
      text.textContent = lineDisplayText(line, ui);

      if (line.bbox) {
        const coords = document.createElement('span');
        coords.className = 'exactTranscriptionCoords';
        const bw = line.bbox.w ?? line.bbox.width ?? 0;
        const bh = line.bbox.h ?? line.bbox.height ?? 0;
        coords.textContent = `x${line.bbox.x} y${line.bbox.y} w${bw} h${bh}`;
        text.appendChild(coords);
      }

      if (ui.showWords && line.words?.length) {
        const wordsEl = document.createElement('div');
        wordsEl.className = 'exactTranscriptionWords';
        for (const w of line.words) {
          const chip = document.createElement('span');
          chip.className = 'exactTranscriptionWord';
          if (w.inferred) chip.classList.add('exactTranscriptionWord--inferred');
          const bw = w.bbox?.w ?? w.bbox?.width;
          const bh = w.bbox?.h ?? w.bbox?.height;
          const isZero = w.bbox && isZeroWordBbox(w.bbox);
          if (isZero) chip.classList.add('exactTranscriptionWord--zero');
          const bbox = w.bbox ? ` [${w.bbox.x},${w.bbox.y} ${bw}x${bh}]` : ' [no bbox]';
          chip.textContent = `${w.text} (${w.confidence ?? '—'}%)${bbox}${w.inferred ? ' inferred' : ''}`;
          wordsEl.appendChild(chip);
        }
        text.appendChild(wordsEl);
      }

      const metaCol = document.createElement('div');
      metaCol.className = 'exactTranscriptionLineMeta';
      const weakLabel = line.weak_reason ? `<span class="exactWeakTag">${line.weak_reason}</span><br>` : '';
      const realTag = line.real_word_boxes ? '<span class="exactRealTag">real_word_boxes</span><br>' : '';
      metaCol.innerHTML = `${weakLabel}${realTag}${line.source || '—'}<br>${line.confidence ?? '—'}%`;

      row.appendChild(idx);
      row.appendChild(text);
      row.appendChild(metaCol);
      linesHost.appendChild(row);
    }
  }

  textCol.appendChild(linesHost);
  layout.appendChild(textCol);
  el.appendChild(layout);

  await paintPdfPreview(docCol, el, sourceFile, activePage, transcription, ui);
}

/**
 * @param {HTMLElement|null} el
 */
export function hideExactTranscriptionPanel(el) {
  if (!el) return;
  const docCol = el.querySelector('.exactTranscriptionDoc');
  if (docCol) disposeExactTranscriptionPdfPreview(docCol);
  el.classList.add('hidden');
  el.innerHTML = '';
  delete el.dataset.activePage;
  delete el._exactUi;
  delete el._exactPreviewMeta;
}
