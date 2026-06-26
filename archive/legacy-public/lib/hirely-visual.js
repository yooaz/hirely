/**
 * Hirely Block 8 — visual scoring, scan flow, CV canvas interactions.
 */

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

export function radarMetricsFromReport(d = {}) {
  return [
    { label: 'ATS', value: d.atsScore },
    { label: 'Recruiter', value: d.recruiterScore },
    { label: 'LinkedIn', value: d.linkedinScore },
    { label: 'Impact', value: d.impactScore },
    { label: 'Read', value: d.readabilityScore },
    { label: 'Visual', value: d.visualScore || d.visualHierarchyScore }
  ];
}

export function renderRadarChart(svgEl, metrics = []) {
  if (!svgEl) return;
  const items = (metrics || []).slice(0, 6);
  while (items.length < 6) items.push({ label: ['ATS', 'Recruiter', 'LinkedIn', 'Impact', 'Read', 'Visual'][items.length], value: 0 });

  const cx = 100;
  const cy = 100;
  const maxR = 72;
  const n = items.length;
  const angle0 = -Math.PI / 2;
  const pt = (i, r) => {
    const a = angle0 + (i * 2 * Math.PI) / n;
    return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
  };

  let grid = '';
  [0.25, 0.5, 0.75, 1].forEach(level => {
    const pts = items.map((_, i) => pt(i, maxR * level).join(',')).join(' ');
    grid += `<polygon points="${pts}" fill="none" stroke="rgba(255,255,255,0.08)" stroke-width="1"/>`;
  });

  const axes = items
    .map((m, i) => {
      const [x, y] = pt(i, maxR);
      const [lx, ly] = pt(i, maxR + 14);
      return `<line x1="${cx}" y1="${cy}" x2="${x}" y2="${y}" stroke="rgba(255,255,255,0.12)" stroke-width="1"/>
        <text x="${lx}" y="${ly}" text-anchor="middle" dominant-baseline="middle" fill="#9ca3af" font-size="8" font-weight="600" font-family="Inter,sans-serif">${esc(m.label)}</text>`;
    })
    .join('');

  const dataPts2 = items
    .map((m, i) => {
      const v = Math.max(0, Math.min(100, Number(m.value) || 0)) / 100;
      return pt(i, maxR * v).join(',');
    })
    .join(' ');

  svgEl.innerHTML = `${grid}${axes}<polygon class="radarFill" points="${dataPts2}" fill="rgba(59,130,246,0.28)" stroke="#60a5fa" stroke-width="2" stroke-linejoin="round"/>`;
}

export function renderScanFlow(container, d = {}) {
  if (!container) return;
  const steps = [
    { label: 'Header', score: Math.round((d.recruiterScore || 0) * 0.92) },
    { label: 'Profile', score: Math.round((d.readabilityScore || 0) * 0.88) },
    { label: 'Experience', score: Math.round((d.impactScore || 0) * 0.95) },
    { label: 'Skills', score: Math.round((d.atsScore || 0) * 0.82) },
    { label: 'Proof', score: Math.round((d.linkedinScore || 0) * 0.78) }
  ];
  container.innerHTML = `<div class="scanFlow" aria-label="Recruiter scan path">${steps
    .map(
      (s, i) => `
    <div class="scanStep ${s.score >= 72 ? 'scanStep--strong' : s.score < 58 ? 'scanStep--weak' : ''}">
      <span class="scanStepNum">${i + 1}</span>
      <span class="scanStepLabel">${s.label}</span>
      <span class="scanStepBar"><i style="width:${s.score}%"></i></span>
    </div>
    ${i < steps.length - 1 ? '<span class="scanArrow">→</span>' : ''}`
    )
    .join('')}</div>`;
}

export function renderATSViz(container, d = {}) {
  if (!container) return;
  const ats = d.atsScore || 0;
  const sections = [
    { name: 'Headings', ok: ats >= 60 },
    { name: 'Dates', ok: ats >= 55 },
    { name: 'Keywords', ok: ats >= 65 },
    { name: 'Bullets', ok: (d.readabilityScore || 0) >= 60 },
    { name: 'Contact', ok: (d.recruiterScore || 0) >= 50 },
    { name: 'Structure', ok: ats >= 58 }
  ];
  container.innerHTML = sections
    .map(s => `<div class="atsCell ${s.ok ? 'atsCell--ok' : 'atsCell--warn'}"><span class="atsDot"></span>${s.name}</div>`)
    .join('');
}

export function renderSectionStrength(container, d = {}) {
  if (!container) return;
  const chips = [
    ['Profile', d.readabilityScore],
    ['Experience', d.impactScore],
    ['Skills', d.atsScore],
    ['Proof', d.recruiterScore],
    ['LinkedIn', d.linkedinScore],
    ['Layout', d.visualScore || d.visualHierarchyScore]
  ];
  container.innerHTML = chips
    .map(([label, v]) => {
      const n = Math.round(v || 0);
      const tier = n >= 76 ? 'high' : n >= 62 ? 'mid' : 'low';
      return `<span class="secChip secChip--${tier}" title="${n}/100">${label} <b>${n}</b></span>`;
    })
    .join('');
}

export function renderReadabilityGraph(container, d = {}) {
  if (!container) return;
  const vh = d.visualHierarchy || {};
  const rows = [
    ['Typography', vh.typography],
    ['Hierarchy', vh.sectionHierarchy],
    ['Flow', vh.readingFlow],
    ['Spacing', vh.whitespace],
    ['Scan', vh.scanEfficiency]
  ];
  container.innerHTML = rows
    .map(([k, v]) => {
      const n = Math.round(v || d.readabilityScore || 0);
      return `<div class="readRow"><span>${k}</span><span class="readTrack"><i style="width:${n}%"></i></span><b>${n}</b></div>`;
    })
    .join('')
    .replace(/<\/?motion>/g, m => (m.startsWith('</') ? '</div>' : '<div'));
}

export function renderVisualIntelligencePanel(d = {}) {
  renderRadarChart(document.querySelector('#radarChart'), radarMetricsFromReport(d));
  renderScanFlow(document.querySelector('#scanFlow'), d);
  renderATSViz(document.querySelector('#atsViz'), d);
  renderSectionStrength(document.querySelector('#sectionStrength'), d);
  renderReadabilityGraph(document.querySelector('#readabilityGraph'), d);
}

export function clientBadgesHtml(clients = [], max = 8) {
  const list = (clients || []).filter(Boolean).slice(0, max);
  if (!list.length) return '';
  return `<div class="cvClientBadges">${list.map(c => `<span class="cvClientBadge">${esc(c)}</span>`).join('')}</div>`;
}

/** Drag-reorder CV sections (Pro canvas). */
export function bindCvCanvas(root, { onReorder } = {}) {
  if (!root || root.dataset.dragBound === '1') return;
  root.dataset.dragBound = '1';

  let dragEl = null;

  root.querySelectorAll('.cvSection.cvModule').forEach(sec => {
    const handle = sec.querySelector('.cvDragHandle');
    if (handle) {
      handle.addEventListener('mousedown', e => e.stopPropagation());
    }
    sec.addEventListener('dragstart', e => {
      dragEl = sec;
      sec.classList.add('cvSection--dragging');
      e.dataTransfer.effectAllowed = 'move';
      try {
        e.dataTransfer.setData('text/plain', sec.dataset.section || '');
      } catch (_) {}
    });
    sec.addEventListener('dragend', () => {
      sec.classList.remove('cvSection--dragging');
      root.querySelectorAll('.cvSection').forEach(s => s.classList.remove('cvSection--over'));
      dragEl = null;
      onReorder?.();
    });
    sec.addEventListener('dragover', e => {
      e.preventDefault();
      if (!dragEl || dragEl === sec) return;
      sec.classList.add('cvSection--over');
      const parent = sec.parentElement;
      const rect = sec.getBoundingClientRect();
      const after = e.clientY > rect.top + rect.height / 2;
      if (after) parent.insertBefore(dragEl, sec.nextSibling);
      else parent.insertBefore(dragEl, sec);
    });
    sec.addEventListener('dragleave', () => sec.classList.remove('cvSection--over'));
  });
}

export function stripCanvasChrome(root) {
  if (!root) return;
  root.querySelectorAll('.cvDragHandle, .cvSectionChrome').forEach(el => {
    el.querySelectorAll?.('.cvDragHandle')?.forEach(h => h.remove());
    if (el.classList?.contains('cvDragHandle')) el.remove();
  });
  root.querySelectorAll('.cvSection').forEach(s => {
    s.removeAttribute('draggable');
    s.classList.remove('cvSection--dragging', 'cvSection--over', 'cvModule');
  });
}

export default {
  radarMetricsFromReport,
  renderRadarChart,
  renderScanFlow,
  renderATSViz,
  renderSectionStrength,
  renderReadabilityGraph,
  renderVisualIntelligencePanel,
  clientBadgesHtml,
  bindCvCanvas,
  stripCanvasChrome
};
