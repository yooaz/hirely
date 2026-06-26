/**
 * FORENSIC RESUME MODE — immutable in-memory snapshots per import.
 * OCR → Clean → Parser input → Parser output → Render input (never overwrite stages).
 */

export const FORENSIC_RESUME_MODE = 'FORENSIC_RESUME_MODE';

export const FORENSIC_ARTIFACT_NAMES = {
  OCR: 'ocr_text.txt',
  CLEAN: 'clean_text.txt',
  PARSER_INPUT: 'parser_input.txt',
  PARSER_OUTPUT: 'parser_output.json',
  RENDER_INPUT: 'render_input.json',
};

export const FORENSIC_STAGE_CHAIN = [
  FORENSIC_ARTIFACT_NAMES.OCR,
  FORENSIC_ARTIFACT_NAMES.CLEAN,
  FORENSIC_ARTIFACT_NAMES.PARSER_INPUT,
  FORENSIC_ARTIFACT_NAMES.PARSER_OUTPUT,
  FORENSIC_ARTIFACT_NAMES.RENDER_INPUT,
];

const MAX_IMPORT_HISTORY = 32;
/** @type {Map<string, object>} */
const importsById = new Map();
/** @type {string[]} */
const importOrder = [];

/**
 * @returns {boolean}
 */
export function isForensicResumeCaptureEnabled() {
  if (typeof globalThis !== 'undefined') {
    if (globalThis.HIRELY_FORENSIC_RESUME === true) return true;
    if (globalThis.HIRELY_FORENSIC_RESUME === false) return false;
  }
  if (typeof location !== 'undefined') {
    const q = new URLSearchParams(location.search).get('debug');
    if (q === 'forensic') return true;
  }
  return false;
}

function mimeForFilename(name) {
  if (name.endsWith('.json')) return 'application/json';
  return 'text/plain;charset=utf-8';
}

/**
 * @param {unknown} content
 * @param {{ asJson?: boolean }} [opts]
 */
function serializeArtifactContent(content, opts = {}) {
  if (content == null) return '';
  if (opts.asJson || typeof content === 'object') {
    try {
      return JSON.stringify(content, null, 2);
    } catch {
      return String(content);
    }
  }
  return String(content);
}

/**
 * @param {string} a
 * @param {string} b
 */
export function charDiffSummary(a, b) {
  const from = String(a ?? '');
  const to = String(b ?? '');
  let prefix = 0;
  const minLen = Math.min(from.length, to.length);
  while (prefix < minLen && from[prefix] === to[prefix]) prefix += 1;

  let suffix = 0;
  while (
    suffix < from.length - prefix &&
    suffix < to.length - prefix &&
    from[from.length - 1 - suffix] === to[to.length - 1 - suffix]
  ) {
    suffix += 1;
  }

  const removedChars = Math.max(0, from.length - prefix - suffix);
  const addedChars = Math.max(0, to.length - prefix - suffix);

  return {
    fromChars: from.length,
    toChars: to.length,
    delta: to.length - from.length,
    commonPrefix: prefix,
    commonSuffix: suffix,
    removedChars,
    addedChars,
    preservedRatio:
      from.length > 0
        ? Math.round(((prefix + suffix) / from.length) * 1000) / 10
        : to.length > 0
          ? 0
          : 100,
  };
}

/**
 * @param {object} entry
 */
export function buildForensicStageCompare(entry) {
  const latest = entry?.latest || {};
  const pairs = [];
  for (let i = 0; i < FORENSIC_STAGE_CHAIN.length - 1; i += 1) {
    const fromName = FORENSIC_STAGE_CHAIN[i];
    const toName = FORENSIC_STAGE_CHAIN[i + 1];
    const fromSnap = latest[fromName];
    const toSnap = latest[toName];
    if (!fromSnap && !toSnap) continue;
    const fromText = fromSnap?.content ?? '';
    const toText = toSnap?.content ?? '';
    pairs.push({
      from: fromName,
      to: toName,
      label: `${fromName} → ${toName}`,
      ...charDiffSummary(fromText, toText),
      fromCaptured: !!fromSnap,
      toCaptured: !!toSnap,
    });
  }
  return pairs;
}

/**
 * @param {object} [meta]
 */
export function beginForensicResumeImport(meta = {}) {
  if (!isForensicResumeCaptureEnabled()) return null;

  const id = `import-${Date.now()}-${importOrder.length + 1}`;
  const entry = {
    id,
    label: meta.fileName || meta.source || id,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    meta: { ...meta },
    /** @type {Record<string, object[]>} */
    artifacts: {},
    /** @type {Record<string, object>} */
    latest: {},
    /** @type {object[]} */
    captures: [],
    compare: [],
  };

  importsById.set(id, entry);
  importOrder.push(id);
  while (importOrder.length > MAX_IMPORT_HISTORY) {
    const drop = importOrder.shift();
    if (drop) importsById.delete(drop);
  }

  if (typeof globalThis !== 'undefined') {
    globalThis.HIRELY_FORENSIC_RESUME_CURRENT = id;
  }

  console.log('FORENSIC_RESUME_IMPORT_START', { id, meta: entry.meta });
  return id;
}

/**
 * @param {string|null} importId
 * @param {string} filename
 * @param {unknown} content
 * @param {object} [opts]
 */
export function captureForensicResumeStage(importId, filename, content, opts = {}) {
  if (!importId || !isForensicResumeCaptureEnabled()) return null;

  const entry = importsById.get(importId);
  if (!entry) return null;

  const text = serializeArtifactContent(content, opts);
  const version = (entry.artifacts[filename]?.length || 0) + 1;
  const snapshot = Object.freeze({
    filename,
    mime: mimeForFilename(filename),
    content: text,
    chars: text.length,
    version,
    capturedAt: new Date().toISOString(),
    stage: opts.stage || filename,
    note: opts.note || null,
  });

  if (!entry.artifacts[filename]) entry.artifacts[filename] = [];
  entry.artifacts[filename].push(snapshot);
  entry.latest[filename] = snapshot;
  entry.captures.push({
    filename,
    version,
    chars: snapshot.chars,
    capturedAt: snapshot.capturedAt,
  });

  entry.compare = buildForensicStageCompare(entry);

  console.log('FORENSIC_RESUME_CAPTURE', {
    importId,
    filename,
    version,
    chars: snapshot.chars,
  });

  return snapshot;
}

/**
 * @param {string|null} importId
 * @param {object} [opts]
 */
/**
 * Rebuild char-by-char stage table after late captures (e.g. render_input).
 * @param {string} importId
 */
export function refreshForensicResumeCompare(importId) {
  const entry = importsById.get(importId);
  if (!entry) return null;
  entry.compare = buildForensicStageCompare(entry);
  return entry;
}

/**
 * @param {string|null} importId
 * @param {object} [opts]
 */
export function finalizeForensicResumeImport(importId, opts = {}) {
  if (!importId) return null;
  const entry = importsById.get(importId);
  if (!entry) return null;

  entry.finishedAt = new Date().toISOString();
  if (opts.compare !== false) entry.compare = buildForensicStageCompare(entry);

  const summary = {
    id: entry.id,
    label: entry.label,
    startedAt: entry.startedAt,
    finishedAt: entry.finishedAt,
    meta: entry.meta,
    artifacts: Object.fromEntries(
      Object.entries(entry.latest).map(([name, snap]) => [
        name,
        { chars: snap.chars, version: snap.version, capturedAt: snap.capturedAt },
      ])
    ),
    compare: entry.compare,
  };

  if (typeof globalThis !== 'undefined') {
    globalThis.HIRELY_FORENSIC_RESUME = entry;
    globalThis.HIRELY_FORENSIC_RESUME_SUMMARY = summary;
  }

  console.log('FORENSIC_RESUME_IMPORT_DONE', summary);
  return entry;
}

/**
 * @param {string} importId
 */
export function getForensicResumeImport(importId) {
  return importsById.get(importId) || null;
}

export function listForensicResumeImports() {
  return importOrder.map((id) => importsById.get(id)).filter(Boolean);
}

/**
 * @param {object} snapshot
 */
export function createForensicDownloadUrl(snapshot) {
  if (!snapshot?.content) return null;
  const blob = new Blob([snapshot.content], { type: snapshot.mime || 'text/plain' });
  return URL.createObjectURL(blob);
}

/**
 * @param {object} entry
 */
export function renderForensicResumeDebugPanel(entry) {
  if (!entry?.latest) return '';

  const esc = (s) =>
    String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');

  const downloads = FORENSIC_STAGE_CHAIN.map((name) => {
    const snap = entry.latest[name];
    if (!snap) {
      return `<li class="forensicResumeMissing"><span>${esc(name)}</span> <em>not captured</em></li>`;
    }
    const v = snap.version > 1 ? ` v${snap.version}` : '';
    return `<li><button type="button" class="btn small forensicResumeDl" data-import="${esc(entry.id)}" data-file="${esc(name)}">${esc(name)}${v}</button> <span class="hirelyDebugMeta">${snap.chars} chars</span></li>`;
  }).join('');

  const compareRows = (entry.compare || [])
    .map((row) => {
      const status =
        row.fromCaptured && row.toCaptured
          ? `${row.fromChars} → ${row.toChars} (Δ${row.delta >= 0 ? '+' : ''}${row.delta}) · prefix ${row.commonPrefix} · removed ${row.removedChars} · added ${row.addedChars}`
          : 'pending';
      return `<tr><td>${esc(row.label)}</td><td>${esc(status)}</td><td>${row.preservedRatio ?? '—'}%</td></tr>`;
    })
    .join('');

  return `<div class="hirelyDebugStage forensicResumePanel" data-forensic-import="${esc(entry.id)}">
  <strong>FORENSIC RESUME MODE</strong>
  <p class="hirelyDebugMeta">Import <code>${esc(entry.id)}</code> · ${esc(entry.label)} · snapshots kept in memory (stages never overwritten)</p>
  <ul class="forensicResumeDownloads">${downloads}</ul>
  <table class="forensicResumeCompare"><thead><tr><th>Stage</th><th>Chars</th><th>Preserved prefix+suffix</th></tr></thead><tbody>${compareRows || '<tr><td colspan="3">No stage pairs yet</td></tr>'}</tbody></table>
  <p class="hirelyDebugMeta">Compare: OCR vs Clean vs Parser input vs Parser output vs Render — download each file to diff locally.</p>
</div>`;
}

/**
 * Bind download buttons inside a debug panel root.
 * @param {HTMLElement|null} root
 */
export function bindForensicResumeDownloadButtons(root) {
  if (!root?.querySelectorAll) return;
  root.querySelectorAll('.forensicResumeDl').forEach((btn) => {
    if (btn.dataset.bound === '1') return;
    btn.dataset.bound = '1';
    btn.addEventListener('click', () => {
      const importId = btn.getAttribute('data-import');
      const file = btn.getAttribute('data-file');
      const entry = getForensicResumeImport(importId);
      const snap = entry?.latest?.[file];
      if (!snap) return;
      const url = createForensicDownloadUrl(snap);
      if (!url) return;
      const a = document.createElement('a');
      a.href = url;
      a.download = `${importId}_${file}`;
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
    });
  });
}
