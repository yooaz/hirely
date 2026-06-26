/**
 * Hirely Premium — full recruiter-grade experience system.
 */
(function (global) {
  const PHASES = ['upload', 'analyze', 'transform', 'preview', 'export'];
  const POSITIONING = {
    ats: 'Corporate clarity',
    swiss: 'Swiss editorial',
    executive: 'Executive leadership',
    editorial: 'Editorial designer',
    portfolio: 'Creative leadership',
    luxury: 'Premium positioning',
    startup: 'Growth operator',
    art: 'Art direction',
    minimal: 'Minimal clarity',
    modern: 'Modern professional',
    creative: 'Creative specialist',
  };

  const HUMAN_FIXES = [
    [/clarify the professional summary/i, 'Positioning lacks immediate clarity in the opening.'],
    [/move recognized clients/i, 'The strongest proof appears too low in the document.'],
    [/add measurable outcomes/i, 'Impact reads stronger with numbers near the top third.'],
    [/ATS-friendly/i, 'Structure should stay clean for both ATS and a seven-second skim.'],
    [/target role/i, 'Recruiters may struggle to identify your seniority quickly.'],
    [/keyword fit/i, 'Role keywords need to land earlier for a fast match read.'],
    [/hierarchy/i, 'Visual hierarchy should guide the eye to proof, not decoration.'],
  ];

  function humanizeFix(text) {
    let t = String(text || '').trim();
    HUMAN_FIXES.forEach(([re, repl]) => {
      if (re.test(t)) t = repl;
    });
    return t;
  }

  function escapeHtml(s) {
    return String(s || '').replace(/[&<>"']/g, (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
    );
  }

  function setPhase(phase) {
    const p = PHASES.includes(phase) ? phase : 'upload';
    document.documentElement.dataset.hpPhase = p;
    document.body.dataset.hpPhase = p;
  }

  function applyBrandCopy() {
    const hero = document.querySelector('.hero--compact');
    if (!hero) return;
    const kicker = hero.querySelector('.kicker');
    if (kicker) {
      kicker.innerHTML = '<span class="dot"></span> Recruiter-grade intelligence';
    }
    const h1 = hero.querySelector('h1');
    if (h1) {
      h1.innerHTML = 'What recruiters see<br><span class="grad">in seven seconds.</span>';
    }
    const lead = hero.querySelector('.heroLead');
    if (lead) {
      lead.textContent =
        'See your CV through recruiter eyes—then transform it into a stronger application.';
    }
    const trust = hero.querySelector('.heroTrust');
    if (trust) trust.textContent = 'Private · No spam · Publication-ready export';
    document.getElementById('flowSteps')?.classList.add('hidden');
    document.querySelector('.prepSection .sectionHead')?.classList.add('hidden');
    const cta = hero.querySelector('.actions .btn.blue');
    if (cta) cta.textContent = 'Start recruiter scan';
    const intelHead = document.querySelector('.col-intel .cardHead h2');
    if (intelHead) intelHead.textContent = 'Recruiter read';
    const recLabel = document.querySelector('#intelActions .intelLabel');
    if (recLabel) recLabel.textContent = 'Top 3 recommendations';
  }

  function ensureIntelExtras() {
    const panel = document.querySelector('.col-intel');
    if (!panel) return;
    if (!document.getElementById('recruiterHeatmap')) {
      const hm = document.createElement('div');
      hm.id = 'recruiterHeatmap';
      hm.className = 'recruiterHeatmap hidden';
      hm.innerHTML =
        '<div class="recruiterHeatmap__title">Attention scan</div>' +
        '<div id="recruiterHeatmapRows"></div>';
      const summary = document.getElementById('intelSummary');
      if (summary) summary.after(hm);
      else panel.appendChild(hm);
    }
    if (!document.getElementById('heatmapInsight')) {
      const note = document.createElement('p');
      note.id = 'heatmapInsight';
      note.className = 'heatmapInsight hidden';
      const actions = document.getElementById('intelActions');
      if (actions) actions.before(note);
    }
    if (!document.getElementById('recruiterNote')) {
      const note = document.createElement('p');
      note.id = 'recruiterNote';
      note.className = 'recruiterNote hidden';
      panel.appendChild(note);
    }
  }

  function ensureCvHeatmap() {
    const stage = document.getElementById('cvStage');
    if (!stage || document.getElementById('cvHeatmap')) return;
    const wrap = document.createElement('div');
    wrap.id = 'cvHeatmap';
    wrap.className = 'cvHeatmap';
    wrap.setAttribute('aria-hidden', 'true');
    wrap.innerHTML =
      '<div class="cvHeatmap__zone cvHeatmap__zone--hot"></div>' +
      '<div class="cvHeatmap__zone cvHeatmap__zone--warm"></div>' +
      '<div class="cvHeatmap__zone cvHeatmap__zone--cold"></div>' +
      '<span class="cvHeatmap__legend">Recruiter scan</span>';
    const canvas = stage.querySelector('.cvCanvas');
    if (canvas) {
      canvas.style.position = 'relative';
      canvas.appendChild(wrap);
    } else stage.appendChild(wrap);
  }

  function ensureTransformProof() {
    const preview = document.getElementById('workspacePreview');
    if (!preview || document.getElementById('transformProof')) return;
    const el = document.createElement('div');
    el.id = 'transformProof';
    el.className = 'transformProof hidden';
    el.innerHTML =
      '<div class="transformProof__col transformProof__col--before">' +
      '<span class="transformProof__label">Before</span>' +
      '<p id="proofBefore">Generic summary and buried proof.</p></div>' +
      '<span class="transformProof__arrow" aria-hidden="true">→</span>' +
      '<div class="transformProof__col transformProof__col--after">' +
      '<span class="transformProof__label">After</span>' +
      '<p id="proofAfter">Strategic positioning with proof above the fold.</p></div>';
    const stage = document.getElementById('cvStage');
    if (stage) preview.insertBefore(el, stage);
  }

  function renderRecruiterHeatmap(d) {
    const block = document.getElementById('recruiterHeatmap');
    const rows = document.getElementById('recruiterHeatmapRows');
    if (!block || !rows) return;
    const score = Math.round(d?.score || 0);
    if (score <= 0) {
      block.classList.add('hidden');
      return;
    }
    const zones = [
      { label: 'Header & role', pct: Math.min(100, Math.round((d.recruiterScore || 0) * 0.9 + 12)) },
      { label: 'Experience proof', pct: Math.min(100, Math.round(d.impactScore || 0)) },
      { label: 'Skills & close', pct: Math.min(100, Math.round((d.readabilityScore || 0) * 0.85)) },
    ];
    rows.innerHTML = zones
      .map(
        (z) =>
          `<div class="recruiterHeatmap__row"><span>${escapeHtml(z.label)}</span>` +
          `<div class="recruiterHeatmap__bar"><i style="width:${z.pct}%"></i></div>` +
          `<span>${z.pct}%</span></div>`
      )
      .join('');
    block.classList.remove('hidden');
    document.getElementById('cvStage')?.classList.add('has-heatmap');
  }

  function renderHeatmapInsight(d) {
    const el = document.getElementById('heatmapInsight');
    if (!el) return;
    const score = Math.round(d?.score || 0);
    if (score <= 0) {
      el.classList.add('hidden');
      return;
    }
    const bars = [
      { label: 'Opening scan', v: d.recruiterScore },
      { label: 'Proof density', v: d.impactScore },
      { label: 'ATS path', v: d.atsScore },
    ];
    const weakest = [...bars].sort((a, b) => (a.v || 0) - (b.v || 0))[0];
    if (!weakest || (weakest.v || 0) >= 72) {
      el.classList.add('hidden');
      return;
    }
    const copy = {
      'Opening scan': 'Recruiters may struggle to identify your seniority quickly.',
      'Proof density': 'The strongest proof appears too low in the document.',
      'ATS path': 'Structure creates friction in the first-pass skim.',
    };
    el.textContent = copy[weakest.label] || `Focus on ${weakest.label.toLowerCase()} before export.`;
    el.classList.remove('hidden');
  }

  function renderRecruiterNote(d) {
    const el = document.getElementById('recruiterNote');
    if (!el) return;
    const score = Math.round(d?.score || 0);
    if (score <= 0) {
      el.classList.add('hidden');
      return;
    }
    const note =
      d.diagnosis?.recruiterView ||
      'Elite recruiters decide in seconds—lead with role, proof, and fit.';
    el.textContent = note.length > 120 ? note.slice(0, 118) + '…' : note;
    el.classList.remove('hidden');
  }

  function humanizeTopFixes(d) {
    const list = document.getElementById('fixList');
    if (!list) return;
    const fixes = (d.topFixes || []).slice(0, 3).map(humanizeFix);
    if (fixes.length) list.innerHTML = fixes.map((x) => `<li>${escapeHtml(x)}</li>`).join('');
  }

  function showTransformProof(d) {
    const panel = document.getElementById('transformProof');
    if (!panel) return;
    const gen = global.appState?.hasGeneratedCV;
    if (!gen) {
      panel.classList.add('hidden');
      return;
    }
    const before = document.getElementById('proofBefore');
    const after = document.getElementById('proofAfter');
    if (before) {
      before.textContent =
        d?.diagnosis?.positioning?.slice(0, 80) ||
        'Generic summary with proof buried below the fold.';
    }
    if (after) {
      after.textContent =
        d?.verdict?.slice(0, 80) ||
        'Strategic positioning with impact-led proof near the top.';
    }
    panel.classList.remove('hidden');
    setPhase('preview');
  }

  function bindSubtleParallax() {
    const stage = document.getElementById('cvStage');
    const canvas = stage?.querySelector('.cvCanvas');
    if (!canvas || canvas.dataset.parallaxBound) return;
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
    canvas.dataset.parallaxBound = '1';
    stage.addEventListener(
      'mousemove',
      (e) => {
        const r = stage.getBoundingClientRect();
        const x = (e.clientX - r.left) / r.width - 0.5;
        const y = (e.clientY - r.top) / r.height - 0.5;
        canvas.style.transform = `translateY(-2px) rotateX(${y * -1.2}deg) rotateY(${x * 1.2}deg)`;
      },
      { passive: true }
    );
    stage.addEventListener('mouseleave', () => {
      canvas.style.transform = '';
    });
  }

  function patchFlow() {
    const flow = global.HirelyFlow;
    if (!flow?.setTransformStep || flow._premiumPhasePatched) return;
    const orig = flow.setTransformStep;
    flow.setTransformStep = function (step) {
      orig.call(this, step);
      const map = {
        upload: 'upload',
        analyze: 'analyze',
        transform: 'transform',
        preview: 'preview',
        export: 'export',
      };
      setPhase(map[step] || 'upload');
    };
    flow._premiumPhasePatched = true;
  }

  function patchExperience() {
    const exp = global.HirelyExperience;
    if (!exp?.renderRecruiterReadiness || exp._premiumPatched) return;
    const orig = exp.renderRecruiterReadiness;
    exp.renderRecruiterReadiness = function (d) {
      orig.call(this, d);
      document.getElementById('intelSecondary')?.classList.add('hidden');
      const primary = document.getElementById('primaryInsight');
      if (primary && d?.score > 0) {
        const cv = document.getElementById('cvText')?.value || '';
        const dims = exp.readinessDimensions?.(d, cv) || [];
        const weak = [...dims].sort((a, b) => a.val - b.val)[0];
        if (weak?.insight && !String(d.diagnosis?.recruiterView || '').trim()) {
          primary.textContent = humanizeFix(weak.insight);
        }
      }
      humanizeTopFixes(d);
      renderRecruiterHeatmap(d);
      renderHeatmapInsight(d);
      renderRecruiterNote(d);
      if (Math.round(d?.score || 0) > 0) {
        global.HirelyFlow?.setTransformStep?.('analyze');
        setPhase('analyze');
      }
    };
    exp._premiumPatched = true;
  }

  function patchRenderScores() {
    const orig = global.renderScores;
    if (!orig || orig._premiumPatched) return;
    global.renderScores = function (d) {
      orig.apply(this, arguments);
      humanizeTopFixes(d);
      renderRecruiterHeatmap(d);
      renderHeatmapInsight(d);
      renderRecruiterNote(d);
      if (Math.round(d?.score || 0) > 0) setPhase('analyze');
    };
    global.renderScores._premiumPatched = true;
  }

  function patchRenderCV() {
    const orig = global.renderCV;
    if (!orig || orig._premiumPatched) return;
    global.renderCV = function (d, opts) {
      const out = orig.apply(this, arguments);
      const paper = document.getElementById('cvPaper');
      const has =
        paper &&
        !paper.querySelector('.cvEmpty') &&
        (paper.innerText || '').trim().length > 8;
      if (has) {
        document.getElementById('cvStage')?.classList.add('has-heatmap');
        if (global.lastData) showTransformProof(global.lastData);
        global.HirelyFlow?.setTransformStep?.('preview');
        setPhase('preview');
      }
      return out;
    };
    global.renderCV._premiumPatched = true;
  }

  function patchGenerate() {
    const btn = document.getElementById('generateBtn');
    if (!btn || btn.dataset.premiumBound) return;
    btn.addEventListener('click', () => {
      setPhase('transform');
      global.HirelyFlow?.setTransformStep?.('transform');
    });
    btn.dataset.premiumBound = '1';
  }

  function stabilizeLayout() {
    document.querySelectorAll('.cvPage, #cvPreview').forEach((el) => {
      el.style.transform = '';
    });
    const toolbar = document.getElementById('proToolbar');
    if (toolbar && !toolbar.classList.contains('hidden')) {
      /* show when generated */
    }
  }

  function init() {
    setPhase('upload');
    applyBrandCopy();
    ensureIntelExtras();
    ensureCvHeatmap();
    ensureTransformProof();
    stabilizeLayout();
    patchFlow();
    patchExperience();
    patchRenderScores();
    patchRenderCV();
    patchGenerate();
    bindSubtleParallax();
    if (global.lastData) {
      renderRecruiterHeatmap(global.lastData);
      renderHeatmapInsight(global.lastData);
    }
    if (global.renderTemplateButtons) global.renderTemplateButtons();
  }

  global.HirelyPremium = {
    init,
    setPhase,
    renderRecruiterHeatmap,
    renderHeatmapInsight,
    humanizeFix,
    POSITIONING,
  };
})(typeof window !== 'undefined' ? window : globalThis);
