/**
 * Hirely trust layer — privacy, ATS/recruiter badges, extraction confidence, success indicators.
 */
(function initHirelyTrustLayer(global) {
  'use strict';

  function pct(n) {
    if (n == null || Number.isNaN(Number(n))) return null;
    const raw = Number(n);
    const v = raw <= 1 ? Math.round(raw * 100) : Math.round(raw);
    return Math.max(0, Math.min(100, v));
  }

  function bandFromPct(p) {
    if (p == null) return 'unknown';
    if (p >= 85) return 'high';
    if (p >= 65) return 'medium';
    return 'low';
  }

  function renderHtml(ctx) {
    const { variant, t, esc, privacy, badges, confidence, indicators } = ctx;
    const parts = [];

    if (privacy) {
      parts.push(
        `<p class="hirelyTrustPrivacy" role="note">` +
          `<span class="hirelyTrustPrivacyIcon" aria-hidden="true">` +
          `<svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2"><rect x="5" y="11" width="14" height="10" rx="2"/><path d="M8 11V7a4 4 0 0 1 8 0v4"/></svg>` +
          `</span>` +
          `<span>${esc(privacy)}</span>` +
          `</p>`
      );
    }

    if (badges && badges.length) {
      parts.push(
        `<div class="hirelyTrustBadges" role="list">` +
          badges
            .map((b) => {
              const icon = b.icon
                ? `<span class="hirelyTrustBadgeIcon" aria-hidden="true">${b.icon}</span>`
                : '';
              return `<span class="hirelyTrustBadge hirelyTrustBadge--${esc(b.kind)}" role="listitem">${icon}<span>${esc(b.label)}</span></span>`;
            })
            .join('') +
          `</div>`
      );
    }

    if (confidence != null && variant !== 'hero') {
      const p = pct(confidence);
      if (p != null) {
        const band = bandFromPct(p);
        const label = t('trustConfidenceLabel');
        parts.push(
          `<div class="hirelyTrustConfidence hirelyTrustConfidence--${band}" role="status">` +
            `<div class="hirelyTrustConfidenceHead">` +
            `<span class="hirelyTrustConfidenceLabel">${esc(label)}</span>` +
            `<span class="hirelyTrustConfidenceValue">${p}%</span>` +
            `</div>` +
            `<meter class="hirelyTrustConfidenceMeter" min="0" max="100" optimum="90" low="65" high="85" value="${p}" aria-label="${esc(label)} ${p}%"></meter>` +
            `</div>`
        );
      }
    }

    if (indicators && indicators.length && variant !== 'hero') {
      parts.push(
        `<ul class="hirelyTrustIndicators" aria-label="${esc(t('trustIndicatorsLabel'))}">` +
          indicators
            .map((i) => {
              const mark = i.state === 'ok' ? '✓' : i.state === 'warn' ? '!' : '·';
              return `<li class="hirelyTrustIndicator hirelyTrustIndicator--${i.state}"><span class="hirelyTrustIndicatorMark" aria-hidden="true">${mark}</span><span>${esc(i.label)}</span></li>`;
            })
            .join('') +
          `</ul>`
      );
    }

    return `<div class="hirelyTrustLayer hirelyTrustLayer--${variant}" data-variant="${variant}">${parts.join('')}</div>`;
  }

  function mount(el, ctx) {
    if (!el || !ctx) return;
    const html = renderHtml(ctx);
    if (!html.replace(/<[^>]+>/g, '').trim()) {
      el.classList.add('hidden');
      el.innerHTML = '';
      return;
    }
    el.innerHTML = html;
    el.classList.remove('hidden');
  }

  global.HirelyTrustLayer = { renderHtml, mount, pct, bandFromPct };
})(typeof window !== 'undefined' ? window : globalThis);
