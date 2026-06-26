/**
 * PDF Export V2 — premium A4 pages (cover, audit packet, CV sheets).
 * Preview ≡ export: CV pages cloned from live #cvDoc stack.
 */

(function (global) {
  const A4_W = 794;
  const A4_H = 1123;
  const ENGINE = 'PDF_EXPORT_V2';

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function label(row) {
    return row?.label || row?.labelKey || row?.id || '';
  }

  function listHtml(rows, empty) {
    if (!rows?.length) return `<p class="pdfV2Muted">${esc(empty)}</p>`;
    return `<ul class="pdfV2List">${rows
      .map((r) => `<li>${esc(typeof r === 'string' ? r : label(r))}</li>`)
      .join('')}</ul>`;
  }

  function barRows(breakdown) {
    if (!breakdown?.length) return '';
    return breakdown
      .map(
        (d) => `<div class="pdfV2BarRow">
        <div class="pdfV2BarMeta"><span>${esc(d.label)}</span><span>${d.pct}%</span></div>
        <div class="pdfV2BarTrack"><span style="width:${d.pct}%"></span></div>
      </div>`
      )
      .join('');
  }

  function pageShell(inner, kind) {
    const el = document.createElement('div');
    el.className = `pdfV2Page pdfV2Page--${kind}`;
    el.style.width = `${A4_W}px`;
    el.style.height = `${A4_H}px`;
    el.style.boxSizing = 'border-box';
    el.innerHTML = inner;
    return el;
  }

  function buildCoverPage(packet) {
    const c = packet.cover || {};
    return pageShell(
      `<div class="pdfV2Cover">
        <p class="pdfV2Brand">Hirely</p>
        <p class="pdfV2CoverKicker">Professional CV Export</p>
        <h1 class="pdfV2CoverName">${esc(c.name)}</h1>
        <p class="pdfV2CoverTitle">${esc(c.title)}</p>
        <div class="pdfV2CoverScore"><span class="pdfV2CoverScoreVal">${c.score ?? '—'}</span><span class="pdfV2CoverScoreLbl">Recruiter score</span></div>
        <dl class="pdfV2CoverMeta">
          <div><dt>Template</dt><dd>${esc(c.templateName)}</dd></div>
          <div><dt>Generated</dt><dd>${esc(packet.generatedAt)}</dd></div>
        </dl>
      </div>`,
      'cover'
    );
  }

  function buildSummaryPage(packet) {
    const s = packet.candidateSummary || {};
    return pageShell(
      `<div class="pdfV2Sheet">
        <p class="pdfV2Kicker">Candidate summary</p>
        <h2 class="pdfV2H2">${esc(s.name)}</h2>
        <p class="pdfV2Sub">${esc(s.title)}</p>
        ${s.contact ? `<p class="pdfV2Contact">${esc(s.contact)}</p>` : ''}
        <div class="pdfV2Stats">
          <div><span class="pdfV2StatVal">${s.experienceCount}</span><span class="pdfV2StatLbl">Experience</span></div>
          <div><span class="pdfV2StatVal">${s.skillsCount}</span><span class="pdfV2StatLbl">Skills</span></div>
          <div><span class="pdfV2StatVal">${s.educationCount}</span><span class="pdfV2StatLbl">Education</span></div>
        </div>
        <h3 class="pdfV2H3">Professional summary</h3>
        <p class="pdfV2Body">${esc(s.summary)}</p>
      </div>`,
      'summary'
    );
  }

  function buildAuditPage(packet) {
    const a = packet.auditScore || {};
    return pageShell(
      `<div class="pdfV2Sheet">
        <p class="pdfV2Kicker">Audit score</p>
        <div class="pdfV2ScoreHero">
          <div class="pdfV2ScoreBlock"><span class="pdfV2ScoreNum">${a.total ?? '—'}</span><span class="pdfV2ScoreLbl">Recruiter</span></div>
          <div class="pdfV2ScoreBlock"><span class="pdfV2ScoreNum">${a.confidence ?? '—'}</span><span class="pdfV2ScoreLbl">Confidence</span></div>
          <div class="pdfV2ScoreBlock"><span class="pdfV2ScoreNum">${a.atsScore ?? '—'}</span><span class="pdfV2ScoreLbl">ATS</span></div>
        </div>
        <p class="pdfV2H3">${esc(a.headline)}</p>
        <p class="pdfV2Body">${esc(a.summary)}</p>
        ${barRows(a.breakdown)}
        ${a.keywordPct != null ? `<p class="pdfV2Muted">Keyword coverage: ${a.keywordPct}%</p>` : ''}
      </div>`,
      'audit'
    );
  }

  function buildNotesPage(packet) {
    const n = packet.recruiterNotes || {};
    return pageShell(
      `<div class="pdfV2Sheet pdfV2Sheet--notes">
        <p class="pdfV2Kicker">Recruiter notes</p>
        <div class="pdfV2Twin">
          <div><h3 class="pdfV2H3">Strengths</h3>${listHtml(n.strengths, 'No strengths flagged.')}</div>
          <div><h3 class="pdfV2H3">Weaknesses</h3>${listHtml(n.weaknesses, 'No weaknesses flagged.')}</div>
        </div>
        <h3 class="pdfV2H3">Missing information</h3>
        ${listHtml(n.missing, 'No critical gaps.')}
        <h3 class="pdfV2H3">Interview risk areas</h3>
        ${listHtml(n.interviewRisks, 'No major risks detected.')}
      </div>`,
      'notes'
    );
  }

  function buildRecommendationsPage(packet) {
    const recs = packet.recommendations || [];
    return pageShell(
      `<div class="pdfV2Sheet">
        <p class="pdfV2Kicker">Recommendations</p>
        <h2 class="pdfV2H2">Next steps before sending</h2>
        ${listHtml(recs, 'No recommendations.')}
        <p class="pdfV2Disclaimer">This audit is generated from your imported CV content. Verify all facts before sharing with employers.</p>
      </div>`,
      'recommendations'
    );
  }

  function cloneCvPages(cvEl) {
    const sheets = cvEl?.querySelectorAll('.cvA4Stack .cvA4Sheet');
    if (sheets?.length) {
      return [...sheets].map((sheet, idx) => {
        const page = document.createElement('div');
        page.className = 'pdfV2Page pdfV2Page--cv';
        page.setAttribute('data-cv-page', String(idx + 1));
        page.style.width = `${A4_W}px`;
        page.style.height = `${A4_H}px`;
        page.style.boxSizing = 'border-box';
        const clone = sheet.cloneNode(true);
        clone.classList.remove('html2pdf__page-break-before');
        clone.style.margin = '0';
        clone.style.boxShadow = 'none';
        page.appendChild(clone);
        return page;
      });
    }
    const page = document.createElement('div');
    page.className = 'pdfV2Page pdfV2Page--cv';
    page.style.width = `${A4_W}px`;
    page.style.minHeight = `${A4_H}px`;
    page.style.boxSizing = 'border-box';
    const clone = cvEl.cloneNode(true);
    clone.style.transform = 'none';
    clone.style.width = `${A4_W}px`;
    clone.style.maxWidth = `${A4_W}px`;
    clone.style.boxShadow = 'none';
    page.appendChild(clone);
    return [page];
  }

  /**
   * @param {HTMLElement} cvEl
   * @param {object} packet
   */
  function buildExportRoot(cvEl, packet) {
    const root = document.createElement('div');
    root.id = 'pdfExportV2Root';
    root.className = 'pdfExportV2Root';
    root.setAttribute('aria-hidden', 'true');

    const pages = [];
    if (packet?.includeAuditPacket !== false) {
      pages.push(
        buildCoverPage(packet),
        buildSummaryPage(packet),
        buildAuditPage(packet),
        buildNotesPage(packet),
        buildRecommendationsPage(packet)
      );
    }
    pages.push(...cloneCvPages(cvEl));

    pages.forEach((p, i) => {
      if (i > 0) p.classList.add('pdfV2Page--break');
      root.appendChild(p);
    });

    root.style.cssText = `position:fixed;left:-99999px;top:0;width:${A4_W}px;z-index:-1;pointer-events:none;background:#fff`;
    global.document.body.appendChild(root);
    return root;
  }

  function removeExportRoot(root) {
    root?.remove();
  }

  function collectPages(root) {
    return root ? [...root.querySelectorAll('.pdfV2Page')] : [];
  }

  global.HirelyPdfExportV2 = {
    ENGINE,
    A4_W,
    A4_H,
    buildExportRoot,
    removeExportRoot,
    collectPages,
  };
})(typeof window !== 'undefined' ? window : globalThis);
