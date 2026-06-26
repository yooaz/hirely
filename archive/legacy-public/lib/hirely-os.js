/**
 * Hirely OS — layout stabilization (grid mount, template rail, no logic changes).
 */
(function (global) {
  function mountTemplateRail() {
    const slot = document.getElementById('osTplSlot');
    const host = document.getElementById('templateButtons');
    if (!slot || !host || host.dataset.osRail === '1') return;
    slot.appendChild(host);
    host.dataset.osRail = '1';
    const label = document.createElement('span');
    label.className = 'toolbarLabel';
    label.textContent = 'Template';
    slot.insertBefore(label, host);
  }

  function stabilizeHero() {
    const hero = document.querySelector('.hero--compact');
    if (!hero || hero.dataset.osHero === '1') return;
    hero.dataset.osHero = '1';
    if (!hero.querySelector('.heroTrust')) {
      const trust = document.createElement('p');
      trust.className = 'heroTrust';
      trust.textContent =
        'Private drafts · Recruiter-grade scan · Publication-ready export';
      const actions = hero.querySelector('.actions');
      if (actions) actions.before(trust);
      else hero.appendChild(trust);
    }
  }

  function mountCenterStack() {
    if (document.getElementById('osCenter')) return;
    const preview = document.getElementById('workspacePreview');
    if (!preview?.parentNode) return;
    const center = document.createElement('div');
    center.id = 'osCenter';
    center.className = 'osCol osCol--center';
    preview.parentNode.insertBefore(center, preview);
    ['#profileRecBanner', '.tabRow', '.visionBar', '#proToolbar'].forEach((sel) => {
      const el = document.querySelector(sel);
      if (el && el.parentNode) center.appendChild(el);
    });
    center.appendChild(preview);
  }

  function patchLuxuryGallery() {
    const lux = global.HirelyLuxury;
    if (!lux?.renderTemplateGallery || lux._osPatched) return;
    const orig = lux.renderTemplateGallery;
    lux.renderTemplateGallery = function patchedGallery() {
      const out = orig.apply(this, arguments);
      mountTemplateRail();
      return out;
    };
    lux._osPatched = true;
  }

  function init() {
    const shell = document.querySelector('.productShell');
    if (shell) shell.classList.add('os-layout');
    stabilizeHero();
    mountCenterStack();
    if (global.HirelyLuxury?.setupVisionBar) {
      global.HirelyLuxury.setupVisionBar();
      mountCenterStack();
    }
    mountTemplateRail();
    patchLuxuryGallery();
    if (global.HirelyElite?.syncPreviewState) {
      global.HirelyElite.syncPreviewState();
    }
  }

  global.HirelyOS = { init, mountTemplateRail, mountCenterStack, stabilizeHero };
})(typeof window !== 'undefined' ? window : globalThis);
