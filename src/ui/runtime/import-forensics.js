/**
 * Hirely import lifecycle forensics — canonical milestone chain + first failure detection.
 */
(function initHirelyImportForensics(global) {
  const IMPORT_FORENSICS_V1 = 'IMPORT_FORENSICS_V1';

  /** @type {readonly string[]} */
  const CHAIN = Object.freeze([
    'DROP_RECEIVED',
    'FILE_SELECTED',
    'FILE_VALIDATED',
    'FILE_ROUTED',
    'PDF_TEXT_FOUND',
    'OCR_STARTED',
    'OCR_FINISHED',
    'EXTRACTION_STARTED',
    'EXTRACTION_FINISHED',
    'CV_READY',
    'EXPORT_READY',
  ]);

  /** Map legacy importLog / flow tags → canonical milestones */
  const ALIASES = Object.freeze({
    DROP_FILE_RECEIVED: 'DROP_RECEIVED',
    DROP_IMPORT_STARTED: 'DROP_RECEIVED',
    DOCUMENT_TYPE_DETECTED: 'FILE_ROUTED',
    PDF_NATIVE_FIRST: 'FILE_ROUTED',
    EXTRACTION_DONE: 'EXTRACTION_FINISHED',
    FINAL_RESUME_READY: 'CV_READY',
    IMPORT_READY: 'CV_READY',
    RENDER_DONE: 'CV_READY',
    REVIEW_SCREEN_VISIBLE: 'CV_READY',
    EXPORT_RENDERED: 'EXPORT_READY',
    OCR_DONE: 'OCR_FINISHED',
  });

  /** Tags that mark a failed or degraded terminal before chain completion */
  const FAILURE_TAGS = Object.freeze([
    'IMPORT_ERROR',
    'IMPORT_FAILED',
    'IMPORT_NEEDS_PASTE',
    'RAW_TEXT_THRESHOLD',
    'EXTRACTION_FAILED',
    'OCR_TIMEOUT',
    'OCR_TIMEOUT_PASTE_FALLBACK',
    'PARSER_SKIPPED_EMPTY_RAW',
    'IMPORT_STEP_ERROR',
    'RENDER_SKIPPED_EMPTY_RAW',
    'RENDER_SKIPPED_PLACEHOLDER_ONLY',
    'FALLBACK_BLOCKED',
  ]);

  const failureSet = new Set(FAILURE_TAGS);

  function forensicState() {
    if (!global.__HIRELY_IMPORT_FORENSICS__) {
      global.__HIRELY_IMPORT_FORENSICS__ = {
        version: IMPORT_FORENSICS_V1,
        steps: [],
        firstFailure: null,
        runId: null,
      };
    }
    return global.__HIRELY_IMPORT_FORENSICS__;
  }

  function normalizeTag(tag) {
    const key = String(tag || '').split(/\s/)[0];
    return ALIASES[key] || key;
  }

  /**
   * @param {string} tag
   * @param {unknown} [detail]
   * @param {Record<string, unknown>} [meta]
   */
  function record(tag, detail, meta = {}) {
    const raw = String(tag || '').split(/\s/)[0];
    const canonical = normalizeTag(raw);
    const fs = forensicState();
    const entry = {
      tag: canonical,
      raw,
      detail: detail ?? null,
      meta,
      at: Date.now(),
      iso: new Date().toISOString(),
    };
    fs.steps.push(entry);
    if (fs.steps.length > 400) fs.steps.shift();

    if (failureSet.has(raw) && !fs.firstFailure) {
      fs.firstFailure = { ...entry, tag: raw };
    }

    if (global.HirelyBootTrace?.isBootDebug?.() || global.HirelyImportForensics?.isForensicMode?.()) {
      const extra = detail != null ? (typeof detail === 'object' ? detail : String(detail)) : '';
      console.log(`[Hirely import forensic] ${canonical}${raw !== canonical ? ` (${raw})` : ''}`, extra || '');
    }

    return entry;
  }

  function reset(runId) {
    global.__HIRELY_IMPORT_FORENSICS__ = {
      version: IMPORT_FORENSICS_V1,
      steps: [],
      firstFailure: null,
      runId: runId ?? null,
    };
    return global.__HIRELY_IMPORT_FORENSICS__;
  }

  /** Branch milestones — required only when import path uses that branch */
  const BRANCH_PDF = 'PDF_TEXT_FOUND';
  const BRANCH_OCR = Object.freeze(['OCR_STARTED', 'OCR_FINISHED']);

  /** End milestone — may fire after CV_READY when export panel renders */
  const DEFERRED_END = 'EXPORT_READY';

  function applicableChain(completedSet) {
    const base = [
      'DROP_RECEIVED',
      'FILE_SELECTED',
      'FILE_VALIDATED',
      'FILE_ROUTED',
      'EXTRACTION_STARTED',
      'EXTRACTION_FINISHED',
      'CV_READY',
    ];
    const branch = completedSet.has(BRANCH_PDF)
      ? 'pdf_text'
      : BRANCH_OCR.some((t) => completedSet.has(t))
        ? 'ocr'
        : null;
    if (branch === 'pdf_text') base.push(BRANCH_PDF);
    else if (branch === 'ocr') base.push(...BRANCH_OCR);
    if (completedSet.has(DEFERRED_END) || completedSet.has('CV_READY')) base.push(DEFERRED_END);
    return base;
  }

  function isForensicMode() {
    try {
      const q = new URLSearchParams(global.location?.search || '').get('debug');
      return q === 'forensic' || q === 'true' || q === '1';
    } catch {
      return false;
    }
  }

  function getForensicReport() {
    const fs = forensicState();
    const steps = fs.steps.slice();
    const completed = [];
    const completedSet = new Set();

    for (const s of steps) {
      if (CHAIN.includes(s.tag) && !completedSet.has(s.tag)) {
        completedSet.add(s.tag);
        completed.push(s.tag);
      }
    }

    const missing = CHAIN.filter((t) => !completedSet.has(t));
    const applicable = applicableChain(completedSet);
    const missingApplicable = applicable.filter((t) => !completedSet.has(t));

    let firstChainGap = missingApplicable[0] || null;

    let firstFailurePoint = null;
    if (fs.firstFailure) {
      firstFailurePoint = {
        type: 'explicit_failure',
        tag: fs.firstFailure.tag,
        at: fs.firstFailure.iso,
        detail: fs.firstFailure.detail,
        chainGapAtFailure: firstChainGap,
      };
    } else if (firstChainGap && !completedSet.has('CV_READY')) {
      firstFailurePoint = {
        type: 'chain_incomplete',
        tag: firstChainGap,
        at: null,
        detail: `Milestone never reached: ${firstChainGap}`,
        chainGapAtFailure: firstChainGap,
      };
    } else if (firstChainGap === DEFERRED_END && completedSet.has('CV_READY')) {
      firstFailurePoint = {
        type: 'deferred_optional',
        tag: DEFERRED_END,
        at: null,
        detail: 'Import succeeded; export step not yet rendered',
        chainGapAtFailure: DEFERRED_END,
      };
    }

    const branch = completedSet.has('PDF_TEXT_FOUND')
      ? 'pdf_text'
      : completedSet.has('OCR_STARTED') || completedSet.has('OCR_FINISHED')
        ? 'ocr'
        : completedSet.has('FILE_ROUTED')
          ? 'routed'
          : null;

    return {
      version: IMPORT_FORENSICS_V1,
      chain: CHAIN.slice(),
      steps,
      completed,
      missing,
      missingApplicable,
      applicable,
      branch,
      firstFailure: fs.firstFailure,
      firstFailurePoint,
      runId: fs.runId,
      flowLogCount: (global.__HIRELY_FLOW_LOGS || []).length,
    };
  }

  /** Bridge extraction console lines when ?debug=forensic */
  function bridgeExtractionConsole() {
    if (global.__HIRELY_IMPORT_FORENSICS_CONSOLE_BRIDGED__) return;
    global.__HIRELY_IMPORT_FORENSICS_CONSOLE_BRIDGED__ = true;
    const orig = global.console.log;
    global.console.log = function (...args) {
      const msg = args.map((a) => (typeof a === 'string' ? a : JSON.stringify(a))).join(' ');
      if (/\bOCR_STARTED\b/.test(msg)) record('OCR_STARTED', msg);
      if (/\bOCR_FINISHED\b/.test(msg)) record('OCR_FINISHED', msg);
      return orig.apply(global.console, args);
    };
  }

  if (isForensicMode()) bridgeExtractionConsole();

  global.HirelyImportForensics = {
    IMPORT_FORENSICS_V1,
    CHAIN,
    ALIASES,
    FAILURE_TAGS,
    record,
    reset,
    getForensicReport,
    isForensicMode,
  };
})(typeof window !== 'undefined' ? window : globalThis);
