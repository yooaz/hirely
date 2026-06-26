/**
 * HIRELY H5 — recruiter quality audit (post-extraction).
 * Deterministic checks on cvData only — no invented fields or AI hallucination.
 */

import { extractDateRangeFromText } from '../parsing/parser-recovery.js';
import { analyzeAts } from './ats-analyzer.js';
import { resolveChecklistProfile } from './recruiter-checklist-source.js';

export const RECRUITER_QUALITY_V1 = 'HIRELY_RECRUITER_QUALITY_V1';

const DATE_RANGE_RE =
  /\b((?:19|20)\d{2})\s*[-–—]\s*(present|présent|current|now|aujourd'?hui|actuel|\d{4})\b/i;
const YEAR_RE = /\b((?:19|20)\d{2})\b/g;
const YEAR_SINGLE_RE = /\b((?:19|20)\d{2})\b/;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const METRIC_RE =
  /\d+\s*%|\d[\d\s.,]*\s*(k|K|M|m|€|\$|£)|[€$£]\s?\d|\b\d{2,}\s*(users|clients|projects|people|personnes|projets)\b/i;
const ACTION_RE =
  /\b(created|built|designed|managed|led|delivered|developed|implemented|launched|optimized|improved|increased|reduced|grew|achieved|collaborated|créé|conçu|dirigé|géré|livré|augmenté|réduit)\b/i;
const PRESENT_RE = /^(present|présent|current|now|aujourd'?hui|actuel)$/i;

const CHECK_IDS = [
  'missing_dates',
  'missing_contact',
  'timeline_gaps',
  'duplicate_roles',
  'weak_descriptions',
  'ats_compatibility',
];

function normKey(s) {
  return String(s || '')
    .toLowerCase()
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .trim();
}

function lineHasDate(text) {
  const t = String(text || '');
  return DATE_RANGE_RE.test(t) || YEAR_SINGLE_RE.test(t);
}

function yearFromEnd(end) {
  const e = String(end || '').trim();
  if (!e) return null;
  if (PRESENT_RE.test(e)) return new Date().getFullYear();
  const y = e.match(/\b((?:19|20)\d{2})\b/);
  return y ? Number(y[1]) : null;
}

function yearFromStart(start) {
  const s = String(start || '').trim();
  if (!s) return null;
  const y = s.match(/\b((?:19|20)\d{2})\b/);
  return y ? Number(y[1]) : null;
}

/**
 * Normalize experience rows from cvData (strings or structured objects).
 * @param {object} cvData
 */
export function collectExperienceRows(cvData) {
  const rows = [];
  const structured = cvData?.experiences;
  if (Array.isArray(structured) && structured.length) {
    for (const e of structured) {
      if (!e) continue;
      if (typeof e === 'string') {
        rows.push({ line: e.trim(), role: '', company: '', startDate: '', endDate: '', bullets: [] });
        continue;
      }
      rows.push({
        line: [e.role, e.company, e.dates || e.startDate].filter(Boolean).join(' — '),
        role: String(e.role || '').trim(),
        company: String(e.company || '').trim(),
        startDate: String(e.startDate || '').trim(),
        endDate: String(e.endDate || '').trim(),
        bullets: (e.bullets || []).map((b) => String(b || '').trim()).filter(Boolean),
      });
    }
  }
  if (!rows.length) {
    for (const line of cvData?.experience || []) {
      const t = String(line || '').trim();
      if (!t) continue;
      const dates = extractDateRangeFromText(t);
      rows.push({
        line: t,
        role: '',
        company: '',
        startDate: dates.startDate || '',
        endDate: dates.endDate || '',
        bullets: [],
      });
    }
  }
  return rows;
}

function checkMissingDates(rows) {
  const findings = [];
  const missing = rows.filter((r) => {
    const blob = [r.line, r.role, r.company, ...(r.bullets || [])].join(' ');
    return !r.startDate && !lineHasDate(blob);
  });
  for (const r of missing.slice(0, 5)) {
    const label = r.role || r.company || r.line.slice(0, 72);
    findings.push({
      severity: 'medium',
      evidence: r.line.slice(0, 120),
      message: `Dates manquantes : « ${label} »`,
    });
  }
  const status = !rows.length ? 'skip' : missing.length ? (missing.length >= rows.length ? 'fail' : 'warn') : 'ok';
  return { id: 'missing_dates', status, count: missing.length, total: rows.length, findings };
}

function checkMissingContact(cvData) {
  const findings = [];
  const email = String(cvData?.email || '').trim();
  const phone = String(cvData?.phone || '').trim();
  const linkedin = String(cvData?.linkedin || '').trim();
  const location = String(cvData?.location || '').trim();

  if (!EMAIL_RE.test(email)) {
    findings.push({ severity: 'high', evidence: email || '(vide)', message: 'Email manquant ou invalide' });
  }
  if (!phone) {
    findings.push({ severity: 'medium', evidence: '(vide)', message: 'Téléphone absent' });
  }
  if (!linkedin) {
    findings.push({ severity: 'low', evidence: '(vide)', message: 'LinkedIn absent' });
  }
  if (!location) {
    findings.push({ severity: 'low', evidence: '(vide)', message: 'Localisation absente' });
  }

  const missingCore = !EMAIL_RE.test(email) || !phone;
  const status = missingCore ? 'fail' : findings.length ? 'warn' : 'ok';
  return { id: 'missing_contact', status, count: findings.length, findings };
}

function checkTimelineGaps(rows) {
  const intervals = [];
  for (const r of rows) {
    let start = yearFromStart(r.startDate);
    let end = yearFromEnd(r.endDate);
    const blob = r.line;
    if (!start || !end) {
      const d = extractDateRangeFromText(blob);
      start = start || yearFromStart(d.startDate);
      end = end || yearFromEnd(d.endDate);
    }
    if (!start && blob) {
      const years = [...blob.matchAll(YEAR_RE)].map((m) => Number(m[1]));
      if (years.length >= 2) {
        start = Math.min(...years);
        end = Math.max(...years);
      } else if (years.length === 1) {
        start = years[0];
        end = years[0];
      }
    }
    if (start && end && end >= start) {
      intervals.push({ start, end, label: r.role || r.company || r.line.slice(0, 60) });
    }
  }

  intervals.sort((a, b) => a.start - b.start);
  const findings = [];
  for (let i = 0; i < intervals.length - 1; i++) {
    const cur = intervals[i];
    const next = intervals[i + 1];
    const gapYears = next.start - cur.end;
    if (gapYears > 1) {
      findings.push({
        severity: gapYears >= 3 ? 'medium' : 'low',
        evidence: `${cur.label} (${cur.end}) → ${next.label} (${next.start})`,
        message: `Écart chronologique ~${gapYears} an${gapYears > 1 ? 's' : ''} entre deux expériences`,
      });
    }
  }

  const status = intervals.length < 2 ? 'skip' : findings.length ? 'warn' : 'ok';
  return { id: 'timeline_gaps', status, count: findings.length, findings };
}

function checkDuplicateRoles(rows) {
  const seen = new Map();
  const findings = [];
  for (const r of rows) {
    const roleKey = normKey(r.role || r.line.replace(DATE_RANGE_RE, '').slice(0, 80));
    const companyKey = normKey(r.company);
    const key = companyKey ? `${roleKey}|${companyKey}` : roleKey;
    if (!key || key.length < 4) continue;
    if (seen.has(key)) {
      findings.push({
        severity: 'medium',
        evidence: r.line.slice(0, 120),
        message: `Doublon possible : « ${r.role || r.line.slice(0, 48)} »`,
        duplicateOf: seen.get(key),
      });
    } else {
      seen.set(key, r.line.slice(0, 80));
    }
  }
  const status = !rows.length ? 'skip' : findings.length ? 'warn' : 'ok';
  return { id: 'duplicate_roles', status, count: findings.length, findings };
}

function checkWeakDescriptions(cvData, rows) {
  const findings = [];
  const expLines = (cvData?.experience || []).map((l) => String(l || '').trim()).filter(Boolean);
  const bullets = rows.flatMap((r) => r.bullets || []);
  const candidates = [...expLines, ...bullets].filter((l) => l.length > 0);

  const shortLines = candidates.filter((l) => l.length < 28 && !METRIC_RE.test(l));
  for (const line of shortLines.slice(0, 3)) {
    findings.push({
      severity: 'low',
      evidence: line.slice(0, 100),
      message: 'Description courte — peu de contexte pour un recruteur',
    });
  }

  const actionCount = candidates.filter((l) => ACTION_RE.test(l)).length;
  if (candidates.length >= 2 && actionCount < 2) {
    findings.push({
      severity: 'medium',
      evidence: `${actionCount} ligne(s) avec verbe d'action sur ${candidates.length}`,
      message: 'Peu de verbes d\'action dans les descriptions',
    });
  }

  const metricCount = candidates.filter((l) => METRIC_RE.test(l)).length;
  if (candidates.length >= 2 && metricCount === 0) {
    findings.push({
      severity: 'medium',
      evidence: 'aucun chiffre détecté dans l\'expérience',
      message: 'Aucun résultat chiffré dans les expériences',
    });
  }

  const status = !candidates.length ? 'skip' : findings.length ? 'warn' : 'ok';
  return { id: 'weak_descriptions', status, count: findings.length, findings };
}

function checkAtsCompatibility(cvData) {
  const ats = analyzeAts(cvData);
  const findings = [];
  const failed = (ats?.breakdown || []).filter((c) => c.points < c.max * 0.5);
  for (const cat of failed) {
    const reasons = (cat.reasons || []).filter((r) => !r.ok).map((r) => r.t);
    findings.push({
      severity: cat.id === 'contact' || cat.id === 'experience' ? 'high' : 'medium',
      evidence: reasons.slice(0, 2).join(' · ') || `${cat.points}/${cat.max} pts`,
      message: `${cat.label} : ${cat.points}/${cat.max}`,
    });
  }

  const score = ats?.ats?.score ?? ats?.panel?.ats ?? 0;
  const status = score >= 70 ? 'ok' : score >= 45 ? 'warn' : 'fail';
  return {
    id: 'ats_compatibility',
    status,
    score,
    total: ats?.total ?? 0,
    findings,
    ats,
  };
}

function findingsToFixes(checks) {
  const fixes = [];
  const push = (fix) => {
    if (fixes.some((f) => f.id === fix.id)) return;
    fixes.push(fix);
  };

  for (const check of checks) {
    if (check.id === 'missing_dates' && check.count > 0) {
      push({
        id: 'exp-dates',
        severity: 'medium',
        issue: `${check.count} expérience(s) sans dates`,
        fix: 'Ajoutez des dates (ex. 2019–2023) à chaque poste listé.',
        category: 'missing_dates',
      });
    }
    if (check.id === 'missing_contact') {
      for (const f of check.findings || []) {
        if (f.message.includes('Email')) {
          push({
            id: 'email',
            severity: 'high',
            issue: f.message,
            fix: 'Ajoutez une adresse email professionnelle.',
            category: 'missing_contact',
          });
        }
        if (f.message.includes('Téléphone')) {
          push({
            id: 'phone',
            severity: 'medium',
            issue: f.message,
            fix: 'Ajoutez un numéro de téléphone.',
            category: 'missing_contact',
          });
        }
      }
    }
    if (check.id === 'timeline_gaps' && check.count > 0) {
      push({
        id: 'timeline-gap',
        severity: 'low',
        issue: `${check.count} écart(s) chronologique(s) détecté(s)`,
        fix: 'Expliquez les périodes sans emploi (formation, freelance, congé) ou vérifiez les dates.',
        category: 'timeline_gaps',
      });
    }
    if (check.id === 'duplicate_roles' && check.count > 0) {
      push({
        id: 'duplicate-roles',
        severity: 'medium',
        issue: `${check.count} doublon(s) d'expérience possible(s)`,
        fix: 'Fusionnez les entrées identiques ou précisez les missions distinctes.',
        category: 'duplicate_roles',
      });
    }
    if (check.id === 'weak_descriptions' && check.count > 0) {
      push({
        id: 'weak-desc',
        severity: 'medium',
        issue: 'Descriptions d\'expérience faibles',
        fix: 'Détaillez chaque poste avec verbes d\'action et résultats mesurables.',
        category: 'weak_descriptions',
      });
    }
    if (check.id === 'ats_compatibility' && check.status !== 'ok') {
      push({
        id: 'ats-compat',
        severity: check.status === 'fail' ? 'high' : 'medium',
        issue: `Compatibilité ATS ${check.score}%`,
        fix: 'Complétez contact, sections clés et formatage lisible pour les ATS.',
        category: 'ats_compatibility',
      });
    }
  }

  const order = { high: 0, medium: 1, low: 2 };
  fixes.sort((a, b) => (order[a.severity] ?? 9) - (order[b.severity] ?? 9));
  return fixes.slice(0, 10);
}

/**
 * Full recruiter quality audit on extracted cvData.
 * @param {object|null} cvData
 * @param {{ resumeData?: object }} [opts]
 */
export function auditRecruiterQuality(cvData, opts = {}) {
  const profile = resolveChecklistProfile({ resumeData: opts.resumeData, cvData }) || cvData;
  if (!profile || typeof profile !== 'object') {
    return {
      version: RECRUITER_QUALITY_V1,
      checks: CHECK_IDS.map((id) => ({ id, status: 'skip', findings: [] })),
      panel: { score: 0, ats: 0, checksOk: 0, checksWarn: 0, checksFail: 0 },
      fixes: [],
      ats: null,
      hallucinationSafe: true,
    };
  }

  const rows = collectExperienceRows(profile);
  const checks = [
    checkMissingDates(rows),
    checkMissingContact(profile),
    checkTimelineGaps(rows),
    checkDuplicateRoles(rows),
    checkWeakDescriptions(profile, rows),
    checkAtsCompatibility(profile),
  ];

  const checksOk = checks.filter((c) => c.status === 'ok').length;
  const checksWarn = checks.filter((c) => c.status === 'warn').length;
  const checksFail = checks.filter((c) => c.status === 'fail').length;
  const atsBlock = checks.find((c) => c.id === 'ats_compatibility');

  return {
    version: RECRUITER_QUALITY_V1,
    checks,
    panel: {
      score: atsBlock?.total ?? 0,
      ats: atsBlock?.score ?? 0,
      checksOk,
      checksWarn,
      checksFail,
      dimensions: checks.map((c) => ({
        id: c.id,
        status: c.status,
        count: c.count ?? (c.findings || []).length,
      })),
    },
    fixes: findingsToFixes(checks),
    ats: atsBlock?.ats ?? null,
    hallucinationSafe: true,
    source: 'cvData',
  };
}
