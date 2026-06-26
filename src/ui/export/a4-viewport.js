/**
 * A4Viewport — true 794×1123 canvas, fit / 75% / 100% / 125% zoom, centered preview.
 * Preview ≡ export at native A4 px per sheet (scale suspended on PDF export).
 */
(function (global) {
  const A4_WIDTH_MM = 210;
  const A4_HEIGHT_MM = 297;
  const A4_WIDTH_PX = 794;
  const A4_HEIGHT_PX = 1123;
  const A4_RATIO = A4_HEIGHT_MM / A4_WIDTH_MM;
  const PAGE_GAP_PX = 24;
  const OVERFLOW_TOLERANCE_PX = 2;
  const MIN_ZOOM = 0.22;
  const MAX_ZOOM = 1.25;
  const ZOOM_P75 = 0.75;
  const ZOOM_P100 = 1;
  const ZOOM_P125 = 1.25;
  const STORAGE_KEY = 'hirely-a4-zoom-mode';

  const ZOOM_MODES = Object.freeze({
    FIT: 'fit',
    P75: '75',
    P100: '100',
    P125: '125',
  });

  /** @typedef {'desktop'|'tablet'|'mobile'} ViewportTier */
  /** @typedef {'fit'|'75'|'100'|'125'} ZoomMode */

  let _zoomMode = ZOOM_MODES.P100;

  function loadStoredZoomMode() {
    try {
      const stored = global.sessionStorage?.getItem(STORAGE_KEY);
      if (
        stored === ZOOM_MODES.FIT ||
        stored === ZOOM_MODES.P75 ||
        stored === ZOOM_MODES.P100 ||
        stored === ZOOM_MODES.P125 ||
        stored === '90'
      ) {
        _zoomMode = stored === '90' ? ZOOM_MODES.P75 : stored;
      }
    } catch {
      /* ignore */
    }
  }

  function getZoomMode() {
    return _zoomMode;
  }

  /**
   * @param {ZoomMode} mode
   */
  function setZoomMode(mode) {
    const next =
      mode === ZOOM_MODES.P75 ||
      mode === ZOOM_MODES.P100 ||
      mode === ZOOM_MODES.P125 ||
      mode === ZOOM_MODES.FIT
        ? mode
        : ZOOM_MODES.FIT;
    _zoomMode = next;
    try {
      global.sessionStorage?.setItem(STORAGE_KEY, next);
    } catch {
      /* ignore */
    }
    updateZoomBarUI();
    return apply({ zoomMode: next });
  }

  function getViewportTier(width = global.innerWidth) {
    if (width <= 760) return 'mobile';
    if (width <= 1280) return 'tablet';
    return 'desktop';
  }

  /**
   * Uniform scale — fit mode shows entire first page; no horizontal crop.
   * @param {{ containerW: number, containerH: number, contentW?: number, zoomMode?: ZoomMode, padX?: number, padY?: number, tier?: ViewportTier }} opts
   */
  function computeZoom(opts) {
    const contentW = opts.contentW || A4_WIDTH_PX;
    const padX = opts.padX ?? 32;
    const padY = opts.padY ?? 32;
    const availW = Math.max(100, opts.containerW - padX);
    const availH = Math.max(120, opts.containerH - padY);
    const scaleW = availW / contentW;
    const scaleH = availH / A4_HEIGHT_PX;
    const mode = opts.zoomMode || _zoomMode || ZOOM_MODES.FIT;

    const tier = opts.tier || getViewportTier();

    if (mode === ZOOM_MODES.P125) {
      if (tier === 'desktop') {
        return Number(Math.min(ZOOM_P125, MAX_ZOOM).toFixed(4));
      }
      const zoom = Math.min(ZOOM_P125, scaleW, MAX_ZOOM);
      return Number(Math.max(MIN_ZOOM, zoom).toFixed(4));
    }

    if (mode === ZOOM_MODES.P100) {
      if (tier === 'desktop' || tier === 'tablet') {
        return ZOOM_P100;
      }
      const zoom = Math.min(ZOOM_P100, scaleW, MAX_ZOOM);
      return Number(Math.max(MIN_ZOOM, zoom).toFixed(4));
    }

    if (mode === ZOOM_MODES.P75) {
      if (tier === 'desktop') {
        return ZOOM_P75;
      }
      const zoom = Math.min(ZOOM_P75, scaleW, MAX_ZOOM);
      return Number(Math.max(MIN_ZOOM, zoom).toFixed(4));
    }

    const zoom = Math.min(scaleW, scaleH, MAX_ZOOM);
    return Number(Math.max(MIN_ZOOM, zoom).toFixed(4));
  }

  /**
   * SAFE_PAGE_OVERFLOW — detect content exceeding A4 sheet bounds.
   * @param {ParentNode|Document} [root]
   */
  function detectPageOverflow(root) {
    const doc = root || global.document;
    const sheets = [...doc.querySelectorAll('#cvDoc .cvA4Stack .cvA4Sheet, .cv.cv--a4 .cvA4Stack .cvA4Sheet')];
    /** @type {{ page: number, actual: number, limit: number, overflowPx: number }[]} */
    const pages = [];

    sheets.forEach((sheet, idx) => {
      const inner = sheet.querySelector('.cvInner');
      if (!inner) return;
      const actual = Math.max(inner.scrollHeight, inner.offsetHeight);
      const limit = A4_HEIGHT_PX;
      if (actual > limit + OVERFLOW_TOLERANCE_PX) {
        pages.push({
          page: idx + 1,
          actual: Math.round(actual),
          limit,
          overflowPx: Math.round(actual - limit),
        });
        sheet.classList.add('cvA4Sheet--overflow');
        sheet.setAttribute('data-overflow', String(Math.round(actual - limit)));
      } else {
        sheet.classList.remove('cvA4Sheet--overflow');
        sheet.removeAttribute('data-overflow');
      }
    });

    return {
      hasOverflow: pages.length > 0,
      pages,
      pageCount: sheets.length,
    };
  }

  function measureStack(docEl) {
    const stack = docEl?.querySelector('.cvA4Stack');
    const pages = stack ? stack.querySelectorAll('.cvA4Sheet').length : 1;
    const stackHeight = pages * A4_HEIGHT_PX + Math.max(0, pages - 1) * PAGE_GAP_PX;
    return { pages, stackHeight, contentW: A4_WIDTH_PX, contentH: stackHeight };
  }

  function getNodes() {
    return {
      viewport: global.document.getElementById('a4Viewport'),
      fit: global.document.querySelector('#a4Viewport .a4Viewport__fit'),
      inner: global.document.querySelector('#a4Viewport .cvStageInner') || global.document.querySelector('.cvStageInner'),
      stage: global.document.getElementById('cvStage') || global.document.querySelector('.cvStage'),
      doc: global.document.getElementById('cvDoc'),
      warn: global.document.getElementById('a4OverflowWarn'),
      zoomBar: global.document.getElementById('a4ZoomBar'),
    };
  }

  function updateZoomBarUI() {
    const { zoomBar } = getNodes();
    if (!zoomBar) return;
    const mode = _zoomMode;
    zoomBar.querySelectorAll('[data-a4-zoom]').forEach((btn) => {
      const active = btn.getAttribute('data-a4-zoom') === mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', active ? 'true' : 'false');
    });
    zoomBar.dataset.a4ZoomMode = mode;
  }

  function bindZoomBar() {
    const { zoomBar } = getNodes();
    if (!zoomBar || zoomBar._hirelyA4ZoomBound) return;
    zoomBar._hirelyA4ZoomBound = true;
    zoomBar.addEventListener('click', (e) => {
      const btn = e.target.closest('[data-a4-zoom]');
      if (!btn) return;
      setZoomMode(btn.getAttribute('data-a4-zoom'));
    });
  }

  let _exportSnapshot = null;

  /**
   * Remove preview scale so html2pdf captures true 794×1123 layout.
   */
  function suspendScaleForExport() {
    const { inner, fit, viewport } = getNodes();
    if (!inner) return null;
    _exportSnapshot = {
      innerTransform: inner.style.transform,
      innerWidth: inner.style.width,
      innerMaxWidth: inner.style.maxWidth,
      fitWidth: fit?.style.width || '',
      fitHeight: fit?.style.height || '',
      viewportZoom: viewport?.style.getPropertyValue('--a4-zoom') || '',
    };
    inner.style.transform = 'none';
    inner.style.width = `${A4_WIDTH_PX}px`;
    inner.style.maxWidth = `${A4_WIDTH_PX}px`;
    if (fit) {
      fit.style.width = `${A4_WIDTH_PX}px`;
      fit.style.height = '';
    }
    return _exportSnapshot;
  }

  function restoreScaleAfterExport() {
    _exportSnapshot = null;
    return apply();
  }

  /**
   * @param {{ tier?: ViewportTier, zoomMode?: ZoomMode }} [opts]
   */
  function apply(opts = {}) {
    if (global.document?.body?.classList.contains('export-pdf')) {
      return {
        zoom: 1,
        tier: 'desktop',
        mode: 'export',
        zoomMode: _zoomMode,
        metrics: measureStack(getNodes().doc),
        overflow: detectPageOverflow(),
      };
    }

    const nodes = getNodes();
    const { viewport, fit, inner, stage, doc, warn } = nodes;
    if (!inner || !stage) {
      return {
        zoom: 1,
        tier: 'desktop',
        mode: ZOOM_MODES.FIT,
        zoomMode: _zoomMode,
        metrics: { pages: 1, stackHeight: A4_HEIGHT_PX, contentW: A4_WIDTH_PX, contentH: A4_HEIGHT_PX },
      };
    }

    const tier = opts.tier || getViewportTier();
    const zoomMode = opts.zoomMode || _zoomMode;
    const metrics = doc?.classList.contains('cv--a4')
      ? measureStack(doc)
      : { pages: 1, stackHeight: A4_HEIGHT_PX, contentW: A4_WIDTH_PX, contentH: A4_HEIGHT_PX };

    const rect = stage.getBoundingClientRect();
    const zoom = computeZoom({
      containerW: rect.width,
      containerH: rect.height,
      contentW: metrics.contentW,
      zoomMode,
      tier,
      padX: tier === 'mobile' ? 20 : 24,
      padY: tier === 'desktop' ? 16 : 24,
    });

    inner.style.width = `${A4_WIDTH_PX}px`;
    inner.style.maxWidth = `${A4_WIDTH_PX}px`;
    inner.style.minHeight = '0';
    inner.style.transform = `scale(${zoom})`;
    inner.style.transformOrigin = 'top center';
    inner.style.margin = '0 auto';
    inner.style.setProperty('--a4-zoom', String(zoom));

    const visualW = Math.ceil(metrics.contentW * zoom);
    const visualH = Math.ceil(metrics.contentH * zoom);

    if (fit) {
      fit.style.width = `${visualW}px`;
      fit.style.height = `${visualH}px`;
      fit.style.margin = '0 auto';
      fit.style.maxWidth = zoom >= ZOOM_P100 - 0.02 ? `${visualW}px` : '100%';
    }

    if (viewport) {
      viewport.dataset.a4Tier = tier;
      viewport.dataset.a4Mode = zoomMode;
      viewport.dataset.a4Zoom = String(zoom);
      viewport.style.setProperty('--a4-zoom', String(zoom));
      viewport.classList.toggle('a4Viewport--native', zoom >= ZOOM_P100 - 0.02);
      viewport.classList.toggle('a4Viewport--fit', zoomMode === ZOOM_MODES.FIT);
    }

    stage.style.setProperty('--a4-zoom', String(zoom));
    stage.dataset.a4Zoom = String(zoom);
    stage.dataset.a4ZoomMode = zoomMode;

    if (global.HirelyA4Pages?.syncA4StackMetrics) {
      global.HirelyA4Pages.syncA4StackMetrics(inner);
    }

    let overflow = detectPageOverflow();
    if (
      overflow.hasOverflow &&
      doc?.classList.contains('cv--a4') &&
      global.HirelyA4Pages?.rebalanceCvA4Pages
    ) {
      global.HirelyA4Pages.rebalanceCvA4Pages(doc);
      if (global.HirelyA4Pages.syncA4StackMetrics) {
        global.HirelyA4Pages.syncA4StackMetrics(inner);
      }
      metrics.pages = measureStack(doc).pages;
      overflow = detectPageOverflow();
    }
    renderOverflowWarning(warn, overflow);
    updateZoomBarUI();

    return { zoom, tier, mode: zoomMode, zoomMode, metrics, overflow };
  }

  function renderOverflowWarning(el, overflow) {
    if (!el) return;
    if (!overflow?.hasOverflow) {
      el.classList.add('hidden');
      el.textContent = '';
      return;
    }
    const pages = overflow.pages.map((p) => `page ${p.page} (+${p.overflowPx}px)`).join(', ');
    el.textContent = `Content exceeds A4 page height — ${pages}. Repagination could not split further; preview is not cropped.`;
    el.classList.remove('hidden');
  }

  let resizeObserver = null;
  let resizeTimer = null;

  function bindResize() {
    const stage = global.document.getElementById('cvStage');
    if (!stage || resizeObserver) return;
    const schedule = () => {
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => apply(), 80);
    };
    if (typeof ResizeObserver !== 'undefined') {
      resizeObserver = new ResizeObserver(schedule);
      resizeObserver.observe(stage);
      const viewport = global.document.getElementById('a4Viewport');
      if (viewport) resizeObserver.observe(viewport);
    }
    global.addEventListener('resize', schedule, { passive: true });
    global.addEventListener('orientationchange', schedule, { passive: true });
  }

  function resolveDefaultZoomMode() {
    const tier = getViewportTier();
    return tier === 'mobile' ? ZOOM_MODES.FIT : ZOOM_MODES.P100;
  }

  function init() {
    loadStoredZoomMode();
    try {
      if (!global.sessionStorage?.getItem(STORAGE_KEY)) {
        _zoomMode = resolveDefaultZoomMode();
      }
    } catch {
      _zoomMode = resolveDefaultZoomMode();
    }
    bindResize();
    bindZoomBar();
    return apply();
  }

  loadStoredZoomMode();

  global.HirelyA4Viewport = {
    A4_WIDTH_MM,
    A4_HEIGHT_MM,
    A4_WIDTH_PX,
    A4_HEIGHT_PX,
    A4_RATIO,
    PAGE_GAP_PX,
    MIN_ZOOM,
    MAX_ZOOM,
    ZOOM_MODES,
    ZOOM_P75,
    ZOOM_P100,
    ZOOM_P125,
    getViewportTier,
    getZoomMode,
    setZoomMode,
    computeZoom,
    detectPageOverflow,
    measureStack,
    suspendScaleForExport,
    restoreScaleAfterExport,
    updateZoomBarUI,
    apply,
    init,
  };
})(typeof window !== 'undefined' ? window : globalThis);
