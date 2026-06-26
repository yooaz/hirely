/**
 * Recruiter Command Center UI — McKinsey / Bain / BCG audit presentation.
 */
(function (global) {
  const ENGINE = 'RECRUITER_COMMAND_CENTER_V2';

  function esc(s) {
    return String(s ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function t(key, fallback) {
    if (typeof global.t === 'function') {
      const v = global.t(key);
      if (v && v !== key) return v;
    }
    return fallback || key;
  }

  function tierClass(tier) {
    if (tier === 'high' || tier === 'strong' || tier === 'ready') return 'rccTier--high';
    if (tier === 'moderate' || tier === 'good' || tier === 'competitive') return 'rccTier--mid';
    return 'rccTier--low';
  }

  function listItems(rows, emptyText) {
    if (!rows?.length) return `<li class="rccListEmpty">${esc(emptyText)}</li>`;
    return rows
      .map((row) => {
        const label = row.labelKey ? t(row.labelKey, row.label) : row.label || row;
        const mark = row.mark === 'ok' ? '✓' : row.mark === 'warn' ? '!' : row.level === 'high' ? '▲' : '·';
        const cls =
          row.mark === 'ok' || row.kind === 'strength'
            ? 'rccListItem--ok'
            : row.level === 'high'
              ? 'rccListItem--risk-high'
              : 'rccListItem--warn';
        return `<li class="rccListItem ${cls}"><span class="rccListMark" aria-hidden="true">${mark}</span><span>${esc(label)}</span></li>`;
      })
      .join('');
  }

  function barRow(label, pct) {
    const n = Math.max(0, Math.min(100, Math.round(Number(pct) || 0)));
    return `<div class="rccBarRow">
      <div class="rccBarMeta"><span>${esc(label)}</span><span class="rccBarPct">${n}%</span></div>
      <div class="rccBarTrack"><span class="rccBarFill" style="width:${n}%"></span></div>
    </div>`;
  }

  function detailsSection(id, title, body, open = false) {
    return `<details class="rccSection" id="${id}" ${open ? 'open' : ''}>
      <summary class="rccSectionHead"><span class="rccSectionTitle">${esc(title)}</span><span class="rccSectionChevron" aria-hidden="true"></span></summary>
      <div class="rccSectionBody">${body}</div>
    </details>`;
  }

  function renderAudit(audit) {
    if (!audit?.ready) {
      return `<div class="rccEmpty">
        <p class="rccEmptyTitle">${esc(t('rccEmptyTitle', 'Recruiter audit'))}</p>
        <p class="rccEmptySub">${esc(t('rccEmptySub', 'Import your CV to generate a professional recruiter audit.'))}</p>
      </div>`;
    }

    const conf = audit.recruiterConfidence || {};
    const exec = audit.executiveSummary || {};
    const ats = audit.atsCompatibility || {};
    const atsPro = audit.atsPro || {};
    const kw = audit.keywordCoverage || {};
    const market = audit.marketPositioning || {};
    const salary = audit.salaryEstimation;
    const risks = audit.interviewRiskAreas || [];

    const insightBlock = `<section class="rccInsightBlock">
      <p class="rccKicker">${esc(t('rccKicker', 'Executive summary'))}</p>
      <h4 class="rccInsightHeadline">${esc(exec.headlineKey ? t(exec.headlineKey, exec.headline) : exec.headline)}</h4>
      <p class="rccInsightSummary">${esc(exec.summaryKey ? t(exec.summaryKey, exec.summary) : exec.summary)}</p>
    </section>`;

    const strengthsWeak = `<div class="rccTwinCol">
      <section class="rccCard rccCard--strengths">
        <h4 class="rccCardTitle">${esc(t('rccStrengths', 'Strengths'))}</h4>
        <ul class="rccList">${listItems(audit.strengths, t('cvReviewEmptyStrengths', 'No strengths detected yet.'))}</ul>
      </section>
      <section class="rccCard rccCard--weaknesses">
        <h4 class="rccCardTitle">${esc(t('rccWeaknesses', 'Weaknesses'))}</h4>
        <ul class="rccList">${listItems(audit.weaknesses, t('cvReviewEmptyWeaknesses', 'Nothing to flag.'))}</ul>
      </section>
    </div>`;

    const atsBody = `<div class="rccMetricHero ${tierClass(ats.tier)}">
        <span class="rccMetricHeroVal">${ats.score}</span>
        <span class="rccMetricHeroLbl">${esc(t('rccAtsScore', 'ATS compatibility'))}</span>
      </div>
      ${ats.confidence ? `<p class="rccSubLbl">${esc(t('atsProConfidence', 'ATS confidence'))}: <strong>${ats.confidence.score}</strong> (${esc(ats.confidence.tier)})</p>` : ''}
      ${(ats.dimensions || []).map((d) => barRow(d.label, d.pct)).join('')}
      ${ats.highlights?.length ? `<ul class="rccChipList rccChipList--ok">${ats.highlights.map((h) => `<li>${esc(h)}</li>`).join('')}</ul>` : ''}
      ${ats.gaps?.length ? `<ul class="rccChipList rccChipList--warn">${ats.gaps.map((g) => `<li>${esc(g)}</li>`).join('')}</ul>` : ''}
      ${(ats.risks || []).length ? `<p class="rccSubLbl">${esc(t('atsProRisks', 'ATS risks'))}</p><ul class="rccList rccList--risks">${listItems(ats.risks, '')}</ul>` : ''}
      ${(ats.recommendations || []).length ? `<p class="rccSubLbl">${esc(t('atsProRecommendations', 'ATS recommendations'))}</p><ul class="rccList">${ats.recommendations.map((r) => `<li class="rccListItem"><span class="rccListMark" aria-hidden="true">→</span><span>${esc(r.action)}</span></li>`).join('')}</ul>` : ''}
      ${(ats.benchmarks || []).length ? `<p class="rccSubLbl">${esc(t('atsProBenchmarks', 'Platform benchmarks'))}</p><div class="rccBenchGrid">${ats.benchmarks.map((b) => `<div class="rccBenchCard ${tierClass(b.tier)}"><span class="rccBenchName">${esc(b.label)}</span><span class="rccBenchScore">${b.score}</span></div>`).join('')}</div>` : ''}`;

    const kwBody = `<div class="rccMetricHero ${tierClass(kw.tier)}">
        <span class="rccMetricHeroVal">${kw.pct}%</span>
        <span class="rccMetricHeroLbl">${esc(t('rccKeywordCoverage', 'Keyword coverage'))}</span>
      </div>
      ${kw.matched?.length ? `<p class="rccSubLbl">${esc(t('rccMatched', 'Matched'))}</p><ul class="rccChipList rccChipList--ok">${kw.matched.map((k) => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}
      ${kw.missing?.length ? `<p class="rccSubLbl">${esc(t('rccMissingKw', 'Gaps'))}</p><ul class="rccChipList rccChipList--warn">${kw.missing.slice(0, 6).map((k) => `<li>${esc(k)}</li>`).join('')}</ul>` : ''}`;

    const marketBody = `<p class="rccInsightHeadline rccInsightHeadline--sm ${tierClass(market.tier)}">${esc(market.headline)}</p>
      <p class="rccBodyText">${esc(market.narrative)}</p>
      ${market.signals?.length ? `<ul class="rccChipList">${market.signals.map((s) => `<li>${esc(s)}</li>`).join('')}</ul>` : ''}`;

    const salaryBody = salary
      ? `<p class="rccSalaryRange">${esc(salary.label)}</p>
         <p class="rccBodyText rccDisclaimer">${esc(t(salary.disclaimerKey, salary.disclaimer))}</p>
         <dl class="rccMetaDl">
           <div><dt>${esc(t('rccSeniority', 'Seniority'))}</dt><dd>${esc(salary.seniority)}</dd></div>
           <div><dt>${esc(t('rccExperience', 'Experience'))}</dt><dd>${salary.years} ${esc(t('rccYears', 'years'))}</dd></div>
         </dl>`
      : `<p class="rccBodyText">${esc(t('rccSalaryUnavailable', 'Add a clear job title to estimate salary range.'))}</p>`;

    const riskBody = `<ul class="rccList rccList--risks">${listItems(risks, t('rccNoRisks', 'No major interview risks detected.'))}</ul>`;

    const confBody = `${(conf.factors || []).map((f) => barRow(f.label, f.pct)).join('')}
      <p class="rccBodyText">${esc(t('rccConfidenceNote', 'Composite confidence based on recruiter score, extraction quality, and profile completeness.'))}</p>`;

    return `${insightBlock}
      ${strengthsWeak}
      ${detailsSection('rccAts', t('rccAtsCompat', 'ATS compatibility'), atsBody, true)}
      ${detailsSection('rccKw', t('rccKeywordCoverage', 'Keyword coverage'), kwBody)}
      ${detailsSection('rccMarket', t('rccMarketPosition', 'Market positioning'), marketBody)}
      ${detailsSection('rccSalary', t('rccSalaryEst', 'Salary estimation'), salaryBody)}
      ${detailsSection('rccRisks', t('rccInterviewRisks', 'Interview risk areas'), riskBody, risks.some((r) => r.level === 'high'))}
      ${detailsSection('rccConf', t('rccRecruiterConfidence', 'Recruiter confidence score'), confBody)}`;
  }

  function collectSlimActions(audit, max = 3) {
    const rows = [];
    (audit?.weaknesses || []).forEach((row) => rows.push({ ...row, kind: 'weakness' }));
    (audit?.interviewRiskAreas || []).forEach((row) => {
      if (row?.level === 'high') rows.push({ label: row.label, mark: 'warn', kind: 'risk' });
    });
    if (audit?.atsCompatibility?.gaps?.length) {
      audit.atsCompatibility.gaps.slice(0, 2).forEach((g) => rows.push({ label: g, mark: 'warn', kind: 'gap' }));
    }
    if (!rows.length && audit?.strengths?.length) {
      audit.strengths.slice(0, max).forEach((row) => rows.push({ ...row, mark: 'ok', kind: 'strength' }));
    }
    return rows.slice(0, max);
  }

  function renderSlim(audit) {
    if (!audit?.ready) {
      return `<div class="rccEmpty rccSlimOnly">
        <p class="rccEmptyTitle">${esc(t('reviewSlimTitle', 'Review'))}</p>
        <p class="rccEmptySub">${esc(t('rccEmptySub', 'Import your CV to see what to check.'))}</p>
      </div>`;
    }
    const actions = collectSlimActions(audit, 3);
    const list = actions.length
      ? `<ul class="rccList rccSlimList">${listItems(actions, t('reviewSlimClear', 'Nothing critical to fix.'))}</ul>`
      : `<p class="rccBodyText rccSlimOnly">${esc(t('reviewSlimClear', 'Nothing critical to fix.'))}</p>`;
    return `<div class="rccSlimOnly">
      <p class="rccKicker">${esc(t('reviewSlimKicker', 'Check'))}</p>
      ${list}
    </div>
    <div class="rccFullOnly">${renderAudit(audit)}</div>`;
  }

  function render(host, audit, opts = {}) {
    if (!host) return;
    const slim = opts.slim !== false && !global.document?.documentElement?.classList?.contains('debug-mode');
    host.innerHTML = slim ? renderSlim(audit) : renderAudit(audit);
    host.dataset.engine = ENGINE;
    host.dataset.ready = audit?.ready ? 'true' : 'false';
    host.dataset.mode = slim ? 'slim' : 'full';
  }

  function renderConfidenceBadge(host, audit) {
    if (!host || !audit?.recruiterConfidence) return;
    const conf = audit.recruiterConfidence;
    host.innerHTML = `<span class="rccConfBadge ${tierClass(conf.tier)}">
      <span class="rccConfBadgeLbl">${esc(t('rccConfidenceShort', 'Confidence'))}</span>
      <span class="rccConfBadgeVal">${conf.score}</span>
    </span>`;
  }

  global.HirelyRecruiterCommandCenter = {
    ENGINE,
    render,
    renderAudit,
    renderConfidenceBadge,
  };
})(typeof window !== 'undefined' ? window : globalThis);
