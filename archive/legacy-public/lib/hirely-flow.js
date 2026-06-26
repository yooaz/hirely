/**
 * Hirely Flow — transformation narrative + preview-first UX.
 */
(function (global) {
  const FLOW_ORDER = ['upload', 'analyze', 'transform', 'preview', 'export'];
  const LEGACY_MAP = {
    upload: 'upload',
    review: 'analyze',
    score: 'analyze',
    generate: 'transform',
    edit: 'preview',
    download: 'export',
  };

  function ensureTransformRail() {
    if (document.getElementById('transformRail')) return;
    const hero = document.querySelector('.hero--compact');
    if (!hero) return;
    const nav = document.createElement('nav');
    nav.className = 'transformRail';
    nav.id = 'transformRail';
    nav.setAttribute('aria-label', 'CV transformation');
    const labels = [
      ['upload', 'Upload'],
      ['analyze', 'Analyze'],
      ['transform', 'Transform'],
      ['preview', 'Preview'],
      ['export', 'Export'],
    ];
    nav.innerHTML = labels
      .map(([id, label], i) => {
        const arrow = i < labels.length - 1 ? '<span class="transformRail__arrow" aria-hidden="true">→</span>' : '';
        return `<span class="transformRail__step" data-step="${id}"><b>${i + 1}</b>${label}</span>${arrow}`;
      })
      .join('');
    hero.after(nav);
    setTransformStep('upload');
  }

  function setTransformStep(step) {
    const mapped = LEGACY_MAP[step] || step;
    const idx = FLOW_ORDER.indexOf(mapped);
    document.querySelectorAll('.transformRail__step').forEach((el) => {
      const s = el.dataset.step;
      const i = FLOW_ORDER.indexOf(s);
      el.classList.toggle('is-active', s === mapped);
      el.classList.toggle('is-done', i >= 0 && idx >= 0 && i < idx);
    });
  }

  function ensurePreviewBanner() {
    const preview = document.getElementById('workspacePreview');
    if (!preview || document.getElementById('previewBanner')) return;
    const banner = document.createElement('div');
    banner.id = 'previewBanner';
    banner.className = 'previewBanner hidden';
    banner.innerHTML =
      '<span id="previewBannerText">Your transformed CV is ready.</span> <button type="button" class="btn small blue" id="previewBannerUnlock">Unlock Pro to edit & export</button>';
    const stage = document.getElementById('cvStage');
    if (stage) preview.insertBefore(banner, stage);
    document.getElementById('previewBannerUnlock')?.addEventListener('click', () => {
      document.getElementById('unlockBtn')?.click();
    });
  }

  function syncPreviewBanner() {
    const banner = document.getElementById('previewBanner');
    if (!banner) return;
    const pro = global.appState?.isPro;
    const gen = global.appState?.hasGeneratedCV;
    const text = document.getElementById('previewBannerText');
    if (pro || !gen) {
      banner.classList.add('hidden');
      return;
    }
    banner.classList.remove('hidden');
    if (text) {
      text.textContent =
        'Your application is stronger — unlock Pro to edit in place and export a publication-ready PDF.';
    }
  }

  function patchPaywall() {
    const orig = global.updatePaywall;
    if (!orig || orig._flowPatched) return;
    global.updatePaywall = function flowPaywall() {
      orig.apply(this, arguments);
      const lock = document.getElementById('proLock');
      if (lock) lock.classList.add('hidden');
      const preview = document.getElementById('workspacePreview');
      preview?.classList.remove('preview-locked', 'preview-locked-edit');
      const cv = document.getElementById('cvPreview');
      if (cv && global.appState?.isPro) cv.setAttribute('contenteditable', 'true');
      else if (cv) cv.setAttribute('contenteditable', 'false');
      syncPreviewBanner();
    };
    global.updatePaywall._flowPatched = true;
  }

  function patchFlowStep() {
    const orig = global.setFlowStep;
    if (!orig || orig._flowPatched) return;
    global.setFlowStep = function flowStep(step) {
      orig.apply(this, arguments);
      setTransformStep(step);
    };
    global.setFlowStep._flowPatched = true;
  }

  function patchExperience() {
    const exp = global.HirelyExperience;
    if (!exp?.renderRecruiterReadiness || exp._flowPatched) return;
    const orig = exp.renderRecruiterReadiness;
    exp.renderRecruiterReadiness = function (d) {
      orig.call(this, d);
      const sec = document.getElementById('intelSecondary');
      if (sec) {
        sec.innerHTML = '';
        sec.classList.add('hidden');
      }
      if (Math.round(d?.score || 0) > 0) setTransformStep('analyze');
    };
    exp._flowPatched = true;
  }

  function patchGenerate() {
    const btn = document.getElementById('generateBtn');
    if (!btn || btn.dataset.flowBound) return;
    btn.addEventListener('click', () => {
      setTimeout(() => setTransformStep('transform'), 300);
    });
    btn.dataset.flowBound = '1';
  }

  function patchRenderCV() {
    const orig = global.renderCV;
    if (!orig || orig._flowPatched) return;
    global.renderCV = function flowRenderCV(d, opts) {
      const out = orig.apply(this, arguments);
      const paper = document.getElementById('cvPaper');
      const has =
        paper &&
        !paper.querySelector('.cvEmpty') &&
        (paper.innerText || '').trim().length > 8;
      if (has) setTransformStep('preview');
      syncPreviewBanner();
      return out;
    };
    global.renderCV._flowPatched = true;
  }

  function init() {
    ensureTransformRail();
    ensurePreviewBanner();
    patchPaywall();
    patchFlowStep();
    patchExperience();
    patchGenerate();
    patchRenderCV();
    if (global.updatePaywall) global.updatePaywall();
    setTransformStep('upload');
    if (global.HirelyPremium?.setPhase) global.HirelyPremium.setPhase('upload');
  }

  global.HirelyFlow = {
    init,
    setTransformStep,
    ensureTransformRail,
  };
})(typeof window !== 'undefined' ? window : globalThis);
