/**
 * HIRELY P4 — Cover letter engine.
 * Deterministic generation from resumeData / finalResumeData only — no invented experience.
 */

import { resumeDataToCvData } from '../resume-data.js';
import { NAME_UNCERTAIN_LABEL, TITLE_UNCERTAIN_LABEL } from '../parsing/parser-recovery.js';

export const COVER_LETTER_ENGINE = 'HIRELY_COVER_LETTER_ENGINE_P4';

/** Production tones (UI). */
export const COVER_LETTER_TONES = Object.freeze({
  professional: { id: 'professional', label: 'Professional', mode: 'formal', legacy: ['formal'] },
  creative: { id: 'creative', label: 'Creative', mode: 'creative', legacy: [] },
  executive: { id: 'executive', label: 'Executive', mode: 'executive', legacy: ['corporate', 'ats'] },
});

/** Internal copy keys (legacy modes kept for QA / aliases). */
export const COVER_LETTER_MODES = Object.freeze({
  formal: { id: 'formal', label: 'Formal', legacy: ['professional'] },
  creative: { id: 'creative', label: 'Creative', legacy: [] },
  startup: { id: 'startup', label: 'Startup', legacy: [] },
  corporate: { id: 'corporate', label: 'Corporate', legacy: ['ats'] },
  executive: { id: 'executive', label: 'Executive', legacy: [] },
});

export const LETTER_TONE_IDS = Object.freeze(Object.keys(COVER_LETTER_TONES));

const METRIC_RE =
  /\d+\s*%|\d[\d\s.,]*\s*(k|K|M|m|€|\$|£)|[€$£]\s?\d|\b\d{2,}\s*(users|clients|projects|people|personnes|projets)\b/i;
const ACTION_RE =
  /\b(created|built|designed|managed|led|delivered|developed|implemented|launched|optimized|improved|increased|reduced|grew|achieved|collaborated|créé|conçu|dirigé|géré|livré|augmenté|réduit)\b/i;

const COPY = {
  fr: {
    greeting: 'Madame, Monsieur,',
    greetingCompany: (company) => `Madame, Monsieur,`,
    greetingStartup: 'Bonjour,',
    sign: 'Cordialement,',
    signStartup: 'À bientôt,',
    formal: {
      genericOpening: (title, company) =>
        company
          ? `Je me permets de vous adresser ma candidature spontanée au sein de ${company}. En tant que ${title || 'professionnel(le)'}, je souhaite mettre mon expérience au service de votre équipe.`
          : `Je me permets de vous adresser ma candidature spontanée. En tant que ${title || 'professionnel(le)'}, je souhaite mettre mon expérience au service de votre équipe.`,
      opening: (title, role, company) =>
        company
          ? `Je me permets de vous adresser ma candidature pour le poste de ${role} au sein de ${company}. En tant que ${title || 'professionnel(le)'}, je souhaite mettre mon expérience au service de votre équipe.`
          : `Je me permets de vous adresser ma candidature pour le poste de ${role}. En tant que ${title || 'professionnel(le)'}, je souhaite mettre mon expérience au service de votre équipe.`,
      expLead: 'Mon parcours inclut notamment :',
      skillsLead: 'Mes compétences clés :',
      closing:
        'Je serais ravi(e) d\'échanger sur la façon dont mon profil peut répondre à vos besoins. Je reste à votre disposition pour un entretien.',
    },
    creative: {
      genericOpening: (title, company) =>
        company
          ? `Passionné(e) par ${title || 'mon métier'}, je vous adresse ma candidature spontanée chez ${company} avec l\'envie d\'apporter une vision créative et des réalisations concrètes.`
          : `Passionné(e) par ${title || 'mon métier'}, je vous adresse ma candidature spontanée avec l\'envie d\'apporter une vision créative et des réalisations concrètes.`,
      opening: (title, role, company) =>
        company
          ? `Passionné(e) par ${title || 'mon métier'}, je candidate au poste de ${role} chez ${company} avec l\'envie d\'apporter une vision créative et des réalisations concrètes.`
          : `Passionné(e) par ${title || 'mon métier'}, je candidate au poste de ${role} avec l\'envie d\'apporter une vision créative et des réalisations concrètes.`,
      expLead: 'Réalisations sélectionnées :',
      skillsLead: 'Expertise :',
      clientsLead: 'Clients / marques :',
      closing:
        'Je serais heureux(se) de vous présenter mon portfolio et d\'échanger sur vos prochains projets.',
    },
    startup: {
      genericOpening: (title, company) =>
        company
          ? `Je vous adresse ma candidature spontanée chez ${company}. ${title ? `En tant que ${title}, ` : ''}j\'aime construire vite, itérer et livrer de la valeur mesurable.`
          : `Je vous adresse ma candidature spontanée. ${title ? `En tant que ${title}, ` : ''}j\'aime construire vite, itérer et livrer de la valeur mesurable.`,
      opening: (title, role, company) =>
        company
          ? `Je postule au poste de ${role} chez ${company}. ${title ? `En tant que ${title}, ` : ''}j\'aime construire vite, itérer et livrer de la valeur mesurable.`
          : `Je postule au poste de ${role}. ${title ? `En tant que ${title}, ` : ''}j\'aime construire vite, itérer et livrer de la valeur mesurable.`,
      expLead: 'Impact récent :',
      skillsLead: 'Stack & compétences :',
      closing:
        'Disponible pour en discuter — merci pour votre temps.',
    },
    corporate: {
      genericOpening: (title, company) =>
        company
          ? `Par la présente, je souhaite manifester mon intérêt pour une collaboration au sein de ${company}. Mon profil de ${title || 'professionnel'} correspond aux exigences de rigueur et de collaboration attendues dans un environnement structuré.`
          : `Par la présente, je souhaite manifester mon intérêt pour une opportunité au sein de votre organisation. Mon profil de ${title || 'professionnel'} correspond aux exigences de rigueur et de collaboration attendues dans un environnement structuré.`,
      opening: (title, role, company) =>
        company
          ? `Par la présente, je souhaite manifester mon intérêt pour le poste de ${role} au sein de ${company}. Mon profil de ${title || 'professionnel'} correspond aux exigences de rigueur et de collaboration attendues dans un environnement structuré.`
          : `Par la présente, je souhaite manifester mon intérêt pour le poste de ${role}. Mon profil de ${title || 'professionnel'} correspond aux exigences de rigueur et de collaboration attendues dans un environnement structuré.`,
      expLead: 'Expérience professionnelle pertinente :',
      skillsLead: 'Compétences :',
      closing:
        'Je vous remercie de l\'attention portée à ma candidature et reste à votre disposition pour un entretien.',
    },
    executive: {
      genericOpening: (title, company) =>
        company
          ? `Je souhaite vous faire part de mon intérêt pour une opportunité de leadership au sein de ${company}. Fort(e) d'un parcours en tant que ${title || 'dirigeant(e)'}, j'apporte une vision stratégique et une exécution rigoureuse.`
          : `Je souhaite vous faire part de mon intérêt pour une opportunité de leadership au sein de votre organisation. Fort(e) d'un parcours en tant que ${title || 'dirigeant(e)'}, j'apporte une vision stratégique et une exécution rigoureuse.`,
      opening: (title, role, company) =>
        company
          ? `Je souhaite vous faire part de mon intérêt pour le poste de ${role} au sein de ${company}. Fort(e) d'un parcours en tant que ${title || 'dirigeant(e)'}, j'apporte une vision stratégique et une exécution rigoureuse alignées sur vos enjeux.`
          : `Je souhaite vous faire part de mon intérêt pour le poste de ${role}. Fort(e) d'un parcours en tant que ${title || 'dirigeant(e)'}, j'apporte une vision stratégique et une exécution rigoureuse alignées sur vos enjeux.`,
      expLead: 'Faits marquants de mon parcours :',
      skillsLead: 'Compétences clés :',
      closing:
        'Je serais honoré(e) d\'échanger sur la manière dont mon expérience peut soutenir vos priorités. Je reste à votre disposition pour un entretien.',
    },
  },
  en: {
    greeting: 'Dear Hiring Manager,',
    greetingCompany: () => 'Dear Hiring Manager,',
    greetingStartup: 'Hello,',
    sign: 'Best regards,',
    signStartup: 'Best,',
    formal: {
      genericOpening: (title, company) =>
        company
          ? `I am writing to submit an open application to ${company}. As a ${title || 'professional'}, I would welcome the opportunity to contribute my experience to your team.`
          : `I am writing to submit an open application. As a ${title || 'professional'}, I would welcome the opportunity to contribute my experience to your team.`,
      opening: (title, role, company) =>
        company
          ? `I am writing to apply for the ${role} position at ${company}. As a ${title || 'professional'}, I would welcome the opportunity to contribute my experience to your team.`
          : `I am writing to apply for the ${role} position. As a ${title || 'professional'}, I would welcome the opportunity to contribute my experience to your team.`,
      expLead: 'Relevant experience includes:',
      skillsLead: 'Core skills:',
      closing:
        'I would welcome the chance to discuss how my background aligns with your needs. Thank you for your consideration.',
    },
    creative: {
      genericOpening: (title, company) =>
        company
          ? `As a ${title || 'creative professional'}, I am reaching out with an open application to ${company} and would love to bring distinctive work and proven outcomes to your team.`
          : `As a ${title || 'creative professional'}, I am reaching out with an open application and would love to bring distinctive work and proven outcomes to your team.`,
      opening: (title, role, company) =>
        company
          ? `As a ${title || 'creative professional'}, I am excited to apply for the ${role} role at ${company} and bring distinctive work and proven outcomes to your team.`
          : `As a ${title || 'creative professional'}, I am excited to apply for the ${role} role and bring distinctive work and proven outcomes to your team.`,
      expLead: 'Selected work:',
      skillsLead: 'Expertise:',
      clientsLead: 'Selected clients / brands:',
      closing:
        'I would be glad to share my portfolio and discuss how I can support your upcoming projects.',
    },
    startup: {
      genericOpening: (title, company) =>
        company
          ? `I'm reaching out with an open application to ${company}. ${title ? `As a ${title}, ` : ''}I thrive in fast-moving teams and focus on shipping measurable impact.`
          : `I'm reaching out with an open application. ${title ? `As a ${title}, ` : ''}I thrive in fast-moving teams and focus on shipping measurable impact.`,
      opening: (title, role, company) =>
        company
          ? `I'm applying for the ${role} role at ${company}. ${title ? `As a ${title}, ` : ''}I thrive in fast-moving teams and focus on shipping measurable impact.`
          : `I'm applying for the ${role} role. ${title ? `As a ${title}, ` : ''}I thrive in fast-moving teams and focus on shipping measurable impact.`,
      expLead: 'Recent impact:',
      skillsLead: 'Skills & tools:',
      closing: 'Happy to chat — thanks for your time.',
    },
    corporate: {
      genericOpening: (title, company) =>
        company
          ? `I am writing to express my interest in opportunities at ${company}. My background as a ${title || 'professional'} aligns with the standards of rigor and collaboration expected in a structured organization.`
          : `I am writing to express my interest in opportunities within your organization. My background as a ${title || 'professional'} aligns with the standards of rigor and collaboration expected in a structured organization.`,
      opening: (title, role, company) =>
        company
          ? `I am writing to express my interest in the ${role} position at ${company}. My background as a ${title || 'professional'} aligns with the standards of rigor and collaboration expected in a structured organization.`
          : `I am writing to express my interest in the ${role} position. My background as a ${title || 'professional'} aligns with the standards of rigor and collaboration expected in a structured organization.`,
      expLead: 'Relevant professional experience:',
      skillsLead: 'Skills:',
      closing:
        'Thank you for your consideration. I remain available for an interview at your convenience.',
    },
    executive: {
      genericOpening: (title, company) =>
        company
          ? `I am writing regarding a leadership opportunity at ${company}. As a ${title || 'senior leader'}, I bring strategic direction and disciplined delivery to complex initiatives.`
          : `I am writing regarding a leadership opportunity within your organization. As a ${title || 'senior leader'}, I bring strategic direction and disciplined delivery to complex initiatives.`,
      opening: (title, role, company) =>
        company
          ? `I am writing regarding the ${role} opportunity at ${company}. As a ${title || 'senior leader'}, I bring strategic direction and disciplined delivery aligned with your organization's priorities.`
          : `I am writing regarding the ${role} opportunity. As a ${title || 'senior leader'}, I bring strategic direction and disciplined delivery aligned with your organization's priorities.`,
      expLead: 'Leadership and delivery highlights:',
      skillsLead: 'Core capabilities:',
      closing:
        'I would welcome a conversation about how my experience can support your priorities. Thank you for your consideration.',
    },
  },
};

function cleanLine(line) {
  return String(line || '')
    .replace(/^[-•*→]\s*/, '')
    .replace(/\s+/g, ' ')
    .trim();
}

function safeName(cv) {
  const n = String(cv?.name || '').trim();
  if (!n || n === NAME_UNCERTAIN_LABEL || n === 'Nom à compléter') return '';
  return n;
}

function safeTitle(cv) {
  const t = String(cv?.title || '').trim();
  if (!t || t === TITLE_UNCERTAIN_LABEL || t === 'Poste à compléter') return '';
  return t;
}

function pickExperienceLines(cv, limit = 3) {
  const exp = (cv?.experience || []).map(cleanLine).filter(Boolean);
  const scored = exp.map((line, idx) => {
    let score = 0;
    if (METRIC_RE.test(line)) score += 3;
    if (ACTION_RE.test(line)) score += 2;
    if (line.length >= 40 && line.length <= 200) score += 1;
    return { line, score, idx };
  });
  scored.sort((a, b) => b.score - a.score || a.idx - b.idx);
  const picked = [];
  for (const item of scored) {
    if (picked.length >= limit) break;
    if (!picked.includes(item.line)) picked.push(item.line);
  }
  return picked.length ? picked : exp.slice(0, limit);
}

function pickSkills(cv, limit = 8) {
  const skills = [...(cv?.skills || []), ...(cv?.tools || [])]
    .map((s) => String(s || '').trim())
    .filter(Boolean);
  return [...new Set(skills)].slice(0, limit);
}

function resolveLang(lang) {
  const l = String(lang || 'fr').toLowerCase().slice(0, 2);
  return l === 'en' ? 'en' : 'fr';
}

function hasExperience(cv) {
  const structured = (cv?.experiences || []).filter(Boolean).length;
  if (structured > 0) return true;
  return Array.isArray(cv?.experience) && cv.experience.filter(Boolean).length > 0;
}

function hasSkills(cv) {
  const n = (cv?.skills || []).filter(Boolean).length + (cv?.tools || []).filter(Boolean).length;
  return n >= 1;
}

export function resolveCoverLetterTone(toneOrMode) {
  const raw = String(toneOrMode || 'professional').toLowerCase();
  if (COVER_LETTER_TONES[raw]) return raw;
  for (const spec of Object.values(COVER_LETTER_TONES)) {
    if (spec.legacy.includes(raw)) return spec.id;
  }
  if (raw === 'creative') return 'creative';
  if (raw === 'startup') return 'professional';
  return 'professional';
}

function resolveMode(modeOrStyle) {
  const tone = resolveCoverLetterTone(modeOrStyle);
  const mapped = COVER_LETTER_TONES[tone]?.mode;
  if (mapped && COPY.fr[mapped]) return mapped;
  const raw = String(modeOrStyle || 'formal').toLowerCase();
  if (COVER_LETTER_MODES[raw]) return raw;
  for (const spec of Object.values(COVER_LETTER_MODES)) {
    if (spec.legacy.includes(raw)) return spec.id;
  }
  return 'formal';
}

function explicitTargetRole(jobTitle, targetRole) {
  return String(jobTitle || targetRole || '').trim();
}

function resolveRole(cv, jobTitle, targetRole) {
  const role = explicitTargetRole(jobTitle, targetRole);
  if (role) return role;
  return safeTitle(cv);
}

function resolveCompany(companyName, targetCompany) {
  return String(companyName || targetCompany || '').trim();
}

/**
 * Map resumeData → flat letter profile (no hallucination).
 * @param {object|null} resumeData
 */
export function resumeDataToLetterProfile(resumeData) {
  if (!resumeData || typeof resumeData !== 'object') return null;
  const cv = resumeDataToCvData(resumeData, { skipNormalize: true });
  if (!(cv.experience || []).length && (resumeData.experiences || []).length) {
    cv.experience = resumeData.experiences
      .map((e) => {
        if (typeof e === 'string') return e;
        const head = [e.role, e.company, e.dates].filter(Boolean).join(' — ');
        const bullets = (e.bullets || []).join(' · ');
        return bullets ? `${head}: ${bullets}` : head;
      })
      .filter(Boolean);
  }
  cv.experiences = resumeData.experiences || cv.experiences || [];
  cv.clients = resumeData.clients || cv.clients || [];
  cv.projects = resumeData.projects || cv.projects || [];
  return cv;
}

/**
 * Required facts before generating a letter (no hallucination).
 * @param {object|null} cvData
 * @param {{ jobTitle?: string, targetRole?: string, lang?: string }} [opts]
 */
export function validateCoverLetterInputs(cvData, opts = {}) {
  const missing = [];
  if (!cvData || typeof cvData !== 'object') {
    return { ok: false, missing: ['name', 'title', 'experience', 'skills'] };
  }
  if (!safeName(cvData)) missing.push('name');
  if (!safeTitle(cvData)) missing.push('title');
  if (!hasExperience(cvData)) missing.push('experience');
  if (!hasSkills(cvData)) missing.push('skills');
  return { ok: missing.length === 0, missing, lang: resolveLang(opts.lang || cvData.lang) };
}

/**
 * @param {object|null} resumeData
 * @param {{ jobTitle?: string, companyName?: string, mode?: string, style?: string, lang?: string, targetRole?: string, targetCompany?: string }} [opts]
 */
export function isFinalResumeDataInput(input) {
  return !!(
    input &&
    typeof input === 'object' &&
    (input.identity || input.experiences || input.skills || input.summary)
  );
}

/**
 * @param {object|null} finalResumeData
 */
export function finalResumeDataToResumeShape(finalResumeData) {
  if (!isFinalResumeDataInput(finalResumeData)) return null;
  return {
    identity: { ...(finalResumeData.identity || {}) },
    summary: String(finalResumeData.summary || '').trim(),
    experiences: Array.isArray(finalResumeData.experiences) ? finalResumeData.experiences : [],
    education: Array.isArray(finalResumeData.education) ? finalResumeData.education : [],
    skills: Array.isArray(finalResumeData.skills) ? finalResumeData.skills : [],
    tools: Array.isArray(finalResumeData.tools) ? finalResumeData.tools : [],
    languages: Array.isArray(finalResumeData.languages) ? finalResumeData.languages : [],
    clients: Array.isArray(finalResumeData.clients) ? finalResumeData.clients : [],
    projects: Array.isArray(finalResumeData.projects) ? finalResumeData.projects : [],
    unsorted: Array.isArray(finalResumeData.suggestions)
      ? finalResumeData.suggestions
      : Array.isArray(finalResumeData.unsorted)
        ? finalResumeData.unsorted
        : [],
    meta: finalResumeData.metaSafe || finalResumeData.meta || {},
  };
}

/**
 * @param {object|null} finalResumeData
 * @param {{ jobTitle?: string, companyName?: string, tone?: string, mode?: string, style?: string, lang?: string }} [opts]
 */
export function buildCoverLetterFromFinalResumeData(finalResumeData, opts = {}) {
  const shaped = finalResumeDataToResumeShape(finalResumeData);
  if (!shaped) return null;
  return buildCoverLetterFromResumeData(shaped, opts);
}

export function buildCoverLetterFromResumeData(resumeData, opts = {}) {
  const profile = resumeDataToLetterProfile(resumeData);
  if (!profile) return null;
  return buildCoverLetterDraft(profile, opts);
}

/**
 * Verify experience lines in the draft come from the profile (no invented roles).
 * @param {{ text?: string, meta?: object }|null} draft
 * @param {object|null} profile
 */
export function auditCoverLetterFacts(draft, profile) {
  if (!draft?.text || !profile) return { ok: false, issues: ['missing_draft_or_profile'] };
  const used = draft.meta?.experienceLinesUsed || [];
  const source = (profile.experience || []).map(cleanLine).filter(Boolean);
  const issues = [];
  for (const line of used) {
    const hit = source.some(
      (s) => s === line || s.includes(line) || line.includes(s.slice(0, Math.min(24, s.length)))
    );
    if (!hit) issues.push(`experience_not_in_resume:${line.slice(0, 48)}`);
  }
  return { ok: issues.length === 0, issues, experienceLinesUsed: used.length };
}

/**
 * @param {object|null} cvData
 * @param {{ jobTitle?: string, companyName?: string, mode?: string, style?: string, lang?: string, targetRole?: string, targetCompany?: string, jobDescription?: string }} [opts]
 */
export function buildCoverLetterDraft(cvData, opts = {}) {
  if (!cvData || typeof cvData !== 'object') return null;

  const letterOpts = {
    ...opts,
    targetRole: opts.jobTitle || opts.targetRole,
    targetCompany: opts.companyName || opts.targetCompany,
  };
  const validation = validateCoverLetterInputs(cvData, letterOpts);
  if (!validation.ok) return null;

  const lang = resolveLang(opts.lang || cvData.lang);
  const tone = resolveCoverLetterTone(opts.tone || opts.mode || opts.style);
  const mode = resolveMode(opts.tone || opts.mode || opts.style);
  const copy = COPY[lang];
  const modeCopy = copy[mode] || copy.formal;
  const name = safeName(cvData) || (lang === 'en' ? 'Candidate' : 'Candidat');
  const title = safeTitle(cvData);
  const targetRole = explicitTargetRole(opts.jobTitle, opts.targetRole);
  const role = resolveRole(cvData, opts.jobTitle, opts.targetRole) || '';
  const company = resolveCompany(opts.companyName, opts.targetCompany);
  const genericApplication = !targetRole;
  const summary = String(cvData.summary || '').trim();
  const expLimit =
    mode === 'corporate' || mode === 'executive' ? 4 : mode === 'startup' ? 2 : 3;
  const skillLimit =
    mode === 'corporate' || mode === 'executive' ? 8 : mode === 'startup' ? 5 : 6;
  const experience = pickExperienceLines(cvData, expLimit);
  const skills = pickSkills(cvData, skillLimit);
  const clients = (cvData.clients || []).map((c) => String(c || '').trim()).filter(Boolean).slice(0, 4);

  const blocks = [];
  if (mode === 'startup') {
    blocks.push(copy.greetingStartup);
  } else {
    blocks.push(company ? copy.greetingCompany(company) : copy.greeting);
  }
  blocks.push('');
  if (genericApplication && typeof modeCopy.genericOpening === 'function') {
    blocks.push(modeCopy.genericOpening(title, company));
  } else {
    const roleLabel =
      role || (lang === 'en' ? 'the role discussed' : 'le poste envisagé');
    blocks.push(modeCopy.opening(title, roleLabel, company));
  }
  blocks.push('');

  if (summary && mode !== 'corporate' && mode !== 'executive') {
    const maxSummary = mode === 'startup' ? 220 : 320;
    blocks.push(summary.length > maxSummary ? `${summary.slice(0, maxSummary - 1)}…` : summary);
    blocks.push('');
  }

  if (experience.length) {
    blocks.push(modeCopy.expLead);
    if (mode === 'corporate' || mode === 'executive') {
      experience.forEach((line) => blocks.push(`- ${line}`));
    } else if (mode === 'creative') {
      experience.forEach((line) => blocks.push(`→ ${line}`));
    } else if (mode === 'startup') {
      experience.slice(0, 2).forEach((line) => blocks.push(`• ${line}`));
    } else {
      experience.forEach((line) => blocks.push(`• ${line}`));
    }
    blocks.push('');
  }

  if (skills.length) {
    blocks.push(modeCopy.skillsLead);
    blocks.push(mode === 'corporate' || mode === 'executive' ? skills.join(', ') : skills.join(' · '));
    blocks.push('');
  }

  if (mode === 'creative' && clients.length) {
    blocks.push(modeCopy.clientsLead || (lang === 'en' ? 'Selected clients:' : 'Clients :'));
    blocks.push(clients.join(' · '));
    blocks.push('');
  }

  blocks.push(modeCopy.closing);
  blocks.push('');
  blocks.push(mode === 'startup' ? copy.signStartup : copy.sign);
  blocks.push(name);

  const text = blocks.join('\n').replace(/\n{3,}/g, '\n\n').trim();

  return {
    text,
    meta: {
      engine: COVER_LETTER_ENGINE,
      lang,
      tone,
      mode,
      style: tone,
      role,
      company: company || null,
      jobTitle: targetRole || role || null,
      genericApplication,
      companyName: company || null,
      name,
      title,
      experienceCount: experience.length,
      experienceLinesUsed: experience,
      skillsCount: skills.length,
      source: 'cover-letter-engine',
    },
  };
}
