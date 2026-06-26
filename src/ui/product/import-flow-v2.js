/**
 * Import Flow V2 — 4-step recruiter journey: Upload → Analyze → Template → Download.
 */
(function (global) {
  const ENGINE = 'IMPORT_FLOW_V2';

  const MACRO = Object.freeze([
    { id: 'upload', num: 1, labelKey: 'importFlowV2StepUpload', hintKey: 'importFlowV2StepUploadHint' },
    { id: 'analyze', num: 2, labelKey: 'importFlowV2StepAnalyze', hintKey: 'importFlowV2StepAnalyzeHint' },
    { id: 'template', num: 3, labelKey: 'importFlowV2StepTemplate', hintKey: 'importFlowV2StepTemplateHint' },
    { id: 'download', num: 4, labelKey: 'importFlowV2StepDownload', hintKey: 'importFlowV2StepDownloadHint' },
  ]);

  const MICRO = Object.freeze([
    { id: 'read', labelKey: 'importFlowV2Reading', detailKey: 'importFlowV2ReadingDetail', progress: 10 },
    { id: 'structure', labelKey: 'importFlowV2Structure', detailKey: 'importFlowV2StructureDetail', progress: 28 },
    { id: 'experience', labelKey: 'importFlowV2Experience', detailKey: 'importFlowV2ExperienceDetail', progress: 48 },
    { id: 'build', labelKey: 'importFlowV2Build', detailKey: 'importFlowV2BuildDetail', progress: 72 },
    { id: 'report', labelKey: 'importFlowV2Report', detailKey: 'importFlowV2ReportDetail', progress: 92 },
  ]);

  const LEGACY_TO_MICRO = Object.freeze({
    file: 'read',
    extract: 'structure',
    sections: 'experience',
    recruiter: 'build',
    build: 'report',
    clean: 'report',
    preview: 'report',
    prepare: 'report',
    read: 'read',
    structure: 'structure',
    experience: 'experience',
    report: 'report',
    drop: 'read',
    upload: 'read',
    analyze: 'structure',
    template: 'build',
    download: 'report',
  });

  const MICRO_ORDER = MICRO.map((s) => s.id);
  let _microIdx = -1;
  let _macroId = 'upload';

  function t(key) {
    if (typeof global.t === 'function') return global.t(key);
    return key;
  }

  function host() {
    return global.document.getElementById('importFlowV2');
  }

  function ensureMarkup(root) {
    if (!root || root._hirelyFlowV2Built) return;
    root._hirelyFlowV2Built = true;
    root.className = 'importFlowV2';
    root.setAttribute('data-engine', ENGINE);
    root.innerHTML = `
      <ol class="importFlowV2__macro" role="list" aria-label="${t('importFlowV2MacroLabel')}">
        ${MACRO.map(
          (step) => `
          <li class="importFlowV2__macroStep" data-macro="${step.id}" role="listitem">
            <span class="importFlowV2__macroNum" aria-hidden="true">${step.num}</span>
            <span class="importFlowV2__macroLabel" data-i="${step.labelKey}">${t(step.labelKey)}</span>
          </li>`
        ).join('')}
      </ol>
      <div class="importFlowV2__extractPanel hidden" id="importFlowV2Extract" aria-live="polite">
        <div class="importFlowV2__orbWrap" aria-hidden="true">
          <span class="importFlowV2__orb"></span>
          <span class="importFlowV2__orbRing"></span>
        </div>
        <p class="importFlowV2__reassure" data-i="importFlowV2Reassure">${t('importFlowV2Reassure')}</p>
        <p class="importFlowV2__activeLabel" id="importFlowV2ActiveLabel"></p>
        <ol class="importFlowV2__micro" id="importFlowV2Micro" role="list">
          ${MICRO.map(
            (step) => `
            <li class="importFlowV2__microStep" data-micro="${step.id}" role="listitem">
              <span class="importFlowV2__microDot" aria-hidden="true"></span>
              <span class="importFlowV2__microLabel" data-i="${step.labelKey}">${t(step.labelKey)}</span>
            </li>`
          ).join('')}
        </ol>
      </div>
      <p class="importFlowV2__macroHint" id="importFlowV2MacroHint"></p>`;
  }

  function macroIndex(id) {
    const i = MACRO.findIndex((s) => s.id === id);
    return i < 0 ? 0 : i;
  }

  function microIndex(id) {
    const i = MICRO_ORDER.indexOf(id);
    return i < 0 ? 0 : i;
  }

  function setMacroStep(id, opts = {}) {
    const root = host();
    if (!root) return;
    ensureMarkup(root);
    const legacyMap = { drop: 'upload', extract: 'analyze', review: 'template', generate: 'download' };
    _macroId = legacyMap[id] || id || 'upload';
    root.dataset.macroStep = _macroId;
    const idx = macroIndex(_macroId);
    root.querySelectorAll('.importFlowV2__macroStep').forEach((el) => {
      const mid = el.getAttribute('data-macro');
      const mi = macroIndex(mid);
      el.classList.remove('is-active', 'is-done', 'is-pending');
      if (mi < idx) el.classList.add('is-done');
      else if (mi === idx) el.classList.add('is-active');
      else el.classList.add('is-pending');
    });
    const panel = root.querySelector('#importFlowV2Extract');
    const hintEl = root.querySelector('#importFlowV2MacroHint');
    const step = MACRO[idx] || MACRO[0];
    if (panel) panel.classList.toggle('hidden', _macroId !== 'analyze');
    if (hintEl && !opts.silent) {
      hintEl.textContent = t(step.hintKey);
      hintEl.classList.toggle('hidden', _macroId === 'analyze');
    }
    root.classList.toggle('importFlowV2--extracting', _macroId === 'analyze');
    const ws = global.document.getElementById('wsImport');
    if (ws) ws.classList.toggle('wsImport--flowV2Extract', _macroId === 'analyze');
  }

  function setMicroStep(stepId, opts = {}) {
    const root = host();
    if (!root) return null;
    ensureMarkup(root);
    const microId = LEGACY_TO_MICRO[stepId] || stepId || 'read';
    const nextIdx = microIndex(microId);
    if (!opts.force && _microIdx >= 0 && nextIdx < _microIdx) return null;
    _microIdx = nextIdx;
    const stage = MICRO[nextIdx] || MICRO[0];
    root.dataset.microStep = microId;
    root.style.setProperty('--import-flow-progress', String(stage.progress));
    root.querySelectorAll('.importFlowV2__microStep').forEach((el) => {
      const id = el.getAttribute('data-micro');
      const mi = microIndex(id);
      el.classList.remove('is-active', 'is-done', 'is-pending');
      if (mi < nextIdx) el.classList.add('is-done');
      else if (mi === nextIdx) el.classList.add('is-active');
      else el.classList.add('is-pending');
    });
    const activeLbl = root.querySelector('#importFlowV2ActiveLabel');
    if (activeLbl) activeLbl.textContent = t(stage.labelKey);
    return {
      label: t(stage.labelKey),
      detail: t(stage.detailKey),
      progress: stage.progress,
      microId,
    };
  }

  function syncDocStep(docStep, opts = {}) {
    if (opts.loading) {
      setMacroStep('analyze');
      return;
    }
    const step = docStep || 'import';
    if (step === 'import') setMacroStep('upload');
    else if (step === 'edit' || step === 'verify') setMacroStep('analyze');
    else if (step === 'style') setMacroStep('template');
    else if (step === 'export') setMacroStep('download');
    else setMacroStep('upload');
  }

  function onImportStart() {
    _microIdx = -1;
    setMacroStep('analyze');
    setMicroStep('read', { force: true });
  }

  function onImportEnd(success) {
    _microIdx = -1;
    if (success !== false) setMacroStep('template');
    else setMacroStep('upload');
    const root = host();
    if (root) root.classList.remove('importFlowV2--extracting');
  }

  function reset() {
    _microIdx = -1;
    setMacroStep('upload', { silent: true });
    setMicroStep('read', { force: true });
  }

  global.HirelyImportFlowV2 = {
    ENGINE,
    MACRO,
    MICRO,
    LEGACY_TO_MICRO,
    MICRO_ORDER,
    setMacroStep,
    setMicroStep,
    syncDocStep,
    onImportStart,
    onImportEnd,
    reset,
  };
})(typeof window !== 'undefined' ? window : globalThis);
