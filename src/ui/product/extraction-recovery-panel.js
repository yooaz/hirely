/**
 * Extraction Recovery UI — guided recovery workflow when preview is blocked.
 */
(function (global) {
  const FIELD_ACTION_MAP = {
    name: 'confirm_name',
    title: 'confirm_title',
    email: 'email',
    phone: 'phone',
    experience: 'confirm_experience',
    education: 'education',
    skills: 'skills',
    tools: 'skills',
    languages: 'skills',
    summary: 'confirm_summary',
    extraction: 'retry_extraction',
  };

  function esc(s) {
    return String(s || '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function renderActionBtn(action, opts = {}) {
    const primary = action.primary ? ' extractionRecoveryAction--primary' : '';
    const val = action.value ? ` data-recovery-value="${esc(action.value)}"` : '';
    const page = action.page != null ? ` data-recovery-page="${esc(action.page)}"` : '';
    return `<button type="button" class="btn small${primary ? '' : ' ghost'} extractionRecoveryAction${primary}" data-recovery-action="${esc(action.id)}"${val}${page}>${esc(action.label)}</button>`;
  }

  function renderList(items, emptyLabel) {
    if (!items.length) {
      return `<p class="extractionRecoveryEmpty">${esc(emptyLabel)}</p>`;
    }
    return `<ul class="extractionRecoveryList">${items
      .map((it) => {
        const action = it.action || FIELD_ACTION_MAP[it.field] || it.field || 'edit';
        const actionBtns = (it.actions || [action])
          .slice(0, 2)
          .map((a) => {
            const id = typeof a === 'string' ? a : a.id;
            const label =
              typeof a === 'string'
                ? id.replace(/_/g, ' ')
                : a.label || id;
            return `<button type="button" class="btn small ghost extractionRecoveryFix" data-recovery-action="${esc(id)}" data-recovery-field="${esc(it.field || '')}"${it.value ? ` data-recovery-value="${esc(it.value)}"` : ''}>${esc(label)}</button>`;
          })
          .join('');
        const meta =
          it.confidence != null && it.confidence > 0
            ? `<span class="extractionRecoveryMeta">${it.confidence}%</span>`
            : '';
        const title = it.title ? `<span class="extractionRecoveryIssueTitle">${esc(it.title)}</span>` : '';
        const val = it.value || it.sourceText || it.detail;
        const sub = it.hint
          ? `<span class="extractionRecoverySub">${esc(it.hint)}</span>`
          : val
            ? `<span class="extractionRecoverySub">${esc(String(val).slice(0, 140))}</span>`
            : '';
        const code =
          it.code && it.userFacing
            ? `<span class="extractionRecoveryCode">${esc(it.code)}</span>`
            : '';
        return `<li class="extractionRecoveryItem extractionRecoveryItem--${esc(it.severity || 'warning')}"><div class="extractionRecoveryItemMain">${title}<span class="extractionRecoveryMsg">${esc(it.message || it.label || it.field)}</span>${code}${meta}${sub}</div><div class="extractionRecoveryItemActions">${actionBtns}</div></li>`;
      })
      .join('')}</ul>`;
  }

  function renderMissingSections(sections) {
    if (!sections.length) {
      return '<p class="extractionRecoveryEmpty">All required sections detected.</p>';
    }
    return `<ul class="extractionRecoveryList">${sections
      .map((s) => {
        const action = FIELD_ACTION_MAP[s.id] || s.id;
        return `<li class="extractionRecoveryItem extractionRecoveryItem--miss"><div class="extractionRecoveryItemMain"><span class="extractionRecoveryMsg">${esc(s.label || s.id)}</span><span class="extractionRecoverySub">Section missing or incomplete</span></div><button type="button" class="btn small ghost extractionRecoveryFix" data-recovery-action="${esc(action)}">${esc('Add')}</button></li>`;
      })
      .join('')}</ul>`;
  }

  function renderLowConfidence(fields) {
    if (!fields.length) {
      return '<p class="extractionRecoveryEmpty">No low-confidence fields.</p>';
    }
    return renderList(
      fields.map((f) => ({
        field: f.field,
        message: `${f.field} — verify (${f.confidence}%)`,
        value: f.value,
        confidence: f.confidence,
        action: 'edit',
        severity: 'info',
      })),
      'No low-confidence fields.'
    );
  }

  function renderConfidenceSummary(report) {
    const cs = report.confidenceSummary || {};
    const diag = report.diagnostics || {};
    const rows = [
      ['Overall confidence', cs.overall != null ? `${cs.overall}%` : '—'],
      ['Extraction method', cs.extractionMethod || diag.extractionMethod || '—'],
      ['Parser input', cs.parserInputSource || diag.parserInputSource || '—'],
      ['OCR completed', cs.ocrCompleted || diag.ocrCompleted ? 'Yes' : 'No'],
      ['Positioned lines', diag.positionedLineCount ?? '—'],
      ['Spatial blocks', diag.spatialBlockCount ?? '—'],
    ];
    return `<dl class="extractionRecoveryMetrics">${rows
      .map(
        ([k, v]) =>
          `<div class="extractionRecoveryMetric"><dt>${esc(k)}</dt><dd>${esc(String(v))}</dd></div>`
      )
      .join('')}</dl>`;
  }

  function renderPages(diag) {
    const pages = diag.pages || [];
    if (!pages.length) return '<p class="extractionRecoveryEmpty">No per-page trace available.</p>';
    return `<ul class="extractionRecoveryList">${pages
      .map((p) => {
        const ocr = p.ocrDurationMs != null ? ` · OCR ${p.ocrDurationMs}ms` : '';
        const lines = p.lineCount != null ? ` · ${p.lineCount} lines` : '';
        return `<li class="extractionRecoveryItem"><div class="extractionRecoveryItemMain"><span class="extractionRecoveryMsg">Page ${esc(p.page)} — ${esc(p.pageType || 'unknown')}</span><span class="extractionRecoverySub">${esc(p.extractionMethod || '—')}${esc(ocr)}${esc(lines)}</span></div><button type="button" class="btn small ghost extractionRecoveryFix" data-recovery-action="mark_portfolio" data-recovery-page="${esc(p.page)}">Portfolio / ignore</button></li>`;
      })
      .join('')}</ul>`;
  }

  function renderCandidates(diag) {
    const names = diag.nameCandidates || [];
    const titles = diag.titleCandidates || [];
    if (!names.length && !titles.length) {
      return '<p class="extractionRecoveryEmpty">No header candidates yet — confirm manually.</p>';
    }
    const parts = [];
    if (names.length) {
      parts.push(
        `<div class="extractionRecoveryCandidates"><span class="extractionRecoveryCandidatesLabel">Name</span>${names
          .slice(0, 4)
          .map(
            (n) =>
              `<button type="button" class="btn small ghost extractionRecoveryFix" data-recovery-action="accept_name" data-recovery-value="${esc(n)}">${esc(n)}</button>`
          )
          .join('')}</div>`
      );
    }
    if (titles.length) {
      parts.push(
        `<div class="extractionRecoveryCandidates"><span class="extractionRecoveryCandidatesLabel">Title</span>${titles
          .slice(0, 4)
          .map(
            (n) =>
              `<button type="button" class="btn small ghost extractionRecoveryFix" data-recovery-action="accept_title" data-recovery-value="${esc(n)}">${esc(n)}</button>`
          )
          .join('')}</div>`
      );
    }
    const contact = diag.contactCandidates || {};
    if (contact.email || contact.phone) {
      parts.push(
        `<p class="extractionRecoverySub">Contact: ${esc([contact.email, contact.phone].filter(Boolean).join(' · '))}</p>`
      );
    }
    return parts.join('');
  }

  function renderSuggestions(suggestions) {
    if (!suggestions?.length) return '';
    return `<section class="extractionRecoveryBlock" aria-labelledby="extractionRecoverySuggestTitle">
      <h4 id="extractionRecoverySuggestTitle">Suggested fixes</h4>
      <ul class="extractionRecoveryList">${suggestions
        .map((s) => {
          const btn = s.action
            ? `<button type="button" class="btn small ghost extractionRecoveryFix" data-recovery-action="${esc(s.action)}"${s.value ? ` data-recovery-value="${esc(s.value)}"` : ''}${s.page != null ? ` data-recovery-page="${esc(s.page)}"` : ''}>${esc(s.label || 'Fix')}</button>`
            : '';
          return `<li class="extractionRecoveryItem"><div class="extractionRecoveryItemMain"><span class="extractionRecoveryMsg">${esc(s.label || s.type)}</span><span class="extractionRecoverySub">${esc(s.message || s.value || '')}</span></div>${btn}</li>`;
        })
        .join('')}</ul>
    </section>`;
  }

  function renderPrimaryActions(actions) {
    if (!actions?.length) return '';
    return `<div class="extractionRecoveryPrimaryActions">${actions
      .slice(0, 6)
      .map((a) => renderActionBtn(a))
      .join('')}</div>`;
  }

  function renderExtractionRecoveryPanel(report, opts = {}) {
    const host = opts.host || global.document?.getElementById('extractionRecoveryPanel');
    if (!host) return;

    const show = !!(report && report.showRecovery);
    host.classList.toggle('hidden', !show);
    host.classList.toggle('extractionRecoveryPanel--blocked', !!(report && report.blockRender));
    if (!show) {
      host.innerHTML = '';
      return;
    }

    const t = opts.t || ((k) => k);
    const safe = report.outputSafe && !report.blockRender;
    const lead =
      report.message ||
      report.guidance?.lead ||
      (safe
        ? t('extractionRecoveryLeadOk') || 'Review suggested items before export.'
        : t('extractionRecoveryLeadBlock') ||
          'We read your file but need a few confirmations before showing a polished CV.');

    host.innerHTML = `
      <div class="extractionRecoveryHead">
        <span class="kicker">${esc(t('extractionRecoveryKicker') || 'Extraction recovery')}</span>
        <h3>${esc(t('extractionRecoveryTitle') || 'Fix extraction before preview')}</h3>
        <p class="extractionRecoveryLead">${esc(lead)}</p>
        ${
          !safe
            ? `<p class="extractionRecoveryBanner" role="status">${esc(
                t('extractionRecoveryBlocked') ||
                  'CV preview is paused — corrupted or uncertain content will not be styled as a final CV.'
              )}</p>`
            : ''
        }
        ${renderPrimaryActions(report.primaryActions || report.guidance?.primaryActions || [])}
      </div>
      <section class="extractionRecoveryBlock" aria-labelledby="extractionRecoveryIssuesTitle">
        <h4 id="extractionRecoveryIssuesTitle">${esc(t('extractionRecoveryIssues') || 'What needs attention')}</h4>
        ${renderList(report.detectedIssues || [], t('extractionRecoveryIssuesEmpty') || 'No open issues.')}
      </section>
      ${renderSuggestions(report.suggestions || report.guidance?.suggestions || [])}
      <section class="extractionRecoveryBlock" aria-labelledby="extractionRecoveryCandidatesTitle">
        <h4 id="extractionRecoveryCandidatesTitle">${esc('Header candidates')}</h4>
        ${renderCandidates(report.diagnostics || {})}
      </section>
      <section class="extractionRecoveryBlock" aria-labelledby="extractionRecoveryPagesTitle">
        <h4 id="extractionRecoveryPagesTitle">${esc('Pages detected')}</h4>
        ${renderPages(report.diagnostics || {})}
      </section>
      <section class="extractionRecoveryBlock" aria-labelledby="extractionRecoveryMetricsTitle">
        <h4 id="extractionRecoveryMetricsTitle">${esc('Extraction diagnostics')}</h4>
        ${renderConfidenceSummary(report)}
      </section>
      <section class="extractionRecoveryBlock" aria-labelledby="extractionRecoveryMissingTitle">
        <h4 id="extractionRecoveryMissingTitle">${esc(t('extractionRecoveryMissing') || 'Missing Sections')}</h4>
        ${renderMissingSections(report.missingSections || [])}
      </section>
      <section class="extractionRecoveryBlock" aria-labelledby="extractionRecoveryLowTitle">
        <h4 id="extractionRecoveryLowTitle">${esc(t('extractionRecoveryLowConf') || 'Low Confidence Fields')}</h4>
        ${renderLowConfidence(report.lowConfidenceFields || [])}
      </section>
      ${
        report.blockRender
          ? `<div class="extractionRecoveryFooter"><button type="button" class="btn small ghost extractionRecoveryFix" data-recovery-action="continue_partial">${esc(
              'Continue with partial data'
            )}</button></div>`
          : ''
      }
    `;

    if (!host._recoveryBound) {
      host._recoveryBound = true;
      host.addEventListener('click', (e) => {
        const btn = e.target.closest('[data-recovery-action]');
        if (!btn) return;
        if (typeof opts.onFix === 'function') {
          opts.onFix(btn.dataset.recoveryAction, btn.dataset.recoveryField || '', {
            value: btn.dataset.recoveryValue || '',
            page: btn.dataset.recoveryPage ? Number(btn.dataset.recoveryPage) : null,
          });
        }
      });
    }
  }

  global.HirelyExtractionRecoveryPanel = {
    renderExtractionRecoveryPanel,
    FIELD_ACTION_MAP,
  };
})(typeof window !== 'undefined' ? window : globalThis);
