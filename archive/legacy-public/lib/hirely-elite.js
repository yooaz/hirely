/**
 * Hirely Elite — layout, preview visibility, paywall UX (no core logic changes).
 */
(function (global) {
  let previewHome = null;

  function mountCinemaLayout() {
    if (document.querySelector('.productShell.os-layout')) return;
    const grid = document.querySelector('.cinemaGrid');
    const preview = document.getElementById('workspacePreview');
    if (!grid || !preview) return;

    let col = grid.querySelector('.previewColumn');
    if (!col) {
      col = document.createElement('div');
      col.className = 'previewColumn';
      grid.appendChild(col);
    }

    if (!previewHome) previewHome = preview.parentElement;
    if (preview.parentElement !== col) col.appendChild(preview);
  }

  function syncPreviewState() {
    const preview = document.getElementById('workspacePreview');
    const paper = document.getElementById('cvPaper');
    const lock = document.getElementById('proLock');
    if (!preview) return;
    const has =
      paper &&
      !paper.querySelector('.cvEmpty') &&
      (paper.innerText || '').trim().length > 8;
    preview.classList.toggle('has-cv', !!has);
    if (lock && has && !global.appState?.isPro) {
      lock.classList.remove('hidden');
    }
  }

  function onScoreAnimated(score) {
    const block = document.getElementById('scoreBlock');
    if (!block) return;
    block.classList.add('scoreBlock--alive');
    const ring = document.getElementById('scoreRing');
    if (ring && score > 0) {
      ring.style.setProperty('--score', score);
    }
    setTimeout(() => block.classList.remove('scoreBlock--alive'), 1400);
  }

  function patchPaywall() {
    const orig = global.updatePaywall;
    if (!orig || orig._elitePatched) return;
    global.updatePaywall = function elitePaywall() {
      orig.apply(this, arguments);
      syncPreviewState();
      const pro = global.appState?.isPro || global.isPro?.();
      const gen = global.appState?.hasGeneratedCV;
      const lock = document.getElementById('proLock');
      const title = document.getElementById('proLockTitle');
      const msg = document.getElementById('proLockMsg');
      if (lock) {
        lock.classList.remove('proLock--overlay');
        lock.classList.add('proLock--compact');
      }
      if (lock && title && msg) {
        if (gen && !pro) {
          title.textContent = 'Preview ready — unlock to edit & export';
          msg.textContent =
            'Your document is live below. Pro unlocks in-place editing, premium templates, PDF export, and LinkedIn rewrite.';
          lock.classList.remove('hidden');
        } else if (!gen) {
          title.textContent = 'Your live CV preview';
          msg.textContent =
            'Upload or paste your CV, complete the recruiter scan, then rebuild positioning.';
        } else if (pro) {
          lock.classList.add('hidden');
        }
      }
      document.getElementById('workspacePreview')?.classList.remove('preview-locked');
      document.getElementById('workspacePreview')?.classList.toggle('preview-locked-edit', !pro);
      const cv = document.getElementById('cvPreview');
      if (cv) cv.setAttribute('contenteditable', pro ? 'true' : 'false');
      document.querySelectorAll('.moveBtn').forEach((b) => {
        b.disabled = !pro;
      });
    };
    global.updatePaywall._elitePatched = true;
  }

  function patchRenderCV() {
    const orig = global.renderCV;
    if (!orig || orig._elitePatched) return;
    global.renderCV = function eliteRenderCV(d, opts) {
      const out = orig.apply(this, arguments);
      syncPreviewState();
      return out;
    };
    global.renderCV._elitePatched = true;
  }

  function bindPreviewParallax() {
    const stage = document.getElementById('cvStage');
    const page = stage?.querySelector('.cvPage');
    if (!stage || !page || stage.dataset.parallaxBound) return;
    stage.dataset.parallaxBound = '1';
    let raf = 0;
    stage.addEventListener('mousemove', (e) => {
      if (global.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
      const rect = stage.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width - 0.5;
      const y = (e.clientY - rect.top) / rect.height - 0.5;
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        page.style.transform = `translate(${x * 8}px, ${y * 5}px) rotateX(${-y * 1}deg) rotateY(${x * 1.2}deg)`;
      });
    });
    stage.addEventListener('mouseleave', () => {
      page.style.transform = '';
    });
  }

  function patchScoreScan() {
    const orig = global.renderAutoScore;
    if (!orig || orig._eliteScan) return;
    global.renderAutoScore = function () {
      const panel = document.querySelector('.scorePanel');
      panel?.classList.add('is-scanning');
      const out = orig.apply(this, arguments);
      setTimeout(() => panel?.classList.remove('is-scanning'), 700);
      return out;
    };
    global.renderAutoScore._eliteScan = true;
  }

  function init() {
    mountCinemaLayout();
    patchPaywall();
    patchRenderCV();
    patchScoreScan();
    bindPreviewParallax();
    syncPreviewState();
    global.addEventListener('resize', () => {
      clearTimeout(global._eliteResize);
      global._eliteResize = setTimeout(() => {
        mountCinemaLayout();
        bindPreviewParallax();
      }, 120);
    });
  }

  global.HirelyElite = {
    init,
    mountCinemaLayout,
    syncPreviewState,
    onScoreAnimated,
  };
})(typeof window !== 'undefined' ? window : globalThis);
