/**
 * Hirely Experience — transformation narrative, readiness, live feedback (UI only).
 */
(function (global) {
  const PHASES = ['before', 'analysis', 'transform', 'result'];
  let canvasZoom = 1;
  let liveTimer = null;

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
    );
  }

  function setNarrativePhase(phase) {
    if (!PHASES.includes(phase)) return;
    document.querySelectorAll('.narrativeStep').forEach((el) => {
      const p = el.dataset.phase;
      el.classList.toggle('is-active', p === phase);
      const i = PHASES.indexOf(p);
      const ci = PHASES.indexOf(phase);
      el.classList.toggle('is-done', i >= 0 && ci >= 0 && i < ci);
    });
  }

  function readinessDimensions(d, cvText) {
    const cv = (cvText || '').trim();
    const score = Math.round(d.score || 0);
    const firstImpression = Math.round((d.recruiterScore || 0) * 0.6 + (d.readabilityScore || 0) * 0.4);
    const roleClarity = /target|seeking|profile|designer|manager|engineer|director/i.test(cv)
      ? Math.min(92, 58 + (d.atsScore || 0) * 0.35)
      : Math.max(40, Math.round((d.atsScore || 0) * 0.7));
    const proofDensity = Math.round(d.impactScore || 0);
    const atsSafety = Math.round(d.atsScore || 0);
    const credibility = Math.round(d.recruiterScore || 0);
    const positioning = Math.round(score * 0.85 + (d.linkedinScore || 0) * 0.15);

    const insight = (key, val) => {
      const maps = {
        firstImpression:
          val >= 76
            ? 'Your opening scan reads confident — role and proof appear early.'
            : 'Recruiters may not grasp your level in the first pass — tighten the headline block.',
        roleClarity:
          val >= 76
            ? 'Target role and seniority read clearly within seconds.'
            : 'Role signal is diffuse — align title, summary and first experience line.',
        proofDensity:
          val >= 76
            ? 'Evidence density supports credibility — metrics and names land well.'
            : 'Proof is thin — add outcomes, clients or scale near the top third.',
        atsSafety:
          val >= 76
            ? 'Structure parses cleanly for ATS and human skim paths.'
            : 'Parsing risk — simplify layout noise and standard section labels.',
        credibility:
          val >= 76
            ? 'Trajectory and brands signal trust at a senior glance.'
            : 'Credibility gap — surface recognizable proof earlier.',
        positioning:
          val >= 76
            ? 'Positioning feels deliberate — you read as hire-ready for the target lane.'
            : 'Positioning reads generic — sharpen who you are and why now.',
      };
      return maps[key] || '';
    };

    return [
      { label: 'First impression', val: firstImpression, insight: insight('firstImpression', firstImpression) },
      { label: 'Role clarity', val: Math.round(roleClarity), insight: insight('roleClarity', roleClarity) },
      { label: 'Proof density', val: proofDensity, insight: insight('proofDensity', proofDensity) },
      { label: 'ATS safety', val: atsSafety, insight: insight('atsSafety', atsSafety) },
      { label: 'Credibility', val: credibility, insight: insight('credibility', credibility) },
      { label: 'Positioning strength', val: positioning, insight: insight('positioning', positioning) },
    ];
  }

  function pickPrimaryInsight(d, dims) {
    const view = String(d.diagnosis?.recruiterView || '').trim();
    if (view.length > 24) return view;
    const verdict = String(d.verdict || '').trim();
    if (verdict.length > 12) return verdict;
    const weakest = [...dims].sort((a, b) => a.val - b.val)[0];
    return weakest?.insight || 'Upload a CV to receive your recruiter intelligence summary.';
  }

  function pickSecondaryInsights(dims, primary, max = 3) {
    const seen = new Set([primary]);
    const out = [];
    [...dims]
      .sort((a, b) => a.val - b.val)
      .forEach((x) => {
        if (out.length >= max) return;
        if (!x.insight || seen.has(x.insight)) return;
        seen.add(x.insight);
        out.push({ label: x.label, text: x.insight });
      });
    return out;
  }

  function renderRecruiterReadiness(d) {
    const score = Math.round(d.score || 0);
    const summary = document.getElementById('intelSummary');
    const primaryEl = document.getElementById('primaryInsight');
    const secondaryEl = document.getElementById('intelSecondary');
    const actionsWrap = document.getElementById('intelActions');
    const legacyGrid = document.getElementById('readinessGrid');

    if (!summary || !primaryEl) {
      if (legacyGrid) legacyGrid.classList.add('hidden');
      return;
    }

    if (score <= 0) {
      summary.classList.add('hidden');
      secondaryEl?.classList.add('hidden');
      actionsWrap?.classList.add('hidden');
      if (legacyGrid) {
        legacyGrid.innerHTML = '';
        legacyGrid.classList.add('hidden');
      }
      return;
    }

    setNarrativePhase('analysis');
    const cv = document.getElementById('cvText')?.value || '';
    const dims = readinessDimensions(d, cv);
    const primary = pickPrimaryInsight(d, dims);

    primaryEl.textContent = primary;
    summary.classList.remove('hidden');

    if (secondaryEl) {
      const items = pickSecondaryInsights(dims, primary, 3);
      if (items.length) {
        secondaryEl.innerHTML = items
          .map(
            (x) =>
              `<li><span>${escapeHtml(x.label)}</span><p>${escapeHtml(x.text)}</p></li>`
          )
          .join('');
        secondaryEl.classList.remove('hidden');
      } else {
        secondaryEl.innerHTML = '';
        secondaryEl.classList.add('hidden');
      }
    }

    if (actionsWrap) actionsWrap.classList.remove('hidden');
    renderTopFixes(d, 3);

    if (legacyGrid) {
      legacyGrid.innerHTML = '';
      legacyGrid.classList.add('hidden');
    }

    const label = document.querySelector('.scoreLabel');
    if (label) label.textContent = 'Readiness';
    document.querySelector('.scorePanel')?.classList.remove('is-scanning');
    updateCompanion(d);
  }

  function renderTopFixes(d, max = 3) {
    const list = document.getElementById('fixList');
    if (!list) return;
    const fixes = (d.topFixes || []).slice(0, max);
    if (!fixes.length) return;
    list.innerHTML = fixes.map((f) => `<li>${escapeHtml(f)}</li>`).join('');
  }

  function clip(s, n = 120) {
    const t = String(s || '').replace(/\s+/g, ' ').trim();
    return t.length > n ? t.slice(0, n) + '…' : t;
  }

  function renderTransformationCompare(beforeText, afterDraft) {
    const panel = document.getElementById('transformPanel');
    if (!panel) return;
    const before = clip(beforeText, 140) || 'Unfocused summary and buried proof.';
    const summary = afterDraft?.summary || afterDraft?.title || '';
    const after =
      clip(summary, 140) ||
      'Sharper positioning with recruiter-readable hierarchy and impact-led proof.';
    panel.classList.remove('hidden');
    panel.innerHTML = `<h4>Positioning shift</h4>
      <div class="transformCompare">
        <div class="transformCol transformCol--before"><div class="tcLabel">Before</div><p>${escapeHtml(before)}</p></div>
        <div class="transformArrow" aria-hidden="true">→</div>
        <div class="transformCol transformCol--after"><div class="tcLabel">After</div><p>${escapeHtml(after)}</p></div>
      </div>`;
    setNarrativePhase('transform');
  }

  function updateCompanion(d) {
    const score = Math.round(d?.score || 0);
    const tpl = global.currentTemplate || 'ats';
    const tplName = global.getTpl?.(tpl)?.name || tpl;
    const set = (id, val) => {
      const el = document.getElementById(id);
      if (el) el.textContent = val;
    };
    set('intelScore', score > 0 ? String(score) : '—');
    set('intelTemplate', tplName);
    const progress = score > 0 ? Math.min(100, score + (global.appState?.hasGeneratedCV ? 12 : 0)) : 0;
    const bar = document.querySelector('#intelProgress i');
    if (bar) bar.style.width = progress + '%';
    set('intelProgressLabel', progress > 0 ? progress + '% transformation' : 'Awaiting scan');
    const exportReady = global.appState?.hasGeneratedCV && global.isPro?.();
    set('intelExport', exportReady ? 'Ready' : global.appState?.hasGeneratedCV ? 'Pro to export' : 'Generate first');
    const tip = document.getElementById('intelTipText');
    if (tip) {
      if (score >= 78) tip.textContent = 'Profile reads hire-ready. Refine template and export when aligned.';
      else if (score >= 60) tip.textContent = 'Solid base — elevate proof density and role clarity in the top third.';
      else if (score > 0) tip.textContent = 'Recruiters may pass early — rebuild hierarchy before exporting.';
      else tip.textContent = 'Drop your resume to simulate a real recruiter scan.';
    }
  }

  function setupCompanion() {
    if (document.getElementById('intelCompanion')) return;
    const workspace = document.querySelector('.workspace');
    if (!workspace || workspace.querySelector('.workspaceLayout')) return;
    const head = workspace.querySelector('.workspaceHead');
    const tabs = workspace.querySelector('.tabRow');
    const panels = [...workspace.querySelectorAll('.panel')];
    const layout = document.createElement('div');
    layout.className = 'workspaceLayout';
    const main = document.createElement('div');
    main.className = 'workspaceMain';
    if (head) main.appendChild(head);
    if (tabs) main.appendChild(tabs);
    const panelWrap = document.createElement('div');
    panelWrap.className = 'workspacePanels';
    panels.forEach((p) => panelWrap.appendChild(p));
    main.appendChild(panelWrap);
    const aside = document.createElement('aside');
    aside.className = 'intelCompanion';
    aside.id = 'intelCompanion';
    aside.innerHTML = `<h3>Recruiter companion</h3>
      <div class="intelStat"><span>Readiness</span><b id="intelScore">—</b></div>
      <div class="intelStat"><span>Template</span><b id="intelTemplate">—</b></div>
      <div class="intelProgress" id="intelProgress"><i style="width:0%"></i></div>
      <p class="small" id="intelProgressLabel" style="margin:0;font-size:11px;color:var(--muted)">Awaiting scan</p>
      <div class="intelStat" style="margin-top:10px"><span>Export</span><b id="intelExport">—</b></div>
      <div class="intelTip"><strong>Strategic note</strong><span id="intelTipText">Drop your resume to simulate a real recruiter scan.</span></div>`;
    layout.appendChild(main);
    layout.appendChild(aside);
    workspace.appendChild(layout);
    const pw = workspace.querySelector('.workspacePanels');
    if (pw && pw.tagName === 'MOTION') {
      const d = document.createElement('div');
      d.className = 'workspacePanels';
      while (pw.firstChild) d.appendChild(pw.firstChild);
      pw.replaceWith(d);
    }
  }

  function setupCanvasControls() {
    const stage = document.getElementById('cvStage');
    if (!stage || document.getElementById('canvasZoomIn')) return;
    const canvas = stage.querySelector('.cvCanvas');
    if (!canvas) return;
    const wrap = document.createElement('div');
    wrap.className = 'cvStageWrap';
    stage.insertBefore(wrap, canvas);
    wrap.appendChild(canvas);
    const controls = document.createElement('div');
    controls.className = 'canvasControls';
    controls.innerHTML = `<button type="button" id="canvasZoomOut" aria-label="Zoom out">−</button>
      <span class="zoomLabel" id="zoomLabel">100%</span>
      <button type="button" id="canvasZoomIn" aria-label="Zoom in">+</button>`;
    wrap.insertBefore(controls, canvas);
    const applyZoom = () => {
      canvas.style.transform = `scale(${canvasZoom})`;
      const zl = document.getElementById('zoomLabel');
      if (zl) zl.textContent = Math.round(canvasZoom * 100) + '%';
    };
    document.getElementById('canvasZoomIn')?.addEventListener('click', () => {
      canvasZoom = Math.min(1.15, canvasZoom + 0.05);
      applyZoom();
    });
    document.getElementById('canvasZoomOut')?.addEventListener('click', () => {
      canvasZoom = Math.max(0.85, canvasZoom - 0.05);
      applyZoom();
    });
    stage.addEventListener('mousemove', (e) => {
      if (canvasZoom <= 1) return;
      const r = stage.getBoundingClientRect();
      const x = (e.clientX - r.left) / r.width - 0.5;
      const y = (e.clientY - r.top) / r.height - 0.5;
      canvas.style.transform = `scale(${canvasZoom}) translate(${x * 6}px, ${y * 4}px)`;
    });
    stage.addEventListener('mouseleave', applyZoom);
  }

  function setupLiveFeedback() {
    const stage = document.getElementById('cvStage');
    const cvInput = document.getElementById('cvText');
    if (!stage || stage.dataset.liveExp) return;
    stage.dataset.liveExp = '1';
    const pulse = () => {
      stage.classList.add('is-editing');
      document.getElementById('cvPreview')?.classList.add('livePulse');
      setTimeout(() => document.getElementById('cvPreview')?.classList.remove('livePulse'), 600);
      clearTimeout(liveTimer);
      liveTimer = setTimeout(() => {
        if (typeof global.scoreLocal === 'function' && cvInput) {
          const s = global.scoreLocal(cvInput.value);
          const d = {
            ...s,
            verdict: 'Live readiness update',
            diagnosis: { recruiterView: 'Editing updates your recruiter scan in real time.' },
            topFixes: global.lastData?.topFixes || [],
          };
          renderRecruiterReadiness(d);
        }
        stage.classList.remove('is-editing');
      }, 700);
    };
    stage.addEventListener('input', (e) => {
      if (e.target.closest('#cvPreview')) pulse();
    });
    cvInput?.addEventListener('input', () => {
      document.querySelector('.scorePanel')?.classList.add('is-scanning');
      clearTimeout(liveTimer);
      liveTimer = setTimeout(() => {
        if (typeof global.renderAutoScore === 'function') global.renderAutoScore();
        document.querySelector('.scorePanel')?.classList.remove('is-scanning');
      }, 500);
    });
  }

  function onGenerateComplete(cvText, premiumCV) {
    renderTransformationCompare(cvText, premiumCV);
    setNarrativePhase('result');
    updateCompanion(global.lastData || {});
  }

  function init() {
    if (document.documentElement.classList.contains('stable-mode')) return;
    setupCompanion();
    setupCanvasControls();
    setupLiveFeedback();
    setNarrativePhase('before');
    const upload = document.querySelector('.uploadBox');
    if (upload && !upload.querySelector('.uploadEmpty')) {
      const empty = document.createElement('div');
      empty.className = 'uploadEmpty';
      empty.innerHTML =
        '<h3>Drop your resume.</h3><p>We\'ll simulate how recruiters actually read it — in the first seven seconds.</p>';
      upload.insertBefore(empty, upload.firstChild);
      if (empty.tagName === 'MOTION') {
        const d = document.createElement('div');
        d.className = 'uploadEmpty';
        d.innerHTML = empty.innerHTML;
        empty.replaceWith(d);
      }
    }
    document.querySelector('.card.dark')?.classList.add('scorePanel');
    document.getElementById('generateBtn')?.classList.add('generateBtnPrimary');
  }

  global.HirelyExperience = {
    init,
    setNarrativePhase,
    readinessDimensions,
    renderRecruiterReadiness,
    renderTransformationCompare,
    updateCompanion,
    onGenerateComplete,
  };
})(typeof window !== 'undefined' ? window : globalThis);
