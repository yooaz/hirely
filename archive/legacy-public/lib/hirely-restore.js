/**
 * Hirely Restore — revert failed minimalism, restore dense recruiter-grade UI.
 */
(function (global) {
  function restoreUploadPanel() {
    const band = document.querySelector('.uploadBand');
    const details = band?.querySelector('.uploadAdvanced');
    if (!details) return;
    const body = details.querySelector('.uploadAdvanced__body');
    if (body) {
      while (body.firstChild) {
        const status = band.querySelector('.statusRow');
        if (status) band.insertBefore(body.firstChild, status);
        else band.appendChild(body.firstChild);
      }
    }
    details.remove();
    const gen = document.getElementById('generateBtn');
    if (gen) gen.textContent = 'Generate Pro CV';
  }

  function restoreHero() {
    const hero = document.querySelector('.hero--compact');
    if (!hero) return;
    const kicker = hero.querySelector('.kicker');
    if (kicker) {
      kicker.innerHTML = '<span class="dot"></span> CV · LinkedIn · ATS · Beautiful PDF';
    }
    const h1 = hero.querySelector('h1');
    if (h1) {
      h1.innerHTML = 'Fix your CV.<br><span class="grad">Get more interviews.</span>';
    }
    const lead = hero.querySelector('.heroLead');
    if (lead) {
      lead.textContent =
        'Upload, review and generate a professional CV with recruiter-grade feedback, editable templates and premium PDF export.';
    }
    const trust = hero.querySelector('.heroTrust');
    if (trust) trust.textContent = 'Recruiter-grade scoring · ATS-safe templates · Beautiful A4 PDF';
    const actions = hero.querySelector('.actions');
    if (actions && !actions.querySelector('.btn.ghost')) {
      const ghost = document.createElement('a');
      ghost.className = 'btn ghost';
      ghost.href = '#pricing';
      ghost.textContent = 'See Pro';
      actions.appendChild(ghost);
    }
    const primary = hero.querySelector('.actions .btn.blue');
    if (primary) {
      primary.textContent = 'Analyze my CV';
      primary.href = '#workspaceGridRoot';
    }
    const sectionHead = document.querySelector('.prepSection .sectionHead');
    if (sectionHead) {
      sectionHead.classList.remove('hidden');
      const h2 = sectionHead.querySelector('h2');
      const p = sectionHead.querySelector('.small');
      if (h2) h2.textContent = 'Upload, review, then generate';
      if (p) p.textContent = 'Import your CV, see recruiter intelligence, then transform your document.';
    }
    const uploadH2 = document.querySelector('.uploadBand .cardHead h2');
    if (uploadH2) uploadH2.textContent = 'Input';
    const previewH2 = document.querySelector('.previewChrome .workspaceHead h2');
    if (previewH2) previewH2.textContent = 'Professional output';
    const intelH2 = document.querySelector('.col-intel .cardHead h2');
    if (intelH2) intelH2.textContent = 'Recruiter read';
    const verdict = document.getElementById('verdict');
    const summary = document.getElementById('summary');
    if (document.documentElement.classList.contains('classic-layout')) {
      verdict?.removeAttribute('hidden');
      summary?.removeAttribute('hidden');
    }
  }

  function showIntelDensity() {
    ['bars', 'insightGrid'].forEach((id) => {
      const el = document.getElementById(id);
      if (el) el.removeAttribute('hidden');
    });
    const actions = document.getElementById('intelActions');
    const summary = document.getElementById('intelSummary');
    const fixLabel = actions?.querySelector('.intelLabel');
    if (fixLabel) fixLabel.textContent = 'What to improve first';
  }

  function patchPhaseNoHide() {
    const prem = global.HirelyPremium;
    if (!prem?.setPhase || prem._restorePhase) return;
    const orig = prem.setPhase;
    prem.setPhase = function (phase) {
      document.documentElement.dataset.hpPhase = phase;
      document.body.dataset.hpPhase = phase;
    };
    prem._restorePhase = true;
  }

  function patchRenderScores() {
    const orig = global.renderScores;
    if (!orig || orig._restoreScores) return;
    global.renderScores = function (d) {
      orig.apply(this, arguments);
      const score = Math.round(d?.score || 0);
      if (score > 0) {
        showIntelDensity();
        const summary = document.getElementById('intelSummary');
        const actions = document.getElementById('intelActions');
        summary?.classList.remove('hidden');
        actions?.classList.remove('hidden');
        const label = document.querySelector('.col-intel .scoreLabel');
        if (label) label.textContent = 'Recruiter-grade score';
      }
    };
    global.renderScores._restoreScores = true;
  }

  function patchExperience() {
    const exp = global.HirelyExperience;
    if (!exp?.renderRecruiterReadiness || exp._restoreExp) return;
    const orig = exp.renderRecruiterReadiness;
    exp.renderRecruiterReadiness = function (d) {
      orig.call(this, d);
      if (Math.round(d?.score || 0) > 0) showIntelDensity();
    };
    exp._restoreExp = true;
  }

  function patchPremiumHero() {
    const prem = global.HirelyPremium;
    if (!prem || prem._restoreHero) return;
    const orig = prem.applyBrandCopy;
    if (orig) {
      prem.applyBrandCopy = function () {
        orig.call(this);
        restoreHero();
      };
    }
    prem._restoreHero = true;
  }

  function ensureTemplateCards() {
    if (!global.renderTemplateButtons) return;
    global.ensureTemplateButtonsHost?.();
    if (document.getElementById('templatePicker')) {
      global.renderTemplateButtons();
      return;
    }
    if (
      document.documentElement.classList.contains('winning-layout') ||
      document.documentElement.classList.contains('classic-layout')
    ) {
      global.HirelyWinning?.mountTemplateToolbar?.() ||
        global.HirelyClassic?.mountToolbarTemplates?.();
      global.renderTemplateButtons();
      return;
    }
    const slot = document.getElementById('templatesSlot');
    const host = document.getElementById('templateButtons');
    if (slot && host && host.parentElement !== slot) {
      slot.appendChild(host);
      host.className = 'templateGallery';
    }
    global.renderTemplateButtons();
    document.querySelectorAll('#proToolbar .chip').forEach((el) => el.remove());
  }

  function reorderIntelPanel() {
    const panel = document.querySelector('.col-intel');
    const head = panel?.querySelector('.cardHead');
    const score = document.getElementById('scoreBlock');
    const verdict = document.getElementById('verdict');
    const summary = document.getElementById('summary');
    const bars = document.getElementById('bars');
    const grid = panel?.querySelector('.insightGrid');
    const intelSummary = document.getElementById('intelSummary');
    const heat = document.getElementById('recruiterHeatmap');
    const hint = document.getElementById('heatmapInsight');
    const fixes = document.getElementById('intelActions');
    if (!panel || !head || !score || panel.dataset.reordered) return;
    const hero = score.querySelector('.scoreHero');
    if (hero && verdict && summary) {
      let detail = score.querySelector('.scoreDetail');
      if (!detail) {
        detail = document.createElement('div');
        detail.className = 'scoreDetail';
        hero.after(detail);
      }
      if (verdict.parentElement !== detail) detail.appendChild(verdict);
      if (summary.parentElement !== detail) detail.appendChild(summary);
      if (bars && bars.parentElement !== detail) detail.appendChild(bars);
      if (grid && grid.parentElement !== detail) detail.appendChild(grid);
    }
    head.after(score);
    if (bars && !score.contains(bars)) score.after(bars);
    if (grid && !score.contains(grid)) (bars || score).after(grid);
    if (intelSummary && !score.contains(intelSummary)) (grid || bars || score).after(intelSummary);
    if (heat && intelSummary) intelSummary.after(heat);
    else if (heat) (intelSummary || grid || score).after(heat);
    if (hint) (heat || intelSummary || grid).after(hint);
    if (fixes) panel.appendChild(fixes);
    panel.dataset.reordered = '1';
  }

  function showIntelOnLoad() {
    const actions = document.getElementById('intelActions');
    const summary = document.getElementById('intelSummary');
    actions?.classList.remove('hidden');
    summary?.classList.remove('hidden');
  }

  function init() {
    restoreUploadPanel();
    restoreHero();
    showIntelDensity();
    showIntelOnLoad();
    reorderIntelPanel();
    patchPhaseNoHide();
    patchPremiumHero();
    patchRenderScores();
    patchExperience();
    document.documentElement.dataset.hpPhase = 'analyze';
    if (global.HirelyStable?.mountTemplatesBand) global.HirelyStable.mountTemplatesBand();
    ensureTemplateCards();
    if (global.lastData && Math.round(global.lastData.score || 0) > 0) {
      showIntelDensity();
    }
    requestAnimationFrame(() => {
      restoreHero();
      ensureTemplateCards();
    });
  }

  global.HirelyRestore = {
    init,
    restoreHero,
    showIntelDensity,
    restoreUploadPanel,
    ensureTemplateCards,
    reorderIntelPanel,
  };
})(typeof window !== 'undefined' ? window : globalThis);
