/**
 * Hirely Stable — layout foundation only. No effects, no DOM experiments.
 */
(function (global) {
  function teardownChaos() {
    document.documentElement.classList.add('stable-mode');
    document.body.classList.add('stable-mode');

    document.querySelectorAll('.bgBlob').forEach((el) => el.remove());

    document.getElementById('intelCompanion')?.remove();
    document.querySelector('.workspaceLayout')?.remove();

    document.querySelectorAll('.visionBar, .cvVisionOverlay').forEach((el) => el.remove());

    const overlay = document.getElementById('cvVisionOverlay');
    if (overlay) overlay.remove();

    const page = document.getElementById('cvPreview');
    if (page) {
      page.style.transform = '';
      const wrap = page.closest('.cvVisionWrap');
      if (wrap && wrap.parentNode) {
        wrap.parentNode.insertBefore(page, wrap);
        wrap.remove();
      }
    }

    const center = document.getElementById('osCenter');
    if (center?.parentNode) {
      const parent = center.parentNode;
      while (center.firstChild) parent.insertBefore(center.firstChild, center);
      center.remove();
    }

    document.querySelectorAll('.canvasControls').forEach((el) => el.remove());
    const stage = document.getElementById('cvStage');
    if (stage) {
      stage.classList.remove('is-editing', 'is-focused');
      stage.style.transform = '';
    }
    const canvas = document.querySelector('.cvCanvas');
    if (canvas) canvas.style.transform = '';

    document.querySelector('.productShell')?.classList.remove('os-layout');
    document.querySelector('.productShell')?.classList.add('stable-layout');
  }

  function mountTemplatesBand() {
    if (document.getElementById('templatePicker') || document.documentElement.classList.contains('layout-stacked')) {
      global.ensureTemplateButtonsHost?.();
      return;
    }
    const band = document.getElementById('templatesBand');
    const host = document.getElementById('templateButtons');
    const slot = document.getElementById('templatesSlot');
    if (!band || !host || !slot) return;
    if (host.parentElement !== slot) slot.appendChild(host);
    host.className = 'templateGallery';
    host.dataset.stableMounted = '1';
    band.hidden = false;
  }

  function patchTemplateGallery() {
    const lux = global.HirelyLuxury;
    if (!lux?.renderTemplateGallery || lux._stableTplPatched) return;
    const orig = lux.renderTemplateGallery;
    lux.renderTemplateGallery = function stableTplGallery() {
      const out = orig.apply(this, arguments);
      mountTemplatesBand();
      return out;
    };
    lux._stableTplPatched = true;
  }

  function patchModules() {
    if (global.HirelyLuxury) {
      global.HirelyLuxury.setupVisionBar = function () {};
      const origVision = global.HirelyLuxury.toggleVisionMode;
      if (origVision) {
        global.HirelyLuxury.toggleVisionMode = function () {
          return false;
        };
      }
    }
    if (global.HirelyElite) {
      global.HirelyElite.mountCinemaLayout = function () {};
      global.HirelyElite.bindPreviewParallax = function () {};
    }
    if (global.HirelyOS) {
      global.HirelyOS.init = function () {};
    }
  }

  function init() {
    teardownChaos();
    patchModules();
    patchTemplateGallery();
    mountTemplatesBand();
    if (global.HirelyElite?.syncPreviewState) global.HirelyElite.syncPreviewState();
  }

  global.HirelyStable = { init, teardownChaos, mountTemplatesBand };
})(typeof window !== 'undefined' ? window : globalThis);
