/**
 * Hirely Elite Phase 2 — focus, trust, document luxury, transformation dopamine.
 */
(function (global) {
  const BEST_FOR = {
    ats: 'Corporate, operations, and strict ATS pipelines',
    swiss: 'Product, tech, and Swiss editorial roles',
    executive: 'C-suite, directors, and leadership hires',
    editorial: 'Art directors, editorial creatives, senior visual designers',
    portfolio: 'Designers and creatives with strong visual proof',
    luxury: 'Premium brands, fashion, and high-touch client roles',
    startup: 'Growth-stage operators and generalists',
    art: 'Art direction, campaigns, and studio leadership',
    minimal: 'Consultants and clarity-first professionals',
    modern: 'Cross-functional roles in modern companies',
    creative: 'Agencies, studios, and hybrid creative roles',
  };

  const TRANSFORM_PAIRS = [
    ['Generic summary', 'Strategic positioning'],
    ['Weak bullet list', 'Impact-driven achievement'],
    ['Buried client proof', 'Credibility above the fold'],
  ];

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
    );
  }

  function compactUploadPanel() {
    const band = document.querySelector('.uploadBand');
    if (!band || band.querySelector('.uploadAdvanced')) return;

    const toMove = [];
    band.querySelectorAll('.field').forEach((el) => {
      if (el.querySelector('#photo') || el.querySelector('#cvText')) toMove.push(el);
    });
    const grid = band.querySelector('.miniGrid');
    if (grid) toMove.push(grid);

    const actions = band.querySelector('.actions');
    let auxActions = null;
    if (actions) {
      auxActions = document.createElement('div');
      auxActions.className = 'actions actions--left actions--tight';
      actions.querySelectorAll('#sampleBtn, #improveBtn').forEach((btn) => auxActions.appendChild(btn));
    }

    const details = document.createElement('details');
    details.className = 'uploadAdvanced';
    details.innerHTML = '<summary>Advanced options</summary>';
    const body = document.createElement('div');
    body.className = 'uploadAdvanced__body';
    toMove.forEach((el) => body.appendChild(el));
    if (auxActions?.childElementCount) body.appendChild(auxActions);
    const retry = band.querySelector('#retryGenerate');
    if (retry) body.appendChild(retry);
    details.appendChild(body);

    const statusRow = band.querySelector('.statusRow');
    if (statusRow) band.insertBefore(details, statusRow);
    else band.appendChild(details);

    const gen = band.querySelector('#generateBtn');
    if (gen) gen.textContent = 'Transform application';
  }

  function ensureRecruiterQuote() {
    const panel = document.querySelector('.col-intel');
    if (!panel || document.getElementById('recruiterQuote')) return;
    const q = document.createElement('blockquote');
    q.id = 'recruiterQuote';
    q.className = 'recruiterQuote hidden';
    panel.appendChild(q);
  }

  function ensureHeatmapScanLine() {
    const hm = document.getElementById('cvHeatmap');
    if (!hm || hm.querySelector('.cvHeatmap__scan')) return;
    const scan = document.createElement('div');
    scan.className = 'cvHeatmap__scan';
    hm.appendChild(scan);
  }

  function enhanceTransformProof() {
    const panel = document.getElementById('transformProof');
    if (!panel || panel.querySelector('.transformProof__pairs')) return;
    const pairs = document.createElement('div');
    pairs.className = 'transformProof__pairs';
    pairs.innerHTML = TRANSFORM_PAIRS.map(
      ([b, a]) =>
        `<div class="transformProof__pair"><span>${escapeHtml(b)}</span><em>→</em><span>${escapeHtml(a)}</span></div>`
    ).join('');
    panel.appendChild(pairs);
  }

  function renderRecruiterQuote(d) {
    const el = document.getElementById('recruiterQuote');
    if (!el) return;
    const score = Math.round(d?.score || 0);
    if (score <= 0) {
      el.classList.add('hidden');
      return;
    }
    const quotes = [
      'Recruiters may struggle to identify your seniority immediately.',
      'Strong client credibility exists but appears too low.',
      'The first scan lacks immediate role clarity.',
      d.diagnosis?.recruiterView,
    ].filter(Boolean);
    let pick = quotes.find((q) => q && q.length > 20) || quotes[0];
    if (/ATS|parse|keyword/i.test(pick)) {
      pick = 'The first scan lacks immediate role clarity.';
    }
    el.textContent = pick.length > 140 ? pick.slice(0, 138) + '…' : pick;
    el.classList.remove('hidden');
  }

  function pulseTransformProof() {
    const panel = document.getElementById('transformProof');
    if (!panel) return;
    panel.classList.add('is-pulse', 'hp-reveal');
    setTimeout(() => panel.classList.remove('is-pulse'), 900);
  }

  function revealIntelPanel() {
    const intel = document.querySelector('.col-intel');
    if (!intel) return;
    intel.classList.remove('hp-reveal');
    void intel.offsetWidth;
    intel.classList.add('hp-reveal');
  }

  function patchLuxuryTemplates() {
    const lux = global.HirelyLuxury;
    if (!lux?.renderTemplateGallery || lux._elite2Tpl) return;
    const orig = lux.renderTemplateGallery;
    lux.renderTemplateGallery = function (templates, current, rec, onSelect) {
      if (!document.documentElement.classList.contains('stable-mode')) {
        return orig.apply(this, arguments);
      }
      const host = document.getElementById('templateButtons');
      if (!host) return;
      const TPL_META = lux.TPL_META || {};
      const POSITIONING = global.HirelyPremium?.POSITIONING || {};
      host.className = 'templateGallery';
      host.innerHTML = templates
        .map(([id, name]) => {
          const meta = TPL_META[id] || TPL_META.ats;
          const active = id === current ? ' active' : '';
          const recCls = id === rec ? ' templateCard--rec' : '';
          const prevCls =
            id === 'portfolio' || id === 'art'
              ? 'tplPreview--sidebar'
              : id === 'luxury' || id === 'executive'
                ? 'tplPreview--luxury'
                : '';
          return `<button type="button" class="templateCard${active}${recCls}" data-template="${id}" aria-pressed="${id === current}">
            <div class="tplCardPreview tplPreview ${prevCls}" data-tpl="${id}"></div>
            <div class="tplCardBody">
              <strong>${escapeHtml(name)}</strong>
              <span class="tplCardPositioning">${escapeHtml(POSITIONING[id] || meta.fit)}</span>
              <div class="tplCardMeta">
                <span>ATS ${meta.ats}</span>
                <span>Creative ${meta.creative || '—'}</span>
                <span>${escapeHtml(meta.fit)} fit</span>
              </div>
              <span class="tplCardBest"><b>Best for</b>${escapeHtml(BEST_FOR[id] || 'Professional applications')}</span>
            </div>
          </button>`;
        })
        .join('');
      host.querySelectorAll('.templateCard').forEach((card) => {
        card.onclick = () => onSelect(card.dataset.template);
      });
    };
    lux._elite2Tpl = true;
  }

  function patchPremiumPhase() {
    const prem = global.HirelyPremium;
    if (!prem?.setPhase || prem._elite2Phase) return;
    const orig = prem.setPhase;
    prem.setPhase = function (phase) {
      orig.call(this, phase);
      document.querySelector('.col-preview')?.classList.toggle(
        'hp-doc-focus',
        phase === 'preview' || phase === 'export'
      );
    };
    prem._elite2Phase = true;
  }

  function patchRenderCVPulse() {
    const orig = global.renderCV;
    if (!orig || orig._elite2Cv) return;
    global.renderCV = function (d, opts) {
      const out = orig.apply(this, arguments);
      const paper = document.getElementById('cvPaper');
      const has =
        paper &&
        !paper.querySelector('.cvEmpty') &&
        (paper.innerText || '').trim().length > 8;
      if (has) {
        pulseTransformProof();
        document.getElementById('transformProof')?.classList.add('hp-reveal');
      }
      return out;
    };
    global.renderCV._elite2Cv = true;
  }

  function patchIntelRender() {
    const exp = global.HirelyExperience;
    if (exp?.renderRecruiterReadiness && !exp._elite2Intel) {
      const orig = exp.renderRecruiterReadiness;
      exp.renderRecruiterReadiness = function (d) {
        orig.call(this, d);
        renderRecruiterQuote(d);
        if (Math.round(d?.score || 0) > 0) revealIntelPanel();
      };
      exp._elite2Intel = true;
    }
    const origScores = global.renderScores;
    if (origScores && !origScores._elite2) {
      global.renderScores = function (d) {
        origScores.apply(this, arguments);
        renderRecruiterQuote(d);
        if (Math.round(d?.score || 0) > 0) revealIntelPanel();
      };
      global.renderScores._elite2 = true;
    }
  }

  function patchFileUpload() {
    const file = document.getElementById('file');
    if (!file || file.dataset.elite2) return;
    file.addEventListener('change', () => {
      setTimeout(() => {
        global.HirelyPremium?.setPhase?.('analyze');
        global.HirelyFlow?.setTransformStep?.('analyze');
      }, 400);
    });
    file.dataset.elite2 = '1';
  }

  function init() {
    compactUploadPanel();
    ensureRecruiterQuote();
    ensureHeatmapScanLine();
    enhanceTransformProof();
    patchLuxuryTemplates();
    patchPremiumPhase();
    patchRenderCVPulse();
    patchIntelRender();
    patchFileUpload();
    if (global.renderTemplateButtons) global.renderTemplateButtons();
    if (global.lastData) renderRecruiterQuote(global.lastData);
  }

  global.HirelyElitePhase2 = { init, BEST_FOR, renderRecruiterQuote, compactUploadPanel };
})(typeof window !== 'undefined' ? window : globalThis);
