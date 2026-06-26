/**
 * Recruiter review — local deterministic rules (no AI).
 */

import { NAME_UNCERTAIN_LABEL, TITLE_UNCERTAIN_LABEL } from '../parsing/parser-recovery.js';
import { computeProductScore } from './product-score.js';

const METRIC_RE =
  /\d+\s*%|\d[\d\s.,]*\s*(k|K|M|m|€|\$|£)|[€$£]\s?\d|\b\d{2,}\s*(users|clients|projects|people|personnes|projets)\b/i;
const ACTION_RE =
  /\b(created|built|designed|managed|led|delivered|developed|implemented|launched|optimized|improved|increased|reduced|grew|achieved|collaborated|créé|conçu|dirigé|géré|livré|augmenté|réduit)\b/i;

function pushFix(list, fix) {
  if (list.some((x) => x.id === fix.id)) return list;
  return [...list, fix];
}

function validLinkedIn(url) {
  const u = String(url || '').trim();
  if (!u) return false;
  return /linkedin\.com\/in\//i.test(u) || /^https?:\/\//i.test(u);
}

function validEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(email || '').trim());
}

/**
 * @param {object|null} cvData
 * @returns {{ atsScore: number, band: object, fixes: Array, score: object|null }}
 */
export function buildRecruiterReview(cvData) {
  if (!cvData || typeof cvData !== 'object') {
    return { atsScore: 0, band: { label: '—', desc: '' }, fixes: [], score: null };
  }

  const p = cvData;
  const score = computeProductScore(p);
  let fixes = [];

  const name = String(p.name || '').trim();
  if (!name || name === NAME_UNCERTAIN_LABEL || name === 'Nom à compléter') {
    fixes = pushFix(fixes, {
      id: 'name',
      severity: 'high',
      issue: 'Nom manquant',
      fix: 'Ajoutez votre nom complet en haut du CV.',
    });
  }

  const title = String(p.title || '').trim();
  if (!title || title === TITLE_UNCERTAIN_LABEL) {
    fixes = pushFix(fixes, {
      id: 'title',
      severity: 'high',
      issue: 'Intitulé de poste manquant',
      fix: 'Indiquez clairement votre métier (ex. Graphiste senior).',
    });
  }

  if (!validEmail(p.email)) {
    fixes = pushFix(fixes, {
      id: 'email',
      severity: 'high',
      issue: 'Email manquant ou invalide',
      fix: 'Ajoutez une adresse email professionnelle.',
    });
  }

  if (!String(p.phone || '').trim()) {
    fixes = pushFix(fixes, {
      id: 'phone',
      severity: 'medium',
      issue: 'Téléphone absent',
      fix: 'Ajoutez un numéro pour faciliter la prise de contact.',
    });
  }

  if (!validLinkedIn(p.linkedin)) {
    fixes = pushFix(fixes, {
      id: 'linkedin',
      severity: 'medium',
      issue: 'LinkedIn manquant',
      fix: 'Ajoutez votre profil LinkedIn dans les coordonnées.',
    });
  }

  const summary = String(p.summary || '').trim();
  if (!summary || summary.length < 50) {
    fixes = pushFix(fixes, {
      id: 'summary',
      severity: 'high',
      issue: 'Résumé faible ou absent',
      fix: 'Rédigez 2–3 phrases sur votre profil et votre valeur.',
    });
  } else if (summary.length > 320) {
    fixes = pushFix(fixes, {
      id: 'summary-long',
      severity: 'low',
      issue: 'Résumé trop long',
      fix: 'Gardez le résumé sous 320 caractères pour une lecture rapide.',
    });
  }

  const exp = Array.isArray(p.experience) ? p.experience.filter(Boolean) : [];
  if (!exp.length) {
    fixes = pushFix(fixes, {
      id: 'experience',
      severity: 'high',
      issue: 'Expériences absentes',
      fix: 'Listez au moins une expérience professionnelle.',
    });
  } else {
    const metricLines = exp.filter((l) => METRIC_RE.test(String(l))).length;
    const actionLines = exp.filter((l) => ACTION_RE.test(String(l))).length;
    if (metricLines === 0) {
      fixes = pushFix(fixes, {
        id: 'metrics',
        severity: 'high',
        issue: 'Aucun résultat chiffré',
        fix: 'Ajoutez des réalisations mesurables (+20 %, 3 projets, etc.).',
      });
    }
    if (actionLines < 2) {
      fixes = pushFix(fixes, {
        id: 'impact',
        severity: 'medium',
        issue: 'Peu de réalisations concrètes',
        fix: 'Formulez vos missions avec des verbes d\'action et des résultats.',
      });
    }
    if (exp.length > 6) {
      fixes = pushFix(fixes, {
        id: 'experience-long',
        severity: 'low',
        issue: 'Liste d\'expériences dense',
        fix: 'Gardez les 4–5 expériences les plus pertinentes.',
      });
    }
  }

  const edu = Array.isArray(p.education) ? p.education.filter(Boolean) : [];
  if (!edu.length) {
    fixes = pushFix(fixes, {
      id: 'education',
      severity: 'medium',
      issue: 'Formation absente',
      fix: 'Ajoutez votre parcours formation ou certifications.',
    });
  }

  const skills = (p.skills || []).filter(Boolean).length;
  const tools = (p.tools || []).filter(Boolean).length;
  if (skills + tools < 3) {
    fixes = pushFix(fixes, {
      id: 'skills',
      severity: 'medium',
      issue: 'Compétences insuffisantes',
      fix: 'Listez 6–10 compétences et outils clés pour votre métier.',
    });
  }

  if (!String(p.portfolio || '').trim() && !String(p.location || '').trim()) {
    fixes = pushFix(fixes, {
      id: 'portfolio',
      severity: 'low',
      issue: 'Portfolio ou localisation absents',
      fix: 'Ajoutez un lien portfolio ou votre ville.',
    });
  }

  const severityOrder = { high: 0, medium: 1, low: 2 };
  fixes.sort((a, b) => (severityOrder[a.severity] ?? 9) - (severityOrder[b.severity] ?? 9));

  return {
    atsScore: score?.score ?? score?.total ?? 0,
    band: score?.band ?? { label: '—', desc: '' },
    total: score?.score ?? score?.total ?? 0,
    breakdown: score?.breakdown ?? [],
    strengths: score?.strengths ?? [],
    weaknesses: score?.weaknesses ?? [],
    recommendations: score?.recommendations ?? [],
    score,
    fixes: fixes.slice(0, 8),
  };
}
