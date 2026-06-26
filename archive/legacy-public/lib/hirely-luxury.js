/**
 * Hirely Luxury — recruiter simulation, vision mode, template gallery (UI only).
 */
(function (global) {
  const TPL_META = {
    ats: { ats: 'High', fit: 'Corporate', lux: 'Essential', creative: 'Low', exec: 'High' },
    swiss: { ats: 'High', fit: 'Tech', lux: 'Refined', creative: 'Med', exec: 'Med' },
    executive: { ats: 'Med', fit: 'Leadership', lux: 'Premium', creative: 'Low', exec: 'High' },
    editorial: { ats: 'Med', fit: 'Creative', lux: 'High', creative: 'High', exec: 'Med' },
    portfolio: { ats: 'Med', fit: 'Design', lux: 'High', creative: 'High', exec: 'Low' },
    luxury: { ats: 'Med', fit: 'Premium', lux: 'Elite', creative: 'Med', exec: 'High' },
    startup: { ats: 'High', fit: 'Growth', lux: 'Clean', creative: 'Med', exec: 'Med' },
    art: { ats: 'Low', fit: 'Art direction', lux: 'Bold', creative: 'High', exec: 'Med' },
  };

  function scanTimeEstimate(score) {
    const s = Math.round(score || 0);
    if (s >= 80) return '5–7 sec';
    if (s >= 65) return '7–9 sec';
    if (s > 0) return '9–12 sec';
    return '—';
  }

  function hierarchyScore(d) {
    const r = Math.round(d.readabilityScore || 0);
    const a = Math.round(d.atsScore || 0);
    return Math.round(r * 0.55 + a * 0.45);
  }

  function credibilityScore(d) {
    return Math.round(d.recruiterScore || 0);
  }

  function proofScore(d) {
    return Math.round(d.impactScore || 0);
  }

  function strongestAchievement(text) {
    const cv = (text || '').trim();
    if (!cv) return 'Add measurable outcomes and client names near the top.';
    const brands =
      cv.match(
        /\b(Nike|Adobe|Marvel|Louis Vuitton|Google|Apple|McCann|Fortune|Pantone|Arte|Cadillac|Converse)\b/gi
      ) || [];
    if (brands.length) return `Recognized proof: ${[...new Set(brands.map((b) => b))].slice(0, 3).join(', ')}.`;
    const metrics = cv.match(/\d+%|\d+\+|\€|\$|million|k\b/gi);
    if (metrics?.length) return 'Quantified results detected — elevate them above the fold.';
    const exp = cv.match(/experience|freelance|director|lead/gi);
    if (exp?.length) return 'Experience narrative present — sharpen the headline role match.';
    return 'Lead with your strongest role and one proof line in the top third.';
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
    );
  }

  function renderRecruiterSimulation(d) {
    const panel = document.getElementById('recruiterSim');
    if (!panel) return;
    const score = Math.round(d.score || 0);
    if (score <= 0) {
      panel.innerHTML = '';
      panel.classList.add('hidden');
      return;
    }
    panel.classList.remove('hidden');
    const cv = document.getElementById('cvText')?.value || '';
    const items = [
      { label: 'Scan window', val: scanTimeEstimate(score), pct: Math.min(100, score) },
      { label: 'Hierarchy', val: hierarchyScore(d), pct: hierarchyScore(d) },
      { label: 'ATS readability', val: Math.round(d.atsScore || 0), pct: Math.round(d.atsScore || 0) },
      { label: 'Credibility', val: credibilityScore(d), pct: credibilityScore(d) },
      { label: 'Proof of impact', val: proofScore(d), pct: proofScore(d) },
    ];
    panel.innerHTML =
      items
        .map(
          (it) => `<li>
        <span class="simLabel">${it.label}</span>
        <span class="simVal">${typeof it.val === 'string' ? it.val : it.val + '/100'}</span>
        <div class="simBar"><i data-w="${it.pct}" style="width:0%"></i></div>
      </li>`
        )
        .join('') +
      `<li style="grid-template-columns:1fr"><span class="simLabel">Strongest signal</span><span style="color:#c4c9d4;font-size:12px;line-height:1.45">${escapeHtml(
        strongestAchievement(cv)
      )}</span></li>`;
    requestAnimationFrame(() => {
      panel.querySelectorAll('.simBar i').forEach((bar) => {
        bar.style.width = (bar.getAttribute('data-w') || '0') + '%';
      });
    });
    document.getElementById('scoreBlock')?.classList.add('scoreBlock--sim');
    const label = document.querySelector('.scoreLabel');
    if (label) label.textContent = 'Recruiter simulation';
  }

  let visionOn = false;

  function ensureVisionOverlay() {
    const preview = document.getElementById('cvPreview');
    if (!preview || preview.closest('.cvVisionWrap')) return;
    const wrap = document.createElement('div');
    wrap.className = 'cvVisionWrap';
    preview.parentNode.insertBefore(wrap, preview);
    wrap.appendChild(preview);
    const overlay = document.createElement('div');
    overlay.className = 'cvVisionOverlay';
    overlay.id = 'cvVisionOverlay';
        overlay.innerHTML =
      '<div class="cvVisionZone cvVisionZone--hot" aria-hidden="true"></div>' +
      '<div class="cvVisionZone cvVisionZone--warm" aria-hidden="true"></div>' +
      '<div class="cvVisionZone cvVisionZone--cold" aria-hidden="true"></div>' +
      '<span class="cvVisionFlow">Scan path · 7s</span>';
    wrap.appendChild(overlay);
  }

  function toggleVisionMode(force) {
    visionOn = typeof force === 'boolean' ? force : !visionOn;
    ensureVisionOverlay();
    document.getElementById('cvVisionOverlay')?.classList.toggle('is-visible', visionOn);
    const btn = document.getElementById('visionToggle');
    btn?.classList.toggle('is-on', visionOn);
    btn?.setAttribute('aria-pressed', visionOn ? 'true' : 'false');
  }

  function tplPreviewClass(id, layout) {
    if (layout === 'sidebar' || id === 'portfolio' || id === 'art' || id === 'startup' || id === 'swiss')
      return 'tplPreview--sidebar';
    if (id === 'luxury' || id === 'executive') return 'tplPreview--luxury';
    if (id === 'editorial') return 'tplPreview--editorial';
    return '';
  }

  function renderTemplateGallery(templates, currentTemplate, recommendedTemplate, onSelect) {
    const host = document.getElementById('templateButtons');
    if (!host) return;
    host.className = document.documentElement.classList.contains('studio-mode')
      ? 'templateGallery templateGallery--studio'
      : document.documentElement.classList.contains('winning-layout')
        ? 'templateGallery templateGallery--winning'
        : 'templateGallery';
    host.innerHTML = templates
      .map(([id, name]) => {
        const meta = TPL_META[id] || TPL_META.ats;
        const layout = global.getTpl?.(id)?.layout || 'stack';
        const prevCls = tplPreviewClass(id, layout);
        const active = id === currentTemplate ? ' active' : '';
        const rec = id === recommendedTemplate ? ' templateCard--rec' : '';
        const fitCls = meta.exec === 'High' ? ' tplTag--exec' : '';
        const premiumCard =
          document.documentElement.classList.contains('stable-mode') ||
          document.documentElement.classList.contains('winning-layout');
        if (premiumCard) {
          return `<button type="button" class="templateCard${active}${rec}" data-template="${id}" aria-pressed="${id === currentTemplate}">
          <div class="tplCardPreview tplPreview ${prevCls}" data-tpl="${id}" aria-hidden="true"></div>
          <div class="tplCardBody">
            <strong>${escapeHtml(name)}</strong>
            <div class="tplCardMeta"><span>ATS ${meta.ats}</span><span>Creative ${meta.creative}</span><span>${escapeHtml(meta.fit)}</span></div>
          </div>
        </button>`;
        }
        return `<button type="button" class="templateCard${active}${rec}" data-template="${id}" aria-pressed="${id === currentTemplate}">
          <div class="tplPreview ${prevCls}" aria-hidden="true"></div>
          <div class="tplCardBody">
            <strong>${escapeHtml(name)}</strong>
            <div class="tplMeta">
              <span class="tplTag tplTag--ats">ATS ${meta.ats}</span>
              <span class="tplTag${fitCls}">${escapeHtml(meta.fit)}</span>
              <span class="tplTag">Creative ${meta.creative || '—'}</span>
              <span class="tplTag">Exec ${meta.exec || '—'}</span>
              <span class="tplTag tplTag--lux">Lux ${meta.lux || '—'}</span>
            </div>
          </div>
        </button>`;
      })
      .join('');
    host.querySelectorAll('.templateCard').forEach((card) => {
      card.onclick = () => onSelect(card.dataset.template);
    });
  }

  function markTransforming(on) {
    document.querySelector('.productShell')?.classList.toggle('is-transforming', !!on);
  }

  function pulseScoreEvolve() {
    const block = document.getElementById('scoreBlock');
    if (!block) return;
    block.classList.add('score-evolve');
    setTimeout(() => block.classList.remove('score-evolve'), 1300);
  }

  function focusWorkspace() {
    const stage = document.getElementById('cvStage');
    stage?.classList.add('is-focused');
    setTimeout(() => stage?.classList.remove('is-focused'), 2400);
  }

  function setupVisionBar() {
    if (document.getElementById('visionToggle')) return;
    const toolbar = document.getElementById('proToolbar');
    if (!toolbar) return;
    const bar = document.createElement('div');
    bar.className = 'visionBar';
    bar.innerHTML = `<button type="button" class="visionToggle" id="visionToggle" aria-pressed="false">Recruiter vision</button>
      <div class="visionLegend"><span class="leg-hot">Hot zone</span><span class="leg-warm">Skimmed</span><span class="leg-cool">Often skipped</span></div>`;
    toolbar.parentNode.insertBefore(bar, toolbar);
    document.getElementById('visionToggle')?.addEventListener('click', () => toggleVisionMode());
  }

  global.HirelyLuxury = {
    TPL_META,
    renderRecruiterSimulation,
    renderTemplateGallery,
    toggleVisionMode,
    markTransforming,
    pulseScoreEvolve,
    focusWorkspace,
    setupVisionBar,
  };
})(typeof window !== 'undefined' ? window : globalThis);
