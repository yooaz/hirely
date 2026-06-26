/**
 * Hirely Wow Factor — motion hooks (visual only).
 * Apple Document Studio · Linear · Pitch · Figma direction.
 */
(function (global) {
  const DOC = global.document;

  function prefersReduced() {
    return global.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches ?? false;
  }

  function byId(id) {
    return DOC.getElementById(id);
  }

  function onStepChange(step) {
    const grid = byId('workspaceGrid');
    const ws = byId('workspace');
    if (ws) ws.dataset.wowStep = step || '';
    if (!grid || prefersReduced()) return;
    grid.classList.remove('wow-step-enter');
    void grid.offsetWidth;
    grid.classList.add('wow-step-enter');
    global.setTimeout(() => grid.classList.remove('wow-step-enter'), 420);
  }

  function onWorkspaceReveal() {
    const app = byId('app');
    if (!app || prefersReduced()) return;
    app.classList.add('wow-workspace-reveal');
    global.setTimeout(() => app.classList.remove('wow-workspace-reveal'), 720);
  }

  function onImportStart() {
    const drop = byId('drop');
    const wsImport = byId('wsImport');
    if (drop) drop.classList.add('drop--processing');
    if (wsImport) wsImport.classList.add('wsImport--loading');
    setAnalysisLoading(true);
    setCenterLoading(true);
  }

  function onImportEnd() {
    const drop = byId('drop');
    if (drop) drop.classList.remove('drop--processing');
    setAnalysisLoading(false);
    setCenterLoading(false);
    DOC.documentElement.style.removeProperty('--wow-import-progress');
  }

  function syncImportProgress(pct, stageId) {
    const n = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    DOC.documentElement.style.setProperty('--wow-import-progress', String(n));
    const navFill = byId('progressNavFill');
    if (navFill && byId('app')?.classList.contains('app--processing')) {
      navFill.style.width = `${Math.max(8, n * 0.28)}%`;
    }
    const stages = byId('importAnalysisStages');
    if (stages && stageId) stages.dataset.wowStage = stageId;
  }

  function ensureAnalysisSkeleton() {
    const panel = byId('reviewStudioAnalysis');
    if (!panel || panel.querySelector('.wowPanelSkeleton')) return;
    const sk = DOC.createElement('div');
    sk.className = 'wowPanelSkeleton';
    sk.setAttribute('aria-hidden', 'true');
    sk.innerHTML = `
      <div style="display:flex;align-items:center;gap:12px;margin-bottom:4px">
        <div class="wowPanelSkeleton__ring"></div>
        <div style="flex:1;display:flex;flex-direction:column;gap:8px">
          <div class="wowPanelSkeleton__row wowPanelSkeleton__row--title"></div>
          <div class="wowPanelSkeleton__row wowPanelSkeleton__row--mid"></div>
        </div>
      </div>
      <div class="wowPanelSkeleton__row wowPanelSkeleton__row--wide"></div>
      <div class="wowPanelSkeleton__row wowPanelSkeleton__row--mid"></div>
      <div class="wowPanelSkeleton__row wowPanelSkeleton__row--wide"></div>`;
    panel.insertBefore(sk, panel.firstChild);
  }

  function setAnalysisLoading(on) {
    const panel = byId('reviewStudioAnalysis');
    if (!panel) return;
    ensureAnalysisSkeleton();
    panel.classList.toggle('wow-loading', !!on);
    const sk = panel.querySelector('.wowPanelSkeleton');
    if (sk) sk.classList.toggle('is-visible', !!on);
  }

  function setCenterLoading(on) {
    const panel = byId('reviewStudioCenter');
    if (panel) panel.classList.toggle('wow-loading', !!on);
  }

  function animateScore(ringEl, scoreEl, target, opts = {}) {
    if (!ringEl && !scoreEl) return;
    const value = Math.max(0, Math.min(100, Math.round(Number(target) || 0)));
    if (prefersReduced() || opts.instant) {
      if (scoreEl) {
        scoreEl.textContent = String(value);
        scoreEl.dataset.wowScore = String(value);
      }
      if (ringEl) ringEl.style.setProperty('--score', value);
      return;
    }
    const start = Number(scoreEl?.dataset.wowScore);
    const from = Number.isFinite(start) ? start : 0;
    if (from === value && scoreEl?.textContent === String(value)) return;

    ringEl?.classList.add('wow-score-animating');
    const duration = 520;
    const t0 = global.performance?.now?.() ?? Date.now();

    function tick(now) {
      const elapsed = now - t0;
      const p = Math.min(1, elapsed / duration);
      const ease = 1 - Math.pow(1 - p, 3);
      const current = Math.round(from + (value - from) * ease);
      if (scoreEl) scoreEl.textContent = String(current);
      if (ringEl) ringEl.style.setProperty('--score', current);
      if (p < 1) global.requestAnimationFrame(tick);
      else {
        if (scoreEl) scoreEl.dataset.wowScore = String(value);
        ringEl?.classList.remove('wow-score-animating');
        ringEl?.classList.add('wow-score-settled');
        global.setTimeout(() => ringEl?.classList.remove('wow-score-settled'), 500);
      }
    }
    global.requestAnimationFrame(tick);
  }

  function onScoreReport(report) {
    if (!report) return;
    const total = report.total;
    animateScore(byId('reviewV2ScoreRing'), byId('reviewV2ScoreTotal'), total);
    animateScore(byId('scoreRing'), byId('score'), total, { instant: prefersReduced() });
    animateScore(byId('studioScoreRing'), byId('studioScore'), total, { instant: true });
    staggerMetricBars(byId('reviewV2Metrics'));
  }

  function staggerMetricBars(el) {
    if (!el || prefersReduced()) return;
    el.classList.remove('metricScoreAnim');
    void el.offsetWidth;
    el.classList.add('metricScoreAnim');
    el.querySelectorAll('.bar span').forEach((bar) => {
      const w = bar.style.width;
      bar.style.width = '0%';
      global.requestAnimationFrame(() => {
        global.requestAnimationFrame(() => {
          bar.style.width = w;
        });
      });
    });
  }

  function decorateExtractionQuality(report) {
    const panel = byId('extractionQualityStep');
    if (!panel || !report?.rows?.length) return;

    const okCount = report.rows.filter((r) => r.ok).length;
    const pct = Math.round((okCount / report.rows.length) * 100);
    const color = pct >= 80 ? '#22c55e' : pct >= 55 ? '#f59e0b' : '#ef4444';

    let header = panel.querySelector('.wowConfidenceHeader');
    if (!header) {
      header = DOC.createElement('div');
      header.className = 'wowConfidenceHeader';
      header.innerHTML = `
        <div class="wowConfidenceRing" aria-hidden="true"><span></span></div>
        <div class="wowConfidenceCopy">
          <strong>Confiance extraction</strong>
          <p>Basé sur les champs détectés dans votre CV.</p>
        </div>`;
      const head = panel.querySelector('.extractionQualityHead');
      if (head?.nextSibling) panel.insertBefore(header, head.nextSibling);
      else panel.prepend(header);
    }

    const ring = header.querySelector('.wowConfidenceRing');
    const ringVal = header.querySelector('.wowConfidenceRing span');
    if (ring) {
      ring.style.setProperty('--wow-conf', pct);
      ring.style.setProperty('--wow-conf-color', color);
    }
    if (ringVal) ringVal.textContent = `${pct}%`;

    const items = panel.querySelectorAll('.extractionQualityItem');
    items.forEach((item, i) => {
      if (item.querySelector('.wowConfBar')) return;
      const row = report.rows[i];
      if (!row) return;
      const conf = row.ok ? (row.critical ? 92 : 78) : row.critical ? 18 : 42;
      const bar = DOC.createElement('div');
      bar.className = 'wowConfBar';
      bar.innerHTML = `<span style="width:${conf}%"></span>`;
      bar.setAttribute('aria-hidden', 'true');
      item.appendChild(bar);
    });
  }

  function onCvLoading(on) {
    if (on) setAnalysisLoading(true);
    else if (!byId('app')?.classList.contains('app--processing')) {
      setAnalysisLoading(false);
      setCenterLoading(false);
    }
  }

  global.HirelyWow = {
    onStepChange,
    onWorkspaceReveal,
    onImportStart,
    onImportEnd,
    syncImportProgress,
    animateScore,
    onScoreReport,
    decorateExtractionQuality,
    onCvLoading,
    setAnalysisLoading,
    setCenterLoading,
  };
})(typeof window !== 'undefined' ? window : globalThis);
