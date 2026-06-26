/**
 * PDF Export V2 — premium packet builder (cover, summary, audit, notes, recommendations).
 * Fact-grounded from cvData + score report + recruiter command center audit.
 */

export const PDF_EXPORT_V2 = 'PDF_EXPORT_V2';

function clean(s) {
  return String(s || '').replace(/\s+/g, ' ').trim();
}

function contactLine(cv) {
  return [cv?.location, cv?.email, cv?.phone, cv?.linkedin, cv?.portfolio].filter(Boolean).map(clean).join(' · ');
}

/**
 * @param {object} input
 * @param {object} [input.cvData]
 * @param {object} [input.scoreReport]
 * @param {object} [input.recruiterAudit]
 * @param {string} [input.templateId]
 * @param {string} [input.templateName]
 */
export function buildPdfExportV2Packet(input = {}) {
  const cv = input.cvData || {};
  const score = input.scoreReport || {};
  const audit = input.recruiterAudit || {};
  const review = score.cvReview || score.trustedReview || {};
  const name = clean(cv.name) || 'Candidate';
  const title = clean(cv.title) || '';
  const summary = clean(cv.summary);
  const total = Math.round(Number(score.total ?? audit.executiveSummary?.score ?? 0));
  const confidence = Math.round(Number(audit.recruiterConfidence?.score ?? total));

  const strengths = (audit.strengths || review.strengths || []).slice(0, 6);
  const weaknesses = (audit.weaknesses || review.weaknesses || []).slice(0, 6);
  const missing = (audit.missing || review.missing || []).slice(0, 4);

  const recommendations = [];
  const nextActions = score.breakdown
    ?.filter((c) => c.max && c.points / c.max < 0.65)
    .map((c) => `Strengthen ${c.label || c.id} section`)
    .slice(0, 3);
  if (nextActions?.length) recommendations.push(...nextActions);
  for (const w of weaknesses.slice(0, 3)) {
    const label = w.label || w.labelKey || w.id;
    if (label) recommendations.push(`Address: ${label}`);
  }
  if (audit.atsCompatibility?.gaps?.length) {
    recommendations.push(...audit.atsCompatibility.gaps.slice(0, 2));
  }
  if (!recommendations.length) {
    recommendations.push('Profile is export-ready — verify contact details before sending.');
  }

  const breakdown = (score.breakdown || audit.atsCompatibility?.dimensions || []).slice(0, 6).map((c) => ({
    id: c.id,
    label: c.label || c.id,
    points: c.points ?? 0,
    max: c.max ?? 0,
    pct: c.max ? Math.round((c.points / c.max) * 100) : c.pct ?? 0,
  }));

  return {
    version: PDF_EXPORT_V2,
    generatedAt: new Date().toISOString().slice(0, 10),
    cover: {
      name,
      title,
      templateId: input.templateId || 'ats',
      templateName: input.templateName || 'Hirely',
      score: total,
      tier: audit.executiveSummary?.tier || score.band?.label || '—',
    },
    candidateSummary: {
      name,
      title,
      summary: summary || review.summary || '—',
      contact: contactLine(cv),
      experienceCount: (cv.experience || cv.experiences || []).filter(Boolean).length,
      skillsCount: (cv.skills || []).filter(Boolean).length,
      educationCount: (cv.education || []).filter(Boolean).length,
    },
    auditScore: {
      total,
      confidence,
      tier: audit.recruiterConfidence?.tier || (total >= 80 ? 'high' : total >= 55 ? 'moderate' : 'low'),
      headline: audit.executiveSummary?.headline || review.headline || '—',
      summary: audit.executiveSummary?.summary || review.summary || '',
      breakdown,
      atsScore: audit.atsCompatibility?.score ?? total,
      keywordPct: audit.keywordCoverage?.pct ?? null,
    },
    recruiterNotes: {
      strengths,
      weaknesses,
      missing,
      interviewRisks: (audit.interviewRiskAreas || []).slice(0, 5),
    },
    recommendations: [...new Set(recommendations)].slice(0, 6),
    includeAuditPacket: input.includeAuditPacket !== false,
  };
}
