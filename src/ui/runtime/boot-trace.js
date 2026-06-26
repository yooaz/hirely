/**
 * Hirely boot trace — canonical hirelyTrace(). Never push __HIRELY_CORE_BOOT_TRACE__ directly.
 * Console output only when ?debug=true|1|forensic.
 */
(function initHirelyBootTrace(global) {
  const BOOT_TRACE_V1 = 'BOOT_TRACE_V1';

  const CHAIN = Object.freeze([
    'BOOT_START',
    'DOM_CONTRACT_READY',
    'CORE_IMPORT_STARTED',
    'CORE_IMPORT_OK',
    'TEMPLATE_REGISTRY_READY',
    'RENDER_OUTPUTS_START',
    'RENDER_OUTPUTS_OK',
    'RENDER_ALL_START',
    'RENDER_ALL_OK',
    'UI_READY',
    'IMPORT_READY',
  ]);

  function isBootDebug() {
    try {
      const q = new URLSearchParams(global.location?.search || '').get('debug');
      return q === 'true' || q === '1' || q === 'forensic';
    } catch {
      return false;
    }
  }

  function ensureBootTraceArray() {
    if (!Array.isArray(global.__HIRELY_CORE_BOOT_TRACE__)) {
      const cur = global.__HIRELY_CORE_BOOT_TRACE__;
      global.__HIRELY_LEGACY_CORE_BOOT_TRACE__ = cur;
      global.__HIRELY_LEGACY_BOOT_TRACE__ = cur;
      if (cur && typeof cur === 'object' && Array.isArray(cur.steps)) {
        global.__HIRELY_CORE_BOOT_TRACE__ = cur.steps.slice();
      } else {
        global.__HIRELY_CORE_BOOT_TRACE__ = [];
      }
    }
    return global.__HIRELY_CORE_BOOT_TRACE__;
  }

  function forensicState() {
    if (!global.__HIRELY_BOOT_FORENSIC__) {
      global.__HIRELY_BOOT_FORENSIC__ = { version: BOOT_TRACE_V1, steps: [], firstFailure: null };
    }
    return global.__HIRELY_BOOT_FORENSIC__;
  }

  function normalizeError(err) {
    if (!err) return { name: 'Error', message: 'unknown', stack: null };
    if (typeof err === 'string') return { name: 'Error', message: err, stack: null };
    return {
      name: err.name || 'Error',
      message: err.message || String(err),
      stack: err.stack || null,
    };
  }

  /** Canonical trace writer — replaces all direct __HIRELY_CORE_BOOT_TRACE__.push calls. */
  function hirelyTrace(event) {
    const payload =
      event && typeof event === 'object'
        ? { ...event, timestamp: event.timestamp || event.at || new Date().toISOString() }
        : { tag: String(event ?? 'BOOT'), timestamp: new Date().toISOString() };
    ensureBootTraceArray();
    global.__HIRELY_CORE_BOOT_TRACE__.push(payload);
    const fs = forensicState();
    fs.steps.push(payload);
    if (payload.status === 'failed' && !fs.firstFailure) {
      fs.firstFailure = payload;
    }
    return payload;
  }

  function step(tag, meta = {}) {
    const fs = forensicState();
    const prior = fs.steps.find((s) => s.tag === tag && s.status === 'ok');
    if (prior) return prior;
    const entry = hirelyTrace({ tag, status: 'ok', ...meta });
    if (isBootDebug()) {
      const extra = meta && Object.keys(meta).length ? meta : undefined;
      console.log(`[Hirely boot] ${tag}`, extra !== undefined ? extra : '');
    }
    return entry;
  }

  function fail(tag, err, meta = {}) {
    const e = normalizeError(err);
    const entry = hirelyTrace({
      tag,
      status: 'failed',
      errorName: e.name,
      errorMessage: e.message,
      stack: e.stack,
      ...meta,
    });
    if (isBootDebug()) {
      console.error(`[Hirely boot] ${tag} FAILED`, e.message, meta);
      if (e.stack) console.error(e.stack);
    }
    return entry;
  }

  function getForensicReport() {
    const trace = ensureBootTraceArray();
    const fs = forensicState();
    const completed = new Set(
      trace.filter((t) => t && t.status !== 'failed' && t.tag).map((t) => String(t.tag))
    );
    const failed = trace.filter((t) => t && t.status === 'failed');
    const missing = CHAIN.filter((s) => !completed.has(s));
    let firstFailure = fs.firstFailure;
    if (!firstFailure && failed.length) firstFailure = failed[0];

    return {
      version: BOOT_TRACE_V1,
      chain: CHAIN.slice(),
      completed: CHAIN.filter((s) => completed.has(s)),
      missing,
      firstFailure,
      failedCount: failed.length,
      traceLength: trace.length,
      bootOrder: global.__hirelyBootOrder || [],
      coreBoot: global.__HIRELY_CORE_BOOT__ || null,
      engineHealth: global.__HIRELY_ENGINE_HEALTH_STATE__ || global.__HIRELY_ENGINE_HEALTH__?.state || null,
    };
  }

  global.HirelyBootTrace = {
    BOOT_TRACE_V1,
    CHAIN,
    isBootDebug,
    ensureBootTraceArray,
    hirelyTrace,
    pushBootTrace: hirelyTrace,
    step,
    fail,
    getForensicReport,
  };

  global.hirelyTrace = hirelyTrace;

  step('BOOT_START', { source: 'src/ui/runtime/boot-trace.js' });
})(typeof window !== 'undefined' ? window : globalThis);
