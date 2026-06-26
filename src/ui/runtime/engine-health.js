/**
 * Hirely engine health policy — BOOTING → CORE_READY → UI_READY → IMPORT_READY.
 * Optional gaps → DEGRADED (no production banner). Required core/DOM failure → FAILED.
 */
(function initHirelyEngineHealth(global) {
  const ENGINE_HEALTH_POLICY_V1 = 'ENGINE_HEALTH_POLICY_V1';

  const STATE = Object.freeze({
    BOOTING: 'BOOTING',
    CORE_READY: 'CORE_READY',
    UI_READY: 'UI_READY',
    IMPORT_READY: 'IMPORT_READY',
    DEGRADED: 'DEGRADED',
    FAILED: 'FAILED',
  });

  /** Debug-only optional DOM — never affects health. */
  const DEBUG_ONLY_DOM = new Set([
    'hirelyDebugPanel',
    'hirelyForensicPanel',
    'importDebugPanel',
    'pipelineReportPanel',
    'hirelyTestClickBtn',
    'hirelyTestImport',
  ]);

  /** Expected missing on P0 Review step — never degrades health. */
  const EXPECTED_OPTIONAL_DOM = new Set(['templateGallery']);

  function isDebugMode() {
    try {
      const q = new URLSearchParams(global.location?.search || '').get('debug');
      return q === 'true' || q === '1' || q === 'forensic';
    } catch {
      return false;
    }
  }

  function coreImportReady(mod) {
    return (
      !!mod &&
      typeof mod.runHirelyImportFromText === 'function' &&
      typeof mod.resumeDataMeetsImportMinimum === 'function' &&
      !mod.__hirelyFallback
    );
  }

  function fileImportReady(mod) {
    return !!mod && typeof mod.canonicalImportFromFile === 'function';
  }

  function ignoredOptionalDom(id) {
    if (DEBUG_ONLY_DOM.has(id) || EXPECTED_OPTIONAL_DOM.has(id)) return true;
    return global.HirelyDomContract?.isOptionalDom?.(id) ?? false;
  }

  function collectSignals(opts = {}) {
    const dom = global.HirelyDomContract;
    const contract = dom?.validateDomContract?.() || { valid: true, missingRequired: [], missingOptional: [] };
    const missingRequired = contract.missingRequired;
    const missingOptionalRaw = (global.__HIRELY_MISSING_DOM__ || [])
      .map((x) => x.id)
      .filter((id, i, a) => id && a.indexOf(id) === i);
    const missingOptional = missingOptionalRaw.filter((id) => !ignoredOptionalDom(id));

    const status = global.__HIRELY_CORE_STATUS__ || {};
    const assessment = opts.assessment || status.assessment || global.__HIRELY_CORE_BOOT_ASSESSMENT__ || null;
    const mod = opts.coreModule ?? global.HirelyCore ?? null;
    const uiReady = opts.uiReady ?? !!global.__HIRELY_UI_READY__;
    const bootFlag = global.__HIRELY_CORE_BOOT__;

    const optionalModules =
      assessment?.missingOptional ||
      status.missingOptional ||
      (status.unavailable || []).filter((id) => id !== 'import_core');

    return {
      mod,
      bootFlag,
      missingRequired,
      missingOptional,
      optionalModules,
      assessment,
      status,
      uiReady,
      importCoreOk: coreImportReady(mod) || status.loaded === true,
      fileImportOk: fileImportReady(mod) || status.modules?.fileImport === true,
      degradedFlag: !!(status.degraded || assessment?.degraded || bootFlag === 'degraded'),
    };
  }

  function deriveState(signals) {
    const reasons = [];

    if (signals.missingRequired.length) {
      return {
        state: STATE.FAILED,
        reasons: signals.missingRequired.map((id) => `required_dom:${id}`),
      };
    }

    if (!signals.importCoreOk) {
      if (signals.bootFlag !== 'failed') {
        return { state: STATE.BOOTING, reasons: [] };
      }
      reasons.push('import_core_unavailable');
      return { state: STATE.FAILED, reasons };
    }

    const optionalGap =
      signals.degradedFlag ||
      (signals.optionalModules && signals.optionalModules.length > 0) ||
      signals.missingOptional.length > 0;

    if (optionalGap) {
      const degReasons = [];
      if (signals.optionalModules?.length) degReasons.push(...signals.optionalModules.map((m) => `optional_module:${m}`));
      if (signals.missingOptional.length) degReasons.push(...signals.missingOptional.map((id) => `optional_dom:${id}`));
      if (!degReasons.length) degReasons.push('degraded');
      if (signals.uiReady && signals.fileImportOk) {
        return { state: STATE.DEGRADED, reasons: degReasons, importCapable: true };
      }
      if (signals.uiReady) {
        return { state: STATE.DEGRADED, reasons: degReasons, importCapable: signals.fileImportOk };
      }
      return { state: STATE.DEGRADED, reasons: degReasons, importCapable: signals.fileImportOk };
    }

    if (signals.uiReady && signals.fileImportOk) {
      return { state: STATE.IMPORT_READY, reasons: [] };
    }
    if (signals.uiReady) {
      return { state: STATE.UI_READY, reasons: [] };
    }
    if (signals.bootFlag === 'ok' || signals.bootFlag === 'degraded' || signals.importCoreOk) {
      return { state: STATE.CORE_READY, reasons: [] };
    }
    return { state: STATE.BOOTING, reasons: [] };
  }

  function publish(snapshot) {
    global.__HIRELY_ENGINE_HEALTH__ = snapshot;
    global.__HIRELY_ENGINE_HEALTH_STATE__ = snapshot.state;
    return snapshot;
  }

  function evaluate(opts = {}) {
    const signals = collectSignals(opts);
    const derived = deriveState(signals);
    const snapshot = publish({
      policy: ENGINE_HEALTH_POLICY_V1,
      state: derived.state,
      reasons: derived.reasons,
      importCapable: derived.importCapable ?? (derived.state !== STATE.FAILED && signals.importCoreOk),
      signals: {
        boot: signals.bootFlag,
        uiReady: signals.uiReady,
        importCoreOk: signals.importCoreOk,
        fileImportOk: signals.fileImportOk,
        missingRequired: signals.missingRequired,
        missingOptional: signals.missingOptional,
        optionalModules: signals.optionalModules || [],
      },
      at: Date.now(),
    });
    return snapshot;
  }

  function getState() {
    return global.__HIRELY_ENGINE_HEALTH__?.state || STATE.BOOTING;
  }

  function isFailed() {
    return getState() === STATE.FAILED;
  }

  function isImportAllowed() {
    const st = getState();
    if (st === STATE.FAILED) return false;
    if (st === STATE.BOOTING) return global.__HIRELY_CORE_BOOT__ !== 'failed';
    return true;
  }

  function isBooting() {
    const st = getState();
    return st === STATE.BOOTING && global.__HIRELY_CORE_BOOT__ !== 'failed' && global.__HIRELY_CORE_BOOT__ !== 'ok' && global.__HIRELY_CORE_BOOT__ !== 'degraded';
  }

  function applyUi(opts = {}) {
    const snapshot = evaluate(opts);
    const el = global.document.getElementById('hirelyCoreLoadError');
    const debug = opts.debugMode ?? isDebugMode();
    const t = typeof global.t === 'function' ? global.t : () => '';

    if (snapshot.state === STATE.FAILED) {
      if (el) {
        el.classList.remove('hirelyCoreLoadError--degraded');
        el.classList.remove('hidden');
        el.textContent =
          (t('coreLoadFail') || "Le moteur Hirely n'a pas chargé.") + (t('coreLoadFailReload') || ' Rechargez la page.');
      }
      global.console.error('HIRELY_ENGINE_FAILED', snapshot);
      return snapshot;
    }

    if (el) {
      el.classList.add('hidden');
      el.classList.remove('hirelyCoreLoadError--degraded');
    }

    if (snapshot.state === STATE.DEGRADED) {
      global.console.warn('HIRELY_ENGINE_DEGRADED', snapshot.reasons, snapshot.signals);
      if (debug && el) {
        el.classList.remove('hidden');
        el.classList.add('hirelyCoreLoadError--degraded');
        el.textContent = `DEGRADED (debug): ${snapshot.reasons.join(' · ') || 'optional gaps'}`;
      }
    }

    return snapshot;
  }

  function setBooting() {
    return publish({
      policy: ENGINE_HEALTH_POLICY_V1,
      state: STATE.BOOTING,
      reasons: [],
      importCapable: false,
      signals: {},
      at: Date.now(),
    });
  }

  function markUiReady() {
    global.__HIRELY_UI_READY__ = true;
    return applyUi({ uiReady: true });
  }

  function onCoreStatus(module, diag) {
    if (diag?.assessment) global.__HIRELY_CORE_BOOT_ASSESSMENT__ = diag.assessment;
    return applyUi({ coreModule: module, assessment: diag?.assessment, uiReady: !!global.__HIRELY_UI_READY__ });
  }

  global.HirelyEngineHealth = {
    POLICY: ENGINE_HEALTH_POLICY_V1,
    STATE,
    DEBUG_ONLY_DOM,
    EXPECTED_OPTIONAL_DOM,
    evaluate,
    applyUi,
    getState,
    isFailed,
    isImportAllowed,
    isBooting,
    setBooting,
    markUiReady,
    onCoreStatus,
    coreImportReady,
    ignoredOptionalDom,
  };

  setBooting();
})(typeof window !== 'undefined' ? window : globalThis);
