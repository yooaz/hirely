/**
 * OCR FORENSIC MODE — trace text corruption through extraction → parse → render.
 * Does not modify templates, product UI, or export.
 */

import { textStats, linesRemoved, lossRatio } from './stats.js';
import { cleanExtraction, detectSections } from '../core/parsing/rich-parser.js';
import { cleanTextWithRejected } from '../core/parsing/line-cleaner.js';
import { postProcessOcrText, looksLikeOcrText } from '../core/parsing/ocr-postprocess.js';
import { safeClean, strictClean } from '../core/parsing/clean.js';
import { stripOcrGarbage } from '../core/parsing/rich-parser.js';
import { peekLastOcrForensic } from '../core/extraction/extraction-session.js';
import { formatCvAsStructuredText } from '../core/export/format-cv.js';
import { formatSectionsAsText, diffLineSets } from './extraction-trace.js';
import { debugStructuredResumeJson } from '../core/pipeline/pipeline-contract.js';

export const FORENSIC_STAGE_IDS = ['rawOcr', 'cleaned', 'sections', 'json', 'rendered'];

export const FORENSIC_STAGE_LABELS = {
  rawOcr: 'RAW OCR',
  cleaned: 'CLEANED TEXT',
  sections: 'SECTION CLASSIFICATION',
  json: 'FINAL JSON',
  rendered: 'RENDERED TEMPLATE',
};

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function nonEmptyLines(text) {
  return String(text || '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

function normalizeLineKey(line) {
  return String(line || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

/** @returns {{ removed: string[], added: string[], modified: Array<{before:string,after:string}> }} */
export function diffStageLines(prevText, nextText) {
  const base = diffLineSets(prevText, nextText);
  const prev = nonEmptyLines(prevText);
  const next = nonEmptyLines(nextText);
  const nextByKey = new Map(next.map((l) => [normalizeLineKey(l), l]));
  const usedNext = new Set();
  const modified = [];

  for (const before of prev) {
    const key = normalizeLineKey(before);
    if (nextByKey.has(key)) {
      usedNext.add(key);
      continue;
    }
    let best = null;
    let bestScore = 0;
    for (const after of next) {
      const ak = normalizeLineKey(after);
      if (usedNext.has(ak)) continue;
      const score = lineSimilarity(before, after);
      if (score > bestScore && score >= 0.42 && score < 0.98) {
        bestScore = score;
        best = after;
      }
    }
    if (best) {
      modified.push({ before, after: best });
      usedNext.add(normalizeLineKey(best));
    }
  }

  return { removed: base.removed, added: base.added, modified };
}

function lineSimilarity(a, b) {
  const ta = normalizeLineKey(a).split(/\s+/).filter((w) => w.length > 1);
  const tb = normalizeLineKey(b).split(/\s+/).filter((w) => w.length > 1);
  if (!ta.length || !tb.length) return 0;
  const hit = ta.filter((w) => tb.some((x) => x.includes(w) || w.includes(x))).length;
  return hit / Math.max(ta.length, tb.length);
}

function stageMetrics(text, extra = {}) {
  const st = textStats(text);
  return {
    chars: st.chars,
    lines: st.lines,
    nonEmptyLines: st.nonEmptyLines,
    words: st.words,
    ...extra,
  };
}

function buildTransition(fromId, toId, prevText, nextText, extra = {}) {
  const prev = stageMetrics(prevText);
  const next = stageMetrics(nextText);
  const diff = diffStageLines(prevText, nextText);
  return {
    from: fromId,
    to: toId,
    charDelta: next.chars - prev.chars,
    lineDelta: next.nonEmptyLines - prev.nonEmptyLines,
    charLossPct: Math.round(lossRatio(prev.chars, next.chars) * 100),
    removedLines: diff.removed.length,
    removed: extra.removed?.length ? extra.removed : diff.removed,
    added: diff.added,
    modified: diff.modified,
    removedReason: extra.removedReason || null,
  };
}

/**
 * Resolve true RAW OCR: session capture (pre post-process) or pipeline input.
 */
export function resolveRawOcrText(pipeInput, forensicMeta = null) {
  const meta = forensicMeta || peekLastOcrForensic();
  if (meta?.rawOcr?.trim()) return String(meta.rawOcr);
  return String(pipeInput || '');
}

/**
 * Intermediate clean substeps (for console / audit only).
 */
export function buildCleanSubsteps(rawOcr) {
  let s = String(rawOcr || '');
  const steps = [];
  if (looksLikeOcrText(s)) {
    const afterOcr = postProcessOcrText(s, { ocr: true });
    steps.push({ id: 'ocrPost', label: 'ocr-postprocess', text: afterOcr });
    s = afterOcr;
  }
  const afterSafe = safeClean(s);
  steps.push({ id: 'safeClean', label: 'safeClean() [default]', text: afterSafe });
  const afterStrict = strictClean(s);
  steps.push({ id: 'strictClean', label: 'strictClean() [debug only]', text: afterStrict });
  const titleLine = s.split('\n').find((l) => /freelance|illustrator|frei|f r e/i.test(l)) || s.split('\n')[1] || '';
  if (titleLine.trim()) {
    const collapsed = strictClean(titleLine.trim());
    const afterStrip = stripOcrGarbage(collapsed);
    if (collapsed !== afterStrip) {
      steps.push({
        id: 'stripOcrGarbage',
        label: 'stripOcrGarbage (camelCase split)',
        text: afterStrip,
        note: `from: ${collapsed}`,
      });
    }
  }
  const { cleanedText, rejectedLines } = cleanTextWithRejected(afterSafe, { mode: 'safe' });
  steps.push({ id: 'lineCleaner', label: 'line-cleaner (safe)', text: cleanedText, rejectedLines });
  const final = cleanExtraction(rawOcr);
  steps.push({ id: 'cleanExtraction', label: 'cleanExtraction() safe', text: final });
  return { steps, final, rejectedLines };
}

/**
 * Pin where expected vs corrupted strings first diverge.
 * @param {Record<string,string>} stageTexts keyed by stage id
 * @param {{ expected?: string[], corrupted?: string[] }} needles
 */
export function pinpointCorruption(stageTexts, needles = {}) {
  const expected = needles.expected || ['Freelance Illustrator', 'Freelance', 'Illustrator'];
  const corrupted = needles.corrupted || ['Ce Frei Re', 'Ce Frei', 'Frei Re'];
  const order = FORENSIC_STAGE_IDS.filter((id) => stageTexts[id] != null);
  const report = { expected, corrupted, stages: {}, firstLoss: null, firstCorruption: null };

  for (const id of order) {
    const blob = String(stageTexts[id] || '');
    const low = blob.toLowerCase();
    report.stages[id] = {
      hasExpected: expected.some((e) => low.includes(String(e).toLowerCase())),
      hasCorrupted: corrupted.some((c) => low.includes(String(c).toLowerCase())),
    };
    if (!report.firstLoss && expected.length && !report.stages[id].hasExpected) {
      const prevIdx = order.indexOf(id) - 1;
      report.firstLoss = {
        stage: id,
        label: FORENSIC_STAGE_LABELS[id],
        afterStage: prevIdx >= 0 ? order[prevIdx] : null,
      };
    }
    if (!report.firstCorruption && corrupted.length && report.stages[id].hasCorrupted) {
      const prevIdx = order.indexOf(id) - 1;
      report.firstCorruption = {
        stage: id,
        label: FORENSIC_STAGE_LABELS[id],
        afterStage: prevIdx >= 0 ? order[prevIdx] : null,
      };
    }
  }
  return report;
}

/**
 * @param {string} pipeInput — text passed into runExtractionPipeline
 * @param {object} pipe — pipeline result
 * @param {{ templatePlainText?: string, forensicMeta?: object }} opts
 */
export function buildOcrForensic(pipeInput, pipe, opts = {}) {
  const rawOcr = resolveRawOcrText(pipeInput, opts.forensicMeta);
  const cleaned = String(pipe?.cleanedText || cleanExtraction(rawOcr));
  const { rejectedLines: preReject } = cleanTextWithRejected(rawOcr);
  const rejected = [
    ...new Set([
      ...(pipe?.rejectedLines || []),
      ...preReject,
      ...linesRemoved(rawOcr, cleaned).sample,
    ]),
  ].filter(Boolean);

  const sections = detectSections(cleaned);
  const sectionsText = formatSectionsAsText(sections);
  const cvData = pipe?.validatedCVData || pipe?.structured || {};
  const jsonText =
    pipe?.structuredResume != null
      ? debugStructuredResumeJson(pipe.structuredResume)
      : JSON.stringify(cvData, null, 2);
  const rendered =
    String(opts.templatePlainText || '').trim() || formatCvAsStructuredText(cvData);

  const stageTexts = {
    rawOcr,
    cleaned,
    sections: sectionsText,
    json: jsonText,
    rendered,
  };

  const cleanSub = buildCleanSubsteps(rawOcr);

  const stages = [
    {
      id: 'rawOcr',
      label: FORENSIC_STAGE_LABELS.rawOcr,
      text: rawOcr,
      ...stageMetrics(rawOcr),
      removedContent: [],
      modifiedContent: [],
    },
    {
      id: 'cleaned',
      label: FORENSIC_STAGE_LABELS.cleaned,
      text: cleaned,
      ...stageMetrics(cleaned),
      removedContent: rejected,
      modifiedContent: [],
      cleanSubsteps: cleanSub.steps,
    },
    {
      id: 'sections',
      label: FORENSIC_STAGE_LABELS.sections,
      text: sectionsText,
      ...stageMetrics(sectionsText),
      sections,
      removedContent: [],
      modifiedContent: [],
    },
    {
      id: 'json',
      label: FORENSIC_STAGE_LABELS.json,
      text: jsonText,
      ...stageMetrics(jsonText),
      removedContent: [],
      modifiedContent: [],
    },
    {
      id: 'rendered',
      label: FORENSIC_STAGE_LABELS.rendered,
      text: rendered,
      ...stageMetrics(rendered),
      htmlChars: opts.templateHtmlChars ?? 0,
      removedContent: [],
      modifiedContent: [],
    },
  ];

  const transitions = [
    buildTransition('rawOcr', 'cleaned', rawOcr, cleaned, {
      removed: rejected,
      removedReason: 'cleanExtraction · line-cleaner · dedupe',
    }),
    buildTransition('cleaned', 'sections', cleaned, sectionsText),
    buildTransition('sections', 'json', sectionsText, jsonText, {
      removedReason: 'structured field mapping',
    }),
    buildTransition('json', 'rendered', jsonText, rendered, {
      removedReason: 'template field projection',
    }),
  ];

  transitions.forEach((t, i) => {
    const stage = stages[i + 1];
    if (!stage) return;
    stage.removedContent = t.removed;
    stage.addedContent = t.added;
    stage.modifiedContent = t.modified;
    stage.removedLines = t.removedLines;
  });

  const corruption = pinpointCorruption(stageTexts);
  const totalLossPct = Math.round(
    lossRatio(rawOcr.length, Math.max(jsonText.length, rendered.length)) * 100
  );

  return {
    mode: 'ocr-forensic',
    stages,
    transitions,
    stageTexts,
    cleanSubsteps: cleanSub.steps,
    corruption,
    summary: {
      totalLossPct,
      largestDrop: transitions.reduce(
        (best, t) => (t.charLossPct > (best?.charLossPct ?? -1) ? t : best),
        null
      ),
      warnings: pipe?.audit?.warnings || [],
      timingMs: pipe?.audit?.timingMs ?? null,
      extractionMethod: pipe?.extractionMethod || opts.extractionMethod || null,
      corruptionVerdict: formatCorruptionVerdict(corruption),
    },
  };
}

function formatCorruptionVerdict(corruption) {
  if (!corruption) return '';
  const parts = [];
  if (corruption.firstCorruption) {
    parts.push(
      `Corruption pattern appears at ${corruption.firstCorruption.label} (after ${corruption.firstCorruption.afterStage || 'start'})`
    );
  }
  if (corruption.firstLoss) {
    parts.push(
      `Expected text lost at ${corruption.firstLoss.label} (after ${corruption.firstLoss.afterStage || 'start'})`
    );
  }
  return parts.join(' · ') || 'No pinned corruption pattern in default needles.';
}

/** Attach forensic summary to audit object (pipeline / debug). */
export function attachForensicToAudit(audit, forensic) {
  if (!audit || !forensic) return audit;
  audit.forensic = forensic;
  audit.stages = Object.fromEntries(
    forensic.stages.map((s) => [
      s.id,
      {
        label: s.label,
        chars: s.chars,
        lines: s.lines,
        nonEmptyLines: s.nonEmptyLines,
        removedLines: s.removedLines ?? (s.removedContent?.length || 0),
      },
    ])
  );
  if (forensic.summary?.corruptionVerdict) {
    audit.warnings = [...(audit.warnings || []), forensic.summary.corruptionVerdict];
  }
  return audit;
}

function highlightForensicBody(text, { removedSet, addedSet, modifiedMap }) {
  const lines = String(text || '').split('\n');
  return lines
    .map((line) => {
      const t = line.trim();
      if (!t) return '';
      const key = normalizeLineKey(t);
      let cls = 'trace-line';
      if (removedSet?.has(key)) cls += ' trace-line--removed';
      if (addedSet?.has(key)) cls += ' trace-line--added';
      if (modifiedMap?.has(key)) cls += ' trace-line--modified';
      if (/^\[[A-Z_]+\]$/.test(t)) cls += ' trace-line--section';
      const mod = modifiedMap?.get(key);
      const title = mod ? ` title="was: ${escapeHtml(mod.before)}"` : '';
      return `<div class="${cls}"${title}>${escapeHtml(line)}</div>`;
    })
    .join('');
}

function modifiedMapFromTransition(trans) {
  const m = new Map();
  for (const { after, before } of trans?.modified || []) {
    m.set(normalizeLineKey(after), { before, after });
  }
  return m;
}

function chipListModified(items) {
  if (!items?.length) return `<p class="trace-chip-empty">None</p>`;
  return `<ul class="trace-chip-list trace-chip-list--modified">${items
    .slice(0, 24)
    .map(
      ({ before, after }) =>
        `<li><span class="trace-from">${escapeHtml(before)}</span> → <span class="trace-to">${escapeHtml(after)}</span></li>`
    )
    .join('')}${items.length > 24 ? `<li class="trace-more">+${items.length - 24} more</li>` : ''}</ul>`;
}

function chipList(items, kind) {
  if (!items?.length) return `<p class="trace-chip-empty">None</p>`;
  return `<ul class="trace-chip-list trace-chip-list--${kind}">${items
    .slice(0, 24)
    .map((item) => {
      if (typeof item === 'string') return `<li>${escapeHtml(item)}</li>`;
      return `<li>${escapeHtml(item.line || JSON.stringify(item))}</li>`;
    })
    .join('')}${items.length > 24 ? `<li class="trace-more">+${items.length - 24} more</li>` : ''}</ul>`;
}

/** @param {ReturnType<typeof buildOcrForensic>} forensic */
export function renderOcrForensic(forensic) {
  const f = forensic || { stages: [], transitions: [] };
  const summary = f.summary || {};
  const corr = f.corruption;

  const corrHtml = corr
    ? `<div class="trace-corruption">
  <strong>Corruption pin</strong>
  ${FORENSIC_STAGE_IDS.map((id) => {
    const s = corr.stages?.[id];
    if (!s) return '';
    return `<span class="trace-corr-stage" data-ok="${s.hasExpected && !s.hasCorrupted}">${escapeHtml(FORENSIC_STAGE_LABELS[id])}: ${s.hasExpected ? '✓ expected' : '✗ expected'} · ${s.hasCorrupted ? '⚠ corrupted' : '○ clean'}</span>`;
  }).join('')}
  ${summary.corruptionVerdict ? `<p class="trace-corr-verdict">${escapeHtml(summary.corruptionVerdict)}</p>` : ''}
</div>`
    : '';

  const summaryHtml = `
<div class="trace-summary trace-summary--forensic">
  <span><strong>OCR FORENSIC</strong></span>
  <span>Total loss <strong>${summary.totalLossPct ?? 0}%</strong></span>
  ${summary.extractionMethod ? `<span>${escapeHtml(summary.extractionMethod)}</span>` : ''}
  ${summary.largestDrop ? `<span>Largest: <strong>${escapeHtml(summary.largestDrop.from)} → ${escapeHtml(summary.largestDrop.to)}</strong> (−${summary.largestDrop.charLossPct}%)</span>` : ''}
  ${summary.timingMs != null ? `<span>${summary.timingMs} ms</span>` : ''}
</div>`;

  const stageHtml = (f.stages || [])
    .map((stage, i) => {
      const trans = f.transitions?.[i];
      const removedSet = new Set((trans?.removed || []).map((l) => normalizeLineKey(l)));
      const addedSet = new Set((stage.addedContent || []).map((l) => normalizeLineKey(l)));
      const modMap = modifiedMapFromTransition(trans);
      const body = highlightForensicBody(stage.text, { removedSet, addedSet, modifiedMap: modMap });

      const substeps =
        stage.cleanSubsteps?.length ?
          `<details class="trace-details"><summary>Clean substeps (${stage.cleanSubsteps.length})</summary>${stage.cleanSubsteps
            .map(
              (sub) =>
                `<div class="trace-substep"><strong>${escapeHtml(sub.label)}</strong> · ${sub.text.length} chars<pre>${escapeHtml(sub.text.slice(0, 800))}</pre></div>`
            )
            .join('')}</details>`
        : '';

      const arrow =
        i < f.stages.length - 1 ?
          `<div class="trace-arrow" aria-hidden="true">↓<span class="trace-arrow-meta">${trans ? `${trans.charDelta >= 0 ? '+' : ''}${trans.charDelta} chars · ${trans.removedLines} removed · ${trans.added.length} added · ${trans.modified.length} modified` : ''}</span></div>`
        : '';

      return `
<article class="trace-stage" data-stage="${escapeHtml(stage.id)}">
  <header class="trace-stage-head">
    <h2>${escapeHtml(stage.label)}</h2>
    <div class="trace-metrics">
      <span>${stage.chars} chars</span>
      <span>${stage.nonEmptyLines} lines</span>
      ${stage.removedLines != null ? `<span>${stage.removedLines} removed</span>` : ''}
    </div>
  </header>
  <div class="trace-stage-body">${body || '<p class="trace-chip-empty">—</p>'}</div>
  ${
    i > 0 ?
      `<details class="trace-details" open>
    <summary>Removed (${(stage.removedContent || []).length})</summary>
    ${chipList(stage.removedContent, 'removed')}
  </details>
  <details class="trace-details" open>
    <summary>Modified (${(stage.modifiedContent || []).length})</summary>
    ${chipListModified(stage.modifiedContent)}
  </details>
  <details class="trace-details">
    <summary>Added (${(stage.addedContent || []).length})</summary>
    ${chipList(stage.addedContent, 'added')}
  </details>${substeps}`
    : substeps
  }
</article>${arrow}`;
    })
    .join('');

  const warn =
    summary.warnings?.length ?
      `<div class="trace-warnings">${summary.warnings.map((w) => escapeHtml(w)).join('<br>')}</div>`
    : '';

  return `${summaryHtml}${corrHtml}${warn}<div class="trace-pipeline trace-pipeline--forensic">${stageHtml}</div>`;
}

/** Console report for imports (no UI). */
export function logOcrForensic(forensic) {
  if (!forensic?.stages?.length) return;
  const rows = forensic.stages.map((s) => ({
    stage: s.label,
    chars: s.chars,
    lines: s.nonEmptyLines,
    removed: s.removedLines ?? s.removedContent?.length ?? 0,
    modified: s.modifiedContent?.length ?? 0,
  }));
  console.group('HIRELY OCR FORENSIC');
  console.table(rows);
  if (forensic.summary?.corruptionVerdict) {
    console.warn(forensic.summary.corruptionVerdict);
  }
  console.log('Corruption pin:', forensic.corruption);
  console.groupEnd();
}
