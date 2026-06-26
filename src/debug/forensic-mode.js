/**
 * HIRELY OCR FORENSIC — ?debug=forensic
 * Exposes pipeline stages for corruption diagnosis (no product UI / templates / export).
 */

import { textStats, linesRemoved } from './stats.js';
import { buildOcrForensic, diffStageLines, resolveRawOcrText } from './ocr-forensic.js';
import {
  cleanExtraction,
  detectSections,
  getLastCleanLoss,
  getLastUncertainLines,
} from '../core/parsing/rich-parser.js';
import { cleanTextWithRejected } from '../core/parsing/line-cleaner.js';
import { measureCleanLoss, strictClean } from '../core/parsing/clean.js';
import { classifyLineWithConfidence } from '../core/parsing/section-sanity.js';
import { collectSectionsOrderAgnostic } from '../core/parsing/section-mapper.js';
import { enrichBlocksFromTop } from '../core/parsing/rich-parser.js';
import { formatCvAsStructuredText } from '../core/export/format-cv.js';
import { structuredToCvData } from '../core/parsing/structured-resume.js';
import { extractionSourceLabel, fileTypeLabel } from '../core/extraction/file-type-detect.js';
import {
  peekLastEnterpriseExtraction,
  peekOcrPreprocessPreviews,
} from '../core/extraction/extraction-session.js';
import {
  buildPdfRootCauseReport,
  logPdfRootCauseReport,
  renderPdfRootCauseSection,
} from './pdf-root-cause.js';

export const FORENSIC_STAGE_LABELS = {
  raw: '1. RAW EXTRACTION',
  cleaned: '2. CLEANED TEXT',
  classified: '3. CLASSIFIED LINES',
  json: '4. STRUCTURED RESUME JSON',
  rendered: '5. FINAL RENDERED CV',
};

const CORRUPTION_NEEDLES = [
  'Ce Frei Re',
  'Ce Frei',
  'Frei Re',
  "A>o N'$ak6",
  'RA coe PCL',
  'Freelance Illustrator',
];

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normalizeLineKey(line) {
  return String(line || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function wordTokens(text) {
  const m = String(text || '').toLowerCase().match(/[\p{L}\p{N}@][\p{L}\p{N}@'.-]*/gu);
  return m || [];
}

/** Word-level diff RAW vs CLEANED for diff viewer. */
export function diffWordsRawCleaned(rawText, cleanedText) {
  const raw = wordTokens(rawText);
  const clean = wordTokens(cleanedText);
  const rawSet = new Set(raw);
  const cleanSet = new Set(clean);
  const removed = raw.filter((w, i, arr) => rawSet.has(w) && !cleanSet.has(w) && arr.indexOf(w) === i);
  const added = clean.filter((w, i, arr) => cleanSet.has(w) && !rawSet.has(w) && arr.indexOf(w) === i);
  const changed = [];
  const rawLines = String(rawText || '').split('\n');
  const cleanLines = String(cleanedText || '').split('\n');
  const lineDiff = diffStageLines(rawText, cleanedText);
  for (const { before, after } of lineDiff.modified) {
    const bw = wordTokens(before);
    const aw = wordTokens(after);
    for (const w of bw) {
      if (!aw.includes(w)) changed.push({ word: w, from: before, to: after, type: 'removed-in-line' });
    }
    for (const w of aw) {
      if (!bw.includes(w)) changed.push({ word: w, from: before, to: after, type: 'added-in-line' });
    }
  }
  return { removed, added, changed, lineDiff };
}

function buildClassifiedLines(cleanedText) {
  const blocks = collectSectionsOrderAgnostic(cleanedText, enrichBlocksFromTop);
  const sectionByLine = new Map();
  for (const [key, lines] of Object.entries(blocks)) {
    if (!Array.isArray(lines)) continue;
    for (const l of lines) {
      const t = String(l || '').trim();
      if (t) sectionByLine.set(normalizeLineKey(t), key);
    }
  }

  const rows = [];
  for (const line of String(cleanedText || '').split('\n')) {
    const t = line.trim();
    if (!t) continue;
    const { bucket, confidence, signals } = classifyLineWithConfidence(t);
    rows.push({
      line: t,
      bucket,
      confidence,
      signals,
      section: sectionByLine.get(normalizeLineKey(t)) || '—',
    });
  }
  return { rows, blocks, text: rows.map((r) => `[${r.bucket}/${r.confidence}%] ${r.line}`).join('\n') };
}

function pinpointNeedles(stageTexts) {
  const hits = [];
  for (const [stageId, text] of Object.entries(stageTexts)) {
    const blob = String(text || '');
    for (const needle of CORRUPTION_NEEDLES) {
      if (blob.toLowerCase().includes(needle.toLowerCase())) {
        hits.push({ needle, stageId, label: FORENSIC_STAGE_LABELS[stageId] || stageId });
      }
    }
  }
  const firstCorrupt = CORRUPTION_NEEDLES.map((needle) => {
    for (const id of ['raw', 'cleaned', 'classified', 'json', 'rendered']) {
      if (String(stageTexts[id] || '').toLowerCase().includes(needle.toLowerCase())) {
        return { needle, firstSeenAt: id, label: FORENSIC_STAGE_LABELS[id] };
      }
    }
    return null;
  }).filter(Boolean);
  return { hits, firstCorrupt };
}

/**
 * Full forensic report for ?debug=forensic
 */
export function buildForensicReport(pipeInput, pipe, opts = {}) {
  const base = buildOcrForensic(pipeInput, pipe, opts);
  const raw = resolveRawOcrText(pipeInput, opts.forensicMeta);
  const cleaned = String(pipe?.cleanedText || cleanExtraction(raw));
  const cleanLoss = pipe?.cleanLoss || getLastCleanLoss() || measureCleanLoss(raw, cleaned);
  const uncertainLines = pipe?.uncertainLines || getLastUncertainLines() || [];
  const strictPreview = strictClean(raw);
  const strictLoss = measureCleanLoss(raw, strictPreview);
  const { rejectedLines: preReject } = cleanTextWithRejected(raw, { mode: 'safe' });
  const rejected = [
    ...new Set([...(pipe?.rejectedLines || []), ...preReject]),
  ].filter(Boolean);

  const classified = buildClassifiedLines(cleaned);
  const structured = pipe?.structuredResume || {};
  const extractionLines = structured?.extractionLines || pipe?.enterprise?.lines || [];
  const enterpriseMeta = {
    ...(peekLastEnterpriseExtraction()?.metadata || {}),
    ...(structured?.metadata || {}),
    ...(pipe?.enterprise?.metadata || {}),
  };
  const extractionReview = structured?.extractionReview || pipe?.validatedCVData?._extractionReview || [];
  const cvData = pipe?.validatedCVData || structuredToCvData(structured);
  const jsonText = JSON.stringify(structured?.identity ? structured : cvData, null, 2);
  const rendered =
    String(opts.templatePlainText || '').trim() || formatCvAsStructuredText(cvData);

  const rawCleanDiff = diffWordsRawCleaned(raw, cleaned);
  const rawToClean = diffStageLines(raw, cleaned);

  const stageTexts = {
    raw,
    cleaned,
    classified: classified.text,
    json: jsonText,
    rendered,
  };
  const needles = pinpointNeedles(stageTexts);

  const stages = [
    {
      id: 'raw',
      label: FORENSIC_STAGE_LABELS.raw,
      text: raw,
      ...textStats(raw),
      nonEmptyLines: String(raw).split('\n').filter((l) => l.trim()).length,
      rejectedLines: [],
      removedLines: 0,
      removedContent: [],
      modifiedContent: [],
    },
    {
      id: 'cleaned',
      label: FORENSIC_STAGE_LABELS.cleaned,
      text: cleaned,
      ...textStats(cleaned),
      nonEmptyLines: String(cleaned).split('\n').filter((l) => l.trim()).length,
      rejectedLines: rejected,
      removedLines: rawToClean.removed.length,
      removedContent: rawToClean.removed,
      modifiedContent: rawToClean.modified,
      addedContent: rawToClean.added,
    },
    {
      id: 'classified',
      label: FORENSIC_STAGE_LABELS.classified,
      text: classified.text,
      classifiedRows: classified.rows,
      sections: classified.blocks,
      ...textStats(classified.text),
      nonEmptyLines: classified.rows.length,
      rejectedLines: [],
      removedLines: 0,
    },
    {
      id: 'json',
      label: FORENSIC_STAGE_LABELS.json,
      text: jsonText,
      ...textStats(jsonText),
      nonEmptyLines: jsonText.split('\n').length,
    },
    {
      id: 'rendered',
      label: FORENSIC_STAGE_LABELS.rendered,
      text: rendered,
      htmlChars: opts.templateHtmlChars ?? 0,
      ...textStats(rendered),
      nonEmptyLines: String(rendered).split('\n').filter((l) => l.trim()).length,
    },
  ];

  const pdfRootCause = buildPdfRootCauseReport(pipe, {
    rawText: raw,
    cvData,
    forensicMeta: opts.forensicMeta,
  });

  return {
    ...base,
    stages,
    stageTexts,
    rawCleanDiff,
    classifiedRows: classified.rows,
    rejectedLines: rejected,
    needles,
    pdfRootCause,
    cleanLoss,
    strictCleanPreview: strictPreview,
    strictCleanLoss: strictLoss,
    uncertainLines,
    summary: {
      ...base.summary,
      extractionMethod: enterpriseMeta.extractionMethod || pipe?.extractionMethod || opts.extractionMethod,
      extractionSource:
        enterpriseMeta.extractionSource ||
        extractionSourceLabel(enterpriseMeta.extractionMethod || pipe?.extractionMethod),
      fileType: enterpriseMeta.fileType,
      fileTypeLabel: enterpriseMeta.fileTypeLabel || fileTypeLabel(enterpriseMeta.fileType),
      textLayerFound: enterpriseMeta.textLayerFound,
      extractionConfidence: enterpriseMeta.confidence,
      extractionPages: enterpriseMeta.pages,
      extractionLineCount: extractionLines.length,
      extractionReviewCount: extractionReview.length,
      nativeLineCount: extractionLines.filter((l) => l.source === 'native').length,
      ocrLineCount: extractionLines.filter((l) => l.source === 'ocr').length,
      lowConfidenceLines: extractionLines.filter((l) => (l.confidence ?? 100) < 60).length,
      corruptionHits: needles.hits,
      firstCorruption: needles.firstCorrupt[0] || null,
      cleanLossPct: cleanLoss?.lossPct ?? 0,
      cleanLossWarn: cleanLoss?.warn ?? false,
      strictCleanLossPct: strictLoss?.lossPct ?? 0,
    },
    extractionLines,
    extractionReview,
    enterpriseMeta,
  };
}

function renderWordDiff(diff) {
  const removed = (diff?.removed || []).slice(0, 80);
  const added = (diff?.added || []).slice(0, 80);
  const changed = (diff?.changed || []).slice(0, 40);
  return `
<section class="forensic-diff">
  <h3>RAW vs CLEANED — word diff</h3>
  <div class="forensic-diff-cols">
    <div class="forensic-diff-col">
      <h4>Removed words <span class="forensic-count">${removed.length}</span></h4>
      <p class="forensic-words forensic-words--removed">${removed.length ? removed.map((w) => `<span>${escapeHtml(w)}</span>`).join(' ') : '—'}</p>
    </div>
    <div class="forensic-diff-col">
      <h4>Added words <span class="forensic-count">${added.length}</span></h4>
      <p class="forensic-words forensic-words--added">${added.length ? added.map((w) => `<span>${escapeHtml(w)}</span>`).join(' ') : '—'}</p>
    </div>
  </div>
  ${
    changed.length ?
      `<details class="forensic-details" open><summary>Changed within lines (${changed.length})</summary><ul class="forensic-list">${changed
        .map(
          (c) =>
            `<li><span class="forensic-tag forensic-tag--changed">${escapeHtml(c.word)}</span> <span class="forensic-muted">in line</span> ${escapeHtml(c.from)} → ${escapeHtml(c.to)}</li>`
        )
        .join('')}</ul></details>`
    : ''
  }
  ${
    diff?.lineDiff?.removed?.length ?
      `<details class="forensic-details" open><summary>Removed lines (${diff.lineDiff.removed.length})</summary><ul class="forensic-list forensic-list--removed">${diff.lineDiff.removed
        .map((l) => `<li>${escapeHtml(l)}</li>`)
        .join('')}</ul></details>`
    : ''
  }
</section>`;
}

function renderClassifiedTable(rows) {
  if (!rows?.length) return '<p class="forensic-muted">No classified lines.</p>';
  const highlight = new Set(['experience', 'skills', 'projects', 'education', 'tools', 'clients']);
  return `<table class="forensic-table"><thead><tr><th>Line</th><th>Classifier</th><th>Conf.</th><th>Section</th></tr></thead><tbody>${rows
    .map((r) => {
      const cls = highlight.has(r.bucket) ? `forensic-row forensic-row--${r.bucket}` : 'forensic-row';
      return `<tr class="${cls}"><td>${escapeHtml(r.line)}</td><td><code>${escapeHtml(r.bucket)}</code></td><td>${r.confidence}%</td><td>${escapeHtml(r.section)}</td></tr>`;
    })
    .join('')}</tbody></table>`;
}

function renderStage(stage, report) {
  const stats = `<div class="forensic-metrics">
    <span>${stage.chars} chars</span>
    <span>${stage.nonEmptyLines ?? stage.lines} lines</span>
    ${stage.removedLines != null ? `<span>${stage.removedLines} removed lines</span>` : ''}
    ${stage.rejectedLines?.length ? `<span>${stage.rejectedLines.length} rejected</span>` : ''}
    ${stage.modifiedContent?.length ? `<span>${stage.modifiedContent.length} modified lines</span>` : ''}
    ${stage.htmlChars ? `<span>${stage.htmlChars} HTML chars</span>` : ''}
  </div>`;

  let body = '';
  if (stage.id === 'classified') {
    body = renderClassifiedTable(stage.classifiedRows || report.classifiedRows);
  } else {
    body = `<pre class="forensic-pre">${escapeHtml(stage.text || '')}</pre>`;
  }

  const lists = [];
  if (stage.removedContent?.length) {
    lists.push(
      `<details class="forensic-details" open><summary>Removed (${stage.removedContent.length})</summary><ul class="forensic-list forensic-list--removed">${stage.removedContent
        .map((l) => `<li>${escapeHtml(l)}</li>`)
        .join('')}</ul></details>`
    );
  }
  if (stage.modifiedContent?.length) {
    lists.push(
      `<details class="forensic-details" open><summary>Modified lines (${stage.modifiedContent.length})</summary><ul class="forensic-list forensic-list--modified">${stage.modifiedContent
        .map(
          ({ before, after }) =>
            `<li><span class="forensic-from">${escapeHtml(before)}</span> → <span class="forensic-to">${escapeHtml(after)}</span></li>`
        )
        .join('')}</ul></details>`
    );
  }
  if (stage.rejectedLines?.length) {
    lists.push(
      `<details class="forensic-details" open><summary>Rejected lines (${stage.rejectedLines.length})</summary><ul class="forensic-list forensic-list--rejected">${stage.rejectedLines
        .map((l) => `<li>${escapeHtml(l)}</li>`)
        .join('')}</ul></details>`
    );
  }

  return `<article class="forensic-stage" data-stage="${escapeHtml(stage.id)}">
  <header class="forensic-stage-head"><h2>${escapeHtml(stage.label)}</h2>${stats}</header>
  <div class="forensic-stage-body">${body}</div>
  ${lists.join('')}
</article>`;
}

function renderExtractionLinesTable(lines, review) {
  const sample = (lines || []).slice(0, 60);
  if (!sample.length) return '';
  const rows = sample
    .map((l) => {
      const low = (l.confidence ?? 100) < 60;
      const cls = low ? 'forensic-row forensic-row--rejected' : 'forensic-row';
      return `<tr class="${cls}"><td>p${l.page ?? '—'}</td><td>${l.line ?? '—'}</td><td>${escapeHtml(l.text)}</td><td>${l.confidence ?? '—'}%</td><td><code>${escapeHtml(l.source || '—')}</code></td><td>${l.x ?? '—'},${l.y ?? '—'}</td></tr>`;
    })
    .join('');
  const reviewHtml =
    (review || []).length ?
      `<details class="forensic-details" open><summary>Needs review (${review.length}) — confidence &lt; 60</summary><ul class="forensic-list forensic-list--rejected">${review
        .slice(0, 40)
        .map((l) => `<li>${escapeHtml(typeof l === 'string' ? l : l.text || JSON.stringify(l))}</li>`)
        .join('')}</ul></details>`
    : '';
  return `<section class="forensic-diff">
  <h3>ENTERPRISE EXTRACTION LINES</h3>
  <p class="forensic-muted">Per-line confidence, source (native/ocr), and layout positions — low confidence excluded from auto CV.</p>
  <table class="forensic-table"><thead><tr><th>Page</th><th>Line</th><th>Text</th><th>Conf.</th><th>Source</th><th>x,y</th></tr></thead><tbody>${rows}</tbody></table>
  ${lines.length > 60 ? `<p class="forensic-muted">Showing 60 / ${lines.length} lines</p>` : ''}
  ${reviewHtml}
</section>`;
}

/** @param {ReturnType<typeof buildForensicReport>} report */
export function renderForensicPanel(report) {
  const r = report || { stages: [] };
  const sum = r.summary || {};
  const pin = (sum.corruptionHits || [])
    .map((h) => `<span class="forensic-pin">${escapeHtml(h.needle)} @ ${escapeHtml(h.label)}</span>`)
    .join('');

  const verdict =
    sum.firstCorruption ?
      `<p class="forensic-verdict">First corruption match <strong>${escapeHtml(sum.firstCorruption.needle)}</strong> at <strong>${escapeHtml(sum.firstCorruption.label)}</strong></p>`
    : '';

  const stagesHtml = (r.stages || [])
    .map((s, i) => {
      const arrow = i < r.stages.length - 1 ? `<div class="forensic-arrow" aria-hidden="true">↓</div>` : '';
      return renderStage(s, r) + arrow;
    })
    .join('');

  return `<div class="forensic-root">
  <header class="forensic-header">
    <h1>HIRELY PDF ROOT CAUSE</h1>
    <p class="forensic-sub">RAW → BLOCKS → CLASSIFIED → FINAL JSON · experience loss table with rule + confidence</p>
    <div class="forensic-header-meta">
      ${sum.extractionSource ? `<span>source: <strong>${escapeHtml(sum.extractionSource)}</strong></span>` : ''}
      ${sum.fileTypeLabel ? `<span>file: <strong>${escapeHtml(sum.fileTypeLabel)}</strong></span>` : ''}
      ${sum.textLayerFound != null ? `<span>text layer: <strong>${sum.textLayerFound ? 'yes' : 'no'}</strong></span>` : ''}
      ${sum.extractionConfidence != null ? `<span>confidence: <strong>${sum.extractionConfidence}%</strong></span>` : ''}
      ${sum.extractionPages != null ? `<span>pages: <strong>${sum.extractionPages}</strong></span>` : ''}
      ${sum.extractionMethod ? `<span>method: <strong>${escapeHtml(sum.extractionMethod)}</strong></span>` : ''}
      ${sum.extractionLineCount != null ? `<span>${sum.extractionLineCount} lines</span>` : ''}
      ${sum.nativeLineCount != null ? `<span>${sum.nativeLineCount} native</span>` : ''}
      ${sum.ocrLineCount != null ? `<span>${sum.ocrLineCount} ocr</span>` : ''}
      ${sum.lowConfidenceLines ? `<span class="forensic-warn">${sum.lowConfidenceLines} low conf.</span>` : ''}
      ${sum.extractionReviewCount ? `<span class="forensic-warn">${sum.extractionReviewCount} needs review</span>` : ''}
      ${sum.timingMs != null ? `<span>${sum.timingMs} ms</span>` : ''}
      ${sum.corruptionVerdict ? `<span class="forensic-warn">${escapeHtml(sum.corruptionVerdict)}</span>` : ''}
      ${sum.cleanLossWarn ? `<span class="forensic-warn">Safe clean −${sum.cleanLossPct}% chars (&gt;20%)</span>` : sum.cleanLossPct != null ? `<span>Safe clean −${sum.cleanLossPct}%</span>` : ''}
      ${sum.strictCleanLossPct != null ? `<span>Strict preview −${sum.strictCleanLossPct}%</span>` : ''}
    </div>
    ${verdict}
    ${
      (r.uncertainLines || []).length ?
        `<details class="forensic-details" open><summary>Uncertain lines kept (${r.uncertainLines.length})</summary><ul class="forensic-list">${r.uncertainLines
          .map((l) => `<li>${escapeHtml(l)}</li>`)
          .join('')}</ul></details>`
      : ''
    }
    ${pin ? `<div class="forensic-pins">${pin}</div>` : ''}
  </header>
  ${renderPdfRootCauseSection(r.pdfRootCause)}
  ${renderWordDiff(r.rawCleanDiff)}
  ${renderOcrPreprocessPreviews(peekOcrPreprocessPreviews())}
  ${renderExtractionLinesTable(r.extractionLines, r.extractionReview)}
  <div class="forensic-pipeline">${stagesHtml}</div>
</div>`;
}

export { buildPdfRootCauseReport, logPdfRootCauseReport, renderPdfRootCauseSection };

function renderOcrPreprocessPreviews(previews) {
  if (!previews?.length) return '';
  return `<section class="forensic-diff"><h3>OCR preprocess — before / after</h3>${previews
    .map((p) => {
      const steps = (p.meta?.steps || []).join(', ') || '—';
      return `<div class="forensic-diff-cols" style="margin-bottom:12px">
        <p class="forensic-muted">Page ${p.page} · ${escapeHtml(steps)}</p>
        <div class="forensic-diff-cols">
          <figure><img src="${p.before}" alt="before" style="max-width:100%;background:#fff;border-radius:6px"/><figcaption>Before</figcaption></figure>
          <figure><img src="${p.after}" alt="after" style="max-width:100%;background:#fff;border-radius:6px"/><figcaption>After</figcaption></figure>
        </div>
      </div>`;
    })
    .join('')}</section>`;
}

export function logForensicReport(report) {
  if (!report) return;
  if (report.pdfRootCause) logPdfRootCauseReport(report.pdfRootCause);
  console.group('HIRELY OCR FORENSIC (?debug=forensic)');
  for (const s of report.stages || []) {
    console.log(
      s.label,
      `chars=${s.chars}`,
      `lines=${s.nonEmptyLines}`,
      `removed=${s.removedLines ?? 0}`,
      `modified=${s.modifiedContent?.length ?? 0}`,
      `rejected=${s.rejectedLines?.length ?? 0}`
    );
  }
  if (report.summary?.firstCorruption) {
    console.warn('First corruption:', report.summary.firstCorruption);
  }
  console.groupEnd();
}
