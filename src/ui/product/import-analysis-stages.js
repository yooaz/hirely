/**
 * Import progress — 4 product stages (UI only).
 */
(function (global) {
  const STAGES = Object.freeze([
    { id: 'file', labelKey: 'importProgressRead', detailKey: 'importProgressReadDetail', progress: 12 },
    { id: 'extract', labelKey: 'importProgressExtract', detailKey: 'importProgressExtractDetail', progress: 35 },
    { id: 'sections', labelKey: 'importProgressSections', detailKey: 'importProgressSectionsDetail', progress: 62 },
    { id: 'prepare', labelKey: 'importProgressPrepare', detailKey: 'importProgressPrepareDetail', progress: 92 },
  ]);

  const ORDER = STAGES.map((s) => s.id);

  /** Maps legacy internal steps → visible stage id */
  const STEP_ALIAS = Object.freeze({
    file: 'file',
    extract: 'extract',
    sections: 'sections',
    recruiter: 'sections',
    build: 'prepare',
    clean: 'prepare',
    preview: 'prepare',
    prepare: 'prepare',
  });

  function t(key) {
    if (typeof global.t === 'function') return global.t(key);
    return key;
  }

  function getHost() {
    return global.document.getElementById('importAnalysisStages');
  }

  function resolveStageId(stepId) {
    return STEP_ALIAS[stepId] || stepId || 'file';
  }

  function ensureMarkup(host) {
    if (!host || host._hirelyStagesBuilt) return;
    host._hirelyStagesBuilt = true;
    host.classList.add('importAnalysisStages');
    host.setAttribute('role', 'list');
    host.innerHTML = STAGES.map(
      (stage, idx) => `
        <li class="importAnalysisStage" data-stage="${stage.id}" role="listitem">
          <span class="importAnalysisStage__dot" aria-hidden="true"></span>
          <div class="importAnalysisStage__body">
            <span class="importAnalysisStage__label" data-i="${stage.labelKey}">${t(stage.labelKey)}</span>
            <span class="importAnalysisStage__detail" data-i="${stage.detailKey}">${t(stage.detailKey)}</span>
          </div>
          ${idx < STAGES.length - 1 ? '<span class="importAnalysisStage__line" aria-hidden="true"></span>' : ''}
        </li>`
    ).join('');
  }

  function stageIndex(id) {
    const resolved = resolveStageId(id);
    const i = ORDER.indexOf(resolved);
    return i < 0 ? 0 : i;
  }

  function setActive(stepId) {
    const host = getHost();
    if (!host) return;
    ensureMarkup(host);
    host.classList.remove('hidden');
    const resolved = resolveStageId(stepId);
    const activeIdx = stageIndex(resolved);
    host.querySelectorAll('.importAnalysisStage').forEach((el) => {
      const id = el.getAttribute('data-stage');
      const idx = stageIndex(id);
      el.classList.remove('is-active', 'is-done', 'is-pending');
      if (idx < activeIdx) el.classList.add('is-done');
      else if (idx === activeIdx) el.classList.add('is-active');
      else el.classList.add('is-pending');
    });
    const stage = STAGES.find((s) => s.id === resolved) || STAGES[0];
    host.dataset.activeStage = resolved;
    host.style.setProperty('--import-stage-progress', String(stage.progress));
  }

  function hide() {
    const host = getHost();
    if (!host) return;
    host.classList.add('hidden');
    host.removeAttribute('data-active-stage');
  }

  function show() {
    const host = getHost();
    if (!host) return;
    ensureMarkup(host);
    host.classList.remove('hidden');
  }

  global.HirelyImportStages = {
    STAGES,
    ORDER,
    STEP_ALIAS,
    setActive,
    hide,
    show,
    stageIndex,
    resolveStageId,
  };
})(typeof window !== 'undefined' ? window : globalThis);
