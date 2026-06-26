/**
 * Hirely CV Studio — stable V3 flow: intel → templates → giant CV preview.
 */
(function (global) {
  function enable() {
    document.documentElement.classList.add('classic-layout', 'winning-layout', 'v3-layout', 'studio-mode');
    document.body.classList.add('classic-layout', 'winning-layout', 'v3-layout', 'studio-mode');
  }

  function restoreStableGrid() {
    const grid = document.getElementById('workspaceGridRoot');
    const ws = grid?.querySelector('.v3Workstation');
    if (!grid) return;
    if (document.documentElement.classList.contains('layout-stacked')) {
      const preview = document.getElementById('result');
      const intel = document.querySelector('.col-intel');
      const upload = grid.querySelector('.col-upload');
      grid.querySelector('.v3Studio')?.remove();
      grid.querySelector('.v3Workstation')?.remove();
      if (intel && intel.parentElement !== grid) {
        if (upload) grid.insertBefore(intel, upload.nextSibling);
        else grid.appendChild(intel);
      }
      const analyze = document.getElementById('tools');
      if (preview && analyze && preview.parentElement === grid) {
        analyze.insertAdjacentElement('afterend', preview);
      }
      return;
    }

    if (ws) {
      const intel = ws.querySelector('.col-intel');
      const preview = ws.querySelector('.col-preview');
      const controls = ws.querySelector('.v3Controls');
      const upload = grid.querySelector('.col-upload');

      const headWrap = ws.querySelector('.winningOutputHead');
      if (headWrap && preview) {
        let chrome = preview.querySelector('.previewChrome');
        if (!chrome) {
          chrome = document.createElement('div');
          chrome.className = 'previewChrome';
          preview.insertBefore(chrome, preview.firstChild);
        }
        const wh = headWrap.querySelector('.workspaceHead');
        if (wh && wh.parentElement !== chrome) chrome.appendChild(wh);
        headWrap.remove();
      }

      if (controls && preview) {
        const tabRow = controls.querySelector('.tabRow');
        const toolbar = controls.querySelector('#proToolbar');
        const banner = controls.querySelector('#profileRecBanner');
        const panel = preview.querySelector('#procv');
        const insertBefore = panel || preview.firstChild;
        if (banner && banner.parentElement === controls) preview.insertBefore(banner, insertBefore);
        if (tabRow && tabRow.parentElement === controls) preview.insertBefore(tabRow, insertBefore);
        if (toolbar && toolbar.parentElement === controls) preview.insertBefore(toolbar, insertBefore);
        controls.remove();
      }

      if (intel && intel.parentElement === ws) {
        if (upload) grid.insertBefore(intel, upload.nextSibling);
        else grid.appendChild(intel);
      }
      if (preview && preview.parentElement === ws) grid.appendChild(preview);
      ws.remove();
    }

    structureStudioWorkspace();
    delete grid?.dataset?.winningStructured;
  }

  function structureStudioWorkspace() {
    if (document.documentElement.classList.contains('layout-stacked')) return;
    const grid = document.getElementById('workspaceGridRoot');
    const intel = document.querySelector('.col-intel');
    const preview = document.querySelector('.col-preview');
    if (!grid || !intel || !preview) return;
    if (preview.classList.contains('cvWorkspaceSection')) return;

    let studio = grid.querySelector('.v3Studio');
    if (!studio) {
      studio = document.createElement('div');
      studio.className = 'v3Studio';
    }

    if (intel.parentElement !== studio) studio.appendChild(intel);
    if (preview.parentElement !== studio) studio.appendChild(preview);

    const upload = grid.querySelector('.col-upload');
    if (studio.parentElement !== grid) {
      if (upload) grid.insertBefore(studio, upload.nextSibling);
      else grid.appendChild(studio);
    }

    mountTemplateRail();
    grid.dataset.studioStructured = '1';
  }

  function mountTemplateRail() {
    if (document.documentElement.classList.contains('layout-stacked') || document.getElementById('templatePicker')) {
      return;
    }
    const preview = document.querySelector('.col-preview');
    const host = document.getElementById('templateButtons');
    const panel = document.getElementById('procv');
    if (!preview || !host || !panel) return;

    let rail = document.getElementById('templateRail');
    if (!rail) {
      rail = document.createElement('div');
      rail.id = 'templateRail';
      rail.className = 'templateRail';
      rail.innerHTML =
        '<p class="templateRailLabel">Choose your professional direction</p>';
      preview.insertBefore(rail, panel);
    }

    if (host.parentElement !== rail) rail.appendChild(host);
    host.className = 'templateGallery templateGallery--studio';

    const toolbar = document.getElementById('proToolbar');
    if (toolbar && rail.nextElementSibling !== toolbar && toolbar.parentElement === panel) {
      panel.insertBefore(toolbar, panel.firstChild);
    }
  }

  function wrapInsightLists() {
    const grid = document.querySelector('.col-intel .insightGrid');
    if (!grid || grid.dataset.wrapped) return;

    const sl = document.getElementById('strengthList');
    const wl = document.getElementById('weaknessList');

    if (sl && !sl.closest('.insightBox')) {
      const box = document.createElement('div');
      box.className = 'insightBox strengths';
      box.innerHTML = '<h4>What works</h4>';
      box.appendChild(sl);
      grid.appendChild(box);
    }

    if (wl && !wl.closest('.insightBox')) {
      const box = document.createElement('div');
      box.className = 'insightBox weaknesses';
      box.innerHTML = '<h4>What hurts</h4>';
      box.appendChild(wl);
      grid.appendChild(box);
    }

    grid.classList.remove('hidden');
    grid.dataset.wrapped = '1';
  }

  function polishIntelPanel() {
    global.HirelyRestore?.reorderIntelPanel?.();
    wrapInsightLists();

    const panel = document.querySelector('.col-intel');
    if (!panel) return;

    panel.querySelector('.cardHead')?.classList.remove('hidden');
    const head = panel.querySelector('.cardHead h2');
    if (head) head.textContent = 'Recruiter read';

    const label = panel.querySelector('.scoreLabel');
    if (label) label.textContent = 'Overall score';

    const actions = document.getElementById('intelActions');
    const fixLabel = actions?.querySelector('.intelLabel');
    if (fixLabel) fixLabel.textContent = 'Action priorities';

    actions?.classList.remove('hidden');
    document.getElementById('verdict')?.removeAttribute('hidden');
    document.getElementById('summary')?.removeAttribute('hidden');
    document.getElementById('bars')?.removeAttribute('hidden');

    const previewH2 = document.querySelector('.previewChrome .workspaceHead h2');
    if (previewH2) previewH2.textContent = 'Live CV preview';

    panel.dataset.polished = '1';
  }

  function markCvPreviewState() {
    const wp = document.getElementById('workspacePreview');
    const has = global.cvHasContent?.(global.cvDraft || global.lastData?.premiumCV);
    wp?.classList.toggle('has-cv', !!has);
  }

  function patchRenderCV() {
    const orig = global.renderCV;
    if (!orig || orig._studioPatch) return;
    global.renderCV = function (d, opts) {
      orig.apply(this, arguments);
      markCvPreviewState();
      mountTemplateRail();
      if (global.renderTemplateButtons) global.renderTemplateButtons();
    };
    global.renderCV._studioPatch = true;
  }

  function patchRenderScoresNarrative() {
    const orig = global.renderScores;
    if (!orig || orig._winningNarrative) return;
    global.renderScores = function (d) {
      orig.apply(this, arguments);
      polishIntelPanel();
    };
    global.renderScores._winningNarrative = true;
  }

  function patchPaywall() {
    if (global._studioPaywall || typeof global.updatePaywall !== 'function') return;
    const orig = global.updatePaywall;
    global.updatePaywall = function () {
      orig.apply(this, arguments);
      const pro = global.appState?.isPro;
      const gen = global.appState?.hasGeneratedCV;
      const hasText = global.appState?.hasInputText;
      const hasCv = global.cvHasContent?.(global.cvDraft || global.lastData?.premiumCV);
      const showTools = pro || gen || hasText || hasCv;
      document.getElementById('proToolbar')?.classList.toggle('hidden', !showTools);
      const lock = document.getElementById('proLock');
      if (lock) {
        if (hasCv) lock.classList.add('hidden');
        else lock.classList.remove('hidden');
      }
      markCvPreviewState();
      mountTemplateRail();
      if (global.renderTemplateButtons) global.renderTemplateButtons();
    };
    global._studioPaywall = true;
  }

  function patchStable() {
    const stable = global.HirelyStable;
    if (!stable || stable._winningPatched) return;
    const origMount = stable.mountTemplatesBand;
    if (origMount) {
      stable.mountTemplatesBand = function () {
        if (document.documentElement.classList.contains('studio-mode')) return;
        return origMount.apply(this, arguments);
      };
    }
    stable._winningPatched = true;
  }

  function patchRestoreCards() {
    const restore = global.HirelyRestore;
    if (!restore || restore._studioCards) return;
    restore.ensureTemplateCards = function () {
      global.ensureTemplateButtonsHost?.();
      mountTemplateRail();
      if (global.renderTemplateButtons) global.renderTemplateButtons();
    };
    restore._studioCards = true;
  }

  function fixHero() {
    global.HirelyRestore?.restoreHero?.();
    const hero = document.querySelector('.hero--compact');
    if (!hero) return;

    const kicker = hero.querySelector('.kicker');
    if (kicker) {
      kicker.classList.remove('kicker--elite');
      kicker.innerHTML = '<span class="dot"></span> CV · LinkedIn · ATS · Beautiful PDF';
    }

    const lead = hero.querySelector('.heroLead');
    if (lead) {
      lead.textContent =
        'Upload, review and generate a professional CV with animated scoring, editable templates and premium PDF export.';
    }

    const gen = document.getElementById('generateBtn');
    if (gen && !gen.dataset.userLabel) gen.textContent = 'Generate Pro CV';
  }

  function init() {
    enable();
    restoreStableGrid();
    global.HirelyClassic?.enableClassicLayout?.();
    polishIntelPanel();
    fixHero();
    patchStable();
    patchRestoreCards();
    patchPaywall();
    patchRenderCV();
    patchRenderScoresNarrative();
    markCvPreviewState();

    requestAnimationFrame(() => {
      restoreStableGrid();
      polishIntelPanel();
      mountTemplateRail();
      markCvPreviewState();
      if (global.renderTemplateButtons) global.renderTemplateButtons();
      if (global.updatePaywall) global.updatePaywall();
      const cv = (document.getElementById('cvText')?.value || '').trim();
      if (cv.length >= 40 && global.previewLiveCv) global.previewLiveCv();
      else if (global.cvHasContent?.(global.cvDraft || global.lastData?.premiumCV) && global.renderCV) {
        global.renderCV(global.lastData || { premiumCV: global.cvDraft }, { preserve: true, silent: true });
        markCvPreviewState();
      }
    });
  }

  global.HirelyWinning = {
    init,
    restoreStableGrid,
    structureStudioWorkspace,
    mountTemplateRail,
    polishIntelPanel,
    markCvPreviewState,
  };
})(typeof window !== 'undefined' ? window : globalThis);
