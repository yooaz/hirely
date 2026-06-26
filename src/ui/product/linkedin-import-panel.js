/**
 * LinkedIn import panel UI — multi-source status and merge summary.
 */
(function (global) {
  const ENGINE = 'LINKEDIN_IMPORT_V1';

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;');
  }

  function t(key, fallback) {
    if (typeof global.t === 'function') {
      const v = global.t(key);
      if (v && v !== key) return v;
    }
    return fallback || key;
  }

  function sourceLabel(type) {
    const map = {
      linkedin_pdf: t('liImportLinkedInPdf', 'LinkedIn PDF'),
      linkedin_export: t('liImportLinkedInExport', 'LinkedIn export'),
      resume_pdf: t('liImportResumePdf', 'Resume PDF'),
      resume_docx: t('liImportResumeDocx', 'Resume DOCX'),
      resume_other: t('liImportResume', 'Resume'),
      unknown: t('liImportUnknown', 'Document'),
    };
    return map[type] || type;
  }

  function render(result) {
    if (!result?.ready) {
      return `<div class="liImportEmpty">
        <p class="liImportTitle">${esc(t('liImportTitle', 'LinkedIn import'))}</p>
        <p class="liImportSub">${esc(t('liImportSub', 'Drop LinkedIn PDF, profile export (JSON/CSV), and resume PDF together — we merge the best data.'))}</p>
      </div>`;
    }

    const report = result.report || {};
    const sources = report.sources || [];
    const dupes = report.duplicates || [];
    const winners = report.winners || {};

    const sourceRows = sources
      .map(
        (s) => `<li class="liImportSource">
          <span class="liImportSourceName">${esc(s.fileName || sourceLabel(s.sourceType))}</span>
          <span class="liImportSourceType">${esc(sourceLabel(s.sourceType))}</span>
          <span class="liImportSourceScore">${s.quality ?? '—'}</span>
        </li>`
      )
      .join('');

    const winnerRows = Object.entries(winners)
      .slice(0, 6)
      .map(([k, v]) => `<li><strong>${esc(k)}</strong> ← ${esc(v)}</li>`)
      .join('');

    const dupeRows = dupes
      .slice(0, 5)
      .map((d) => `<li class="liImportDupe">${esc(d.kept || d.winner || d.a)} <span class="liImportDupeLbl">${esc(t('liImportDupeKept', 'kept'))}</span></li>`)
      .join('');

    return `<div class="liImportPanel" data-engine="${ENGINE}">
      <p class="liImportKicker">${esc(t('liImportMerged', 'Merged profile'))}</p>
      <p class="liImportConfidence">${esc(t('liImportConfidence', 'Merge confidence'))}: <strong>${result.confidence ?? '—'}</strong></p>
      <ul class="liImportSources">${sourceRows}</ul>
      ${winnerRows ? `<p class="liImportLbl">${esc(t('liImportBestFields', 'Best source per field'))}</p><ul class="liImportWinners">${winnerRows}</ul>` : ''}
      ${dupeRows ? `<p class="liImportLbl">${esc(t('liImportDupes', 'Duplicates resolved'))}</p><ul class="liImportDupes">${dupeRows}</ul>` : ''}
    </div>`;
  }

  function renderHost(host, result) {
    if (!host) return;
    host.innerHTML = render(result);
    host.dataset.ready = result?.ready ? 'true' : 'false';
  }

  global.HirelyLinkedInImport = {
    ENGINE,
    render,
    renderHost,
    sourceLabel,
  };
})(typeof window !== 'undefined' ? window : globalThis);
