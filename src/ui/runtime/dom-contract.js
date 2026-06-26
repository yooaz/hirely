/**
 * Hirely DOM contract — single source of truth for required vs optional DOM after P0 subtraction.
 * Boot stops only when validateDomContract().valid === false (missing required IDs).
 */
(function initHirelyDomContract(global) {
  /** @type {readonly string[]} */
  const requiredIds = Object.freeze([
    'app',
    'docNav',
    'wsImport',
    'drop',
    'fileInput',
    'cvPreview',
  ]);

  /** @type {readonly string[]} */
  const optionalIds = Object.freeze([
    'auditPanelInner',
    'auditPanel',
    'linkedinPanel',
    'letterPanel',
    'linkedinText',
    'letterText',
    'hirelyDebugPanel',
    'hirelyForensicPanel',
    'pipelineReportPanel',
    'importDebugPanel',
    'extractionGate',
    'extractionAlert',
    'exportFinalPanel',
    'hirelyTestClickBtn',
    'hirelyTestImport',
    'recruiterReviewPanel',
    'studioScorePanel',
    'wsInsights',
    'coverLetterWorkspace',
    'resultFlow',
    'templateGallery',
    'rawDetails',
    'workspace',
    'workspaceGrid',
    'wsProduct',
    'cvPanel',
    'cvDoc',
    'importPasteFallback',
    'statusText',
    'progress',
    'progressBar',
  ]);

  const requiredSet = new Set(requiredIds);
  const optionalSet = new Set(optionalIds);

  function resolveDomId(id) {
    return id === 'cvPreview' ? 'cvDoc' : id;
  }

  function isRequiredDom(id) {
    return requiredSet.has(id);
  }

  function isOptionalDom(id) {
    return optionalSet.has(id);
  }

  function byId(id) {
    if (global.HirelyDomSafe?.byId) return global.HirelyDomSafe.byId(id);
    return global.document.getElementById(resolveDomId(id));
  }

  function hirelyTrace(event) {
    if (global.HirelyBootTrace?.hirelyTrace) {
      return global.HirelyBootTrace.hirelyTrace(event);
    }
    const payload =
      event && typeof event === 'object'
        ? { ...event, timestamp: event.timestamp || new Date().toISOString() }
        : { tag: String(event ?? 'BOOT'), timestamp: new Date().toISOString() };
    if (!Array.isArray(global.__HIRELY_CORE_BOOT_TRACE__)) {
      global.__HIRELY_LEGACY_CORE_BOOT_TRACE__ = global.__HIRELY_CORE_BOOT_TRACE__;
      global.__HIRELY_CORE_BOOT_TRACE__ = [];
    }
    global.__HIRELY_CORE_BOOT_TRACE__.push(payload);
    return payload;
  }

  function recordMissingDom(id, source, tier) {
    global.__HIRELY_MISSING_DOM__ = global.__HIRELY_MISSING_DOM__ || [];
    global.__HIRELY_MISSING_DOM__.push({ id, source, tier, at: Date.now() });
  }

  function $(id) {
    return byId(id);
  }

  /**
   * Canonical DOM contract validation.
   * @returns {{ valid: boolean, missingRequired: string[], missingOptional: string[] }}
   */
  function validateDomContract() {
    const missingRequired = [];
    const missingOptional = [];

    for (const id of requiredIds) {
      if (!byId(id)) missingRequired.push(id);
    }
    for (const id of optionalIds) {
      if (!byId(id)) missingOptional.push(id);
    }

    if (missingRequired.length) {
      missingRequired.forEach((id) => {
        hirelyTrace({ tag: 'MISSING_REQUIRED_DOM', id, source: 'validateDomContract' });
      });
      global.console.error('HIRELY_DOM_CONTRACT_FAIL', { missingRequired });
    }

    if (missingOptional.length) {
      missingOptional.forEach((id) => {
        recordMissingDom(id, 'validateDomContract', 'optional');
        hirelyTrace({ tag: 'MISSING_OPTIONAL_DOM', id, action: 'validateDomContract' });
      });
      if (global.HirelyBootTrace?.isBootDebug?.()) {
        global.console.warn('HIRELY_DOM_CONTRACT_OPTIONAL_MISSING', missingOptional);
      }
    }

    const result = {
      valid: missingRequired.length === 0,
      missingRequired,
      missingOptional,
    };
    global.__HIRELY_DOM_CONTRACT__ = result;
    return result;
  }

  /** @deprecated Use validateDomContract().missingRequired */
  function validateRequiredDom() {
    return validateDomContract().missingRequired;
  }

  /**
   * @returns {{ ok: boolean, required?: boolean, id: string }}
   */
  function setHTML(id, html, source = 'setHTML') {
    const el = byId(id);
    if (!el) {
      recordMissingDom(id, source, isRequiredDom(id) ? 'required' : 'optional');
      if (isRequiredDom(id)) {
        hirelyTrace({ tag: 'MISSING_REQUIRED_DOM', id, source });
        return { ok: false, required: true, id };
      }
      hirelyTrace({ tag: 'MISSING_OPTIONAL_DOM', id, action: 'setHTML', source });
      return { ok: false, required: false, id };
    }
    el.innerHTML = html;
    return { ok: true, id };
  }

  /**
   * @returns {{ ok: boolean, required?: boolean, id?: string|null }}
   */
  function setText(id, text, source = 'setText') {
    const el = byId(id);
    if (!el) {
      recordMissingDom(id, source, isRequiredDom(id) ? 'required' : 'optional');
      if (isRequiredDom(id)) {
        hirelyTrace({ tag: 'MISSING_REQUIRED_DOM', id, source });
        return { ok: false, required: true, id };
      }
      hirelyTrace({ tag: 'MISSING_OPTIONAL_DOM', id, action: 'setText', source });
      return { ok: false, required: false, id };
    }
    el.textContent = text;
    return { ok: true, id };
  }

  /**
   * @returns {{ ok: boolean, required?: boolean, id?: string|null }}
   */
  function setElHTML(el, html, source = 'setElHTML', id = null) {
    if (!el) {
      if (id) recordMissingDom(id, source, isRequiredDom(id) ? 'required' : 'optional');
      if (id && isRequiredDom(id)) {
        hirelyTrace({ tag: 'MISSING_REQUIRED_DOM', id, source });
        return { ok: false, required: true, id };
      }
      hirelyTrace({ tag: 'MISSING_OPTIONAL_DOM', id, action: 'setElHTML', source });
      return { ok: false, required: !!id && isRequiredDom(id), id };
    }
    el.innerHTML = html;
    return { ok: true, id };
  }

  function storeBootDiagTrace(diagTrace) {
    if (!diagTrace) return;
    global.__HIRELY_CORE_BOOT_DIAG_TRACE__ = diagTrace;
    if (Array.isArray(diagTrace.steps)) diagTrace.steps.forEach((s) => hirelyTrace(s));
    else if (Array.isArray(diagTrace)) diagTrace.forEach((s) => hirelyTrace(s));
  }

  function mergeRenderStatus(target, result) {
    if (!result) return target;
    if (result.rendered) target.rendered.push(...result.rendered);
    if (result.skipped) target.skipped.push(...result.skipped);
    if (result.missingRequired) target.missingRequired.push(...result.missingRequired);
    if (typeof result.ok === 'boolean') target.ok = target.ok && result.ok;
    return target;
  }

  global.HirelyDomContract = {
    requiredIds,
    optionalIds,
    /** @deprecated */ REQUIRED_DOM_IDS: requiredIds,
    /** @deprecated */ OPTIONAL_DOM_IDS: optionalIds,
    resolveDomId,
    isRequiredDom,
    isOptionalDom,
    validateDomContract,
    validateRequiredDom,
    hirelyTrace,
    pushBootTrace: hirelyTrace,
    setHTML,
    setText,
    setElHTML,
    storeBootDiagTrace,
    mergeRenderStatus,
    byId,
    $,
  };

  if (global.HirelyBootTrace?.step) {
    const contract = validateDomContract();
    global.HirelyBootTrace.step('DOM_CONTRACT_READY', {
      source: 'src/ui/runtime/dom-contract.js',
      valid: contract.valid,
      requiredCount: requiredIds.length,
      optionalCount: optionalIds.length,
      missingRequired: contract.missingRequired,
      missingOptional: contract.missingOptional,
    });
    if (!contract.valid && global.HirelyBootTrace.fail) {
      global.HirelyBootTrace.fail(
        'DOM_CONTRACT_READY',
        `missing required DOM: ${contract.missingRequired.join(', ')}`,
        {
          source: 'src/ui/runtime/dom-contract.js',
          missingDomIds: contract.missingRequired,
        }
      );
    }
  }
})(typeof window !== 'undefined' ? window : globalThis);
