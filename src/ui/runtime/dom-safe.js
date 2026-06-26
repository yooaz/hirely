/**
 * Hirely DOM-safe helpers — never write innerHTML/textContent on null.
 */
(function initHirelyDomSafe(global) {
  function hirelyTrace(event) {
    if (global.HirelyBootTrace?.hirelyTrace) {
      return global.HirelyBootTrace.hirelyTrace(event);
    }
    if (global.HirelyDomContract?.hirelyTrace) {
      return global.HirelyDomContract.hirelyTrace(event);
    }
    if (!Array.isArray(global.__HIRELY_CORE_BOOT_TRACE__)) {
      global.__HIRELY_LEGACY_CORE_BOOT_TRACE__ = global.__HIRELY_CORE_BOOT_TRACE__;
      global.__HIRELY_CORE_BOOT_TRACE__ = [];
    }
    const payload =
      event && typeof event === 'object'
        ? { ...event, timestamp: event.timestamp || new Date().toISOString() }
        : { tag: String(event ?? 'BOOT'), timestamp: new Date().toISOString() };
    global.__HIRELY_CORE_BOOT_TRACE__.push(payload);
    return payload;
  }

  /** cvPreview is the contract id; live markup uses #cvDoc. */
  function byId(id) {
    if (id === 'cvPreview') {
      return global.document.getElementById('cvDoc') || global.document.getElementById('cvPreview');
    }
    return global.document.getElementById(id);
  }

  function setHTML(id, html) {
    const el = byId(id);
    if (!el) {
      hirelyTrace({ tag: 'MISSING_OPTIONAL_DOM', id, action: 'setHTML' });
      return false;
    }
    el.innerHTML = html;
    return true;
  }

  function setText(id, text) {
    const el = byId(id);
    if (!el) {
      hirelyTrace({ tag: 'MISSING_OPTIONAL_DOM', id, action: 'setText' });
      return false;
    }
    el.textContent = text;
    return true;
  }

  global.HirelyDomSafe = {
    byId,
    setHTML,
    setText,
    hirelyTrace,
  };
})(typeof window !== 'undefined' ? window : globalThis);
