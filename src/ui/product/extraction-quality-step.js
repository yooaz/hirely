/**
 * P0 — Extraction quality summary before template selection (finalResumeData only).
 */
(function (global) {
  const UNCERTAIN_IDENTITY = new Set([
    'Nom à confirmer',
    'Nom à compléter',
    'Poste à compléter',
    'Information non détectée',
    'Identity needs review',
    'Name to confirm',
    'Title to confirm',
  ]);

  function hasDetectedName(frd) {
    const name = String(frd?.identity?.name || '').trim();
    if (!name || name.length < 2) return false;
    if (UNCERTAIN_IDENTITY.has(name)) return false;
    return true;
  }

  function nameMissLabel(frd) {
    const name = String(frd?.identity?.name || '').trim();
    if (UNCERTAIN_IDENTITY.has(name) || /confirmer/i.test(name)) return 'Nom à confirmer';
    return 'Nom non détecté';
  }

  const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;
  const URL_RE = /https?:\/\/\S+/gi;
  const SOCIAL_RE = /\b(instagram|linkedin|portfolio|behance|dribbble|twitter|facebook|github|www\.)\b/gi;

  function stripContactNoise(raw) {
    let s = String(raw || '').trim();
    if (!s) return '';
    s = s.replace(URL_RE, ' ').replace(SOCIAL_RE, ' ').replace(/\s*[·|•/]\s*/g, ' ');
    return s.replace(/\s+/g, ' ').trim();
  }

  function extractEmail(raw) {
    const rawS = String(raw || '').trim();
    if (!rawS) return '';
    const direct = rawS.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    if (direct) return direct[0].trim().toLowerCase();
    const s = stripContactNoise(raw);
    if (!s) return '';
    const m = s.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);
    return m ? m[0].trim().toLowerCase() : EMAIL_RE.test(s) ? s.trim().toLowerCase() : '';
  }

  function extractPhone(raw) {
    const s = stripContactNoise(raw);
    if (!s) return '';
    const digits = s.replace(/\D/g, '');
    if (digits.length < 8 || digits.length > 15) return '';
    if (/^(19|20)\d{2}/.test(digits)) return '';
    const m =
      s.match(/\+33[\s.-]?(?:6|7)[\s.-]?\d(?:[\s.-]?\d){7}/) ||
      s.match(/\+33\d{9}/) ||
      s.match(/\+\d{10,14}/) ||
      s.match(/0[1-9](?:[\s.-]?\d{2}){4}/);
    if (!m) return '';
    const d = m[0].replace(/\D/g, '');
    if (d.length < 8 || d.length > 15) return '';
    if (d.startsWith('33') && d.length >= 11) return `+${d}`;
    if (d.length === 10 && d.startsWith('0')) return `+33${d.slice(1)}`;
    return m[0].trim().startsWith('+') ? `+${d}` : m[0].trim();
  }

  function resolveIdentityContact(identity) {
    const id = identity && typeof identity === 'object' ? identity : {};
    const pool = [id.email, id.phone, id.location, id.linkedin, id.website, id.portfolio]
      .map((v) => String(v || '').trim())
      .filter(Boolean);
    let email = extractEmail(id.email);
    let phone = extractPhone(id.phone);
    if (!email) {
      for (const part of pool) {
        email = extractEmail(part);
        if (email) break;
      }
    }
    if (!phone) {
      for (const part of pool) {
        phone = extractPhone(part);
        if (phone) break;
      }
    }
    return { email, phone, hasEmail: !!email, hasPhone: !!phone };
  }

  function countExperiences(experiences) {
    return (experiences || []).filter((e) => {
      if (!e) return false;
      if (typeof e === 'string') return e.trim().length > 0;
      return !!(e.role || e.company || e.dates || (e.bullets || []).filter(Boolean).length);
    }).length;
  }

  function countEducation(education) {
    return (education || []).filter((e) => {
      if (!e) return false;
      if (typeof e === 'string') return e.trim().length > 0;
      return !!(
        e.school ||
        e.degree ||
        e.field ||
        e.dates ||
        e.startDate ||
        e.endDate ||
        e.display ||
        e.education
      );
    }).length;
  }

  function countLines(arr) {
    return (arr || []).filter((s) => String(s || '').trim()).length;
  }

  /** Section counts from finalResumeData only — no cvData / sectionCounts merge. */
  function sectionCountsFromFinalResume(frd) {
    return {
      experiences: countExperiences(frd?.experiences),
      education: countEducation(frd?.education),
      skills: countLines(frd?.skills),
      tools: countLines(frd?.tools),
    };
  }

  function buildExtractionQualityStep(input) {
    input = input || {};
    const frd = input.finalResumeData || {};
    const counts = sectionCountsFromFinalResume(frd);

    const contact = resolveIdentityContact(frd?.identity);
    const rows = [
      {
        key: 'name',
        ok: hasDetectedName(frd),
        labelOk: 'Nom détecté',
        labelMiss: nameMissLabel(frd),
        critical: true,
      },
      {
        key: 'email',
        ok: contact.hasEmail,
        labelOk: 'Email détecté',
        labelMiss: 'Email non détecté',
        critical: true,
      },
      {
        key: 'phone',
        ok: contact.hasPhone,
        labelOk: 'Téléphone détecté',
        labelMiss: 'Téléphone non détecté',
        critical: true,
      },
      {
        key: 'experience',
        ok: counts.experiences > 0,
        labelOk: 'Expérience détectée',
        labelMiss: 'Expérience non détectée',
        critical: true,
      },
      {
        key: 'education',
        ok: counts.education > 0,
        labelOk: 'Formation détectée',
        labelMiss: 'Formation non détectée',
        critical: false,
      },
      {
        key: 'skills',
        ok: counts.skills > 0 || counts.tools > 0,
        labelOk: 'Compétences détectées',
        labelMiss: 'Compétences non détectées',
        critical: false,
      },
    ];

    const criticalMissing = rows.filter((r) => r.critical && !r.ok).map((r) => r.key);
    const needsVerification = criticalMissing.length > 0;

    return {
      rows,
      criticalMissing,
      needsVerification,
      warnMessage: needsVerification
        ? "Certaines informations doivent être vérifiées avant l'export."
        : '',
      counts,
      source: 'finalResumeData',
    };
  }

  global.HirelyExtractionQualityStep = {
    hasDetectedName,
    resolveIdentityContact,
    sectionCountsFromFinalResume,
    buildExtractionQualityStep,
  };
})(typeof window !== 'undefined' ? window : globalThis);
