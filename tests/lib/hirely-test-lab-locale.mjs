/**
 * Hirely Test Lab — locale transforms for multi-country / multi-language CVs.
 */

const SECTION_MAP = {
  en: {
    experience: 'Experience',
    education: 'Education',
    skills: 'Skills',
    languages: 'Languages',
    summary: 'Summary',
    contact: 'Contact',
    projects: 'Projects',
    tools: 'Tools',
  },
  fr: {
    experience: 'Expérience',
    education: 'Formation',
    skills: 'Compétences',
    languages: 'Langues',
    summary: 'Profil',
    contact: 'Contact',
    projects: 'Projets',
    tools: 'Outils',
  },
  de: {
    experience: 'Berufserfahrung',
    education: 'Ausbildung',
    skills: 'Fähigkeiten',
    languages: 'Sprachen',
    summary: 'Profil',
    contact: 'Kontakt',
    projects: 'Projekte',
    tools: 'Tools',
  },
  es: {
    experience: 'Experiencia',
    education: 'Formación',
    skills: 'Habilidades',
    languages: 'Idiomas',
    summary: 'Resumen',
    contact: 'Contacto',
    projects: 'Proyectos',
    tools: 'Herramientas',
  },
  nl: {
    experience: 'Werkervaring',
    education: 'Opleiding',
    skills: 'Vaardigheden',
    languages: 'Talen',
    summary: 'Profiel',
    contact: 'Contact',
    projects: 'Projecten',
    tools: 'Tools',
  },
  it: {
    experience: 'Esperienza',
    education: 'Formazione',
    skills: 'Competenze',
    languages: 'Lingue',
    summary: 'Profilo',
    contact: 'Contatto',
    projects: 'Progetti',
    tools: 'Strumenti',
  },
};

const COUNTRY_LABELS = {
  US: 'United States',
  UK: 'United Kingdom',
  FR: 'France',
  DE: 'Germany',
  CH: 'Switzerland',
  NL: 'Netherlands',
  ES: 'Spain',
  IT: 'Italy',
  CA: 'Canada',
  AU: 'Australia',
};

/**
 * @param {string} text
 * @param {string} language
 */
export function applyLocaleHeaders(text, language = 'en') {
  const lang = String(language || 'en').toLowerCase().slice(0, 2);
  const map = SECTION_MAP[lang] || SECTION_MAP.en;
  const en = SECTION_MAP.en;
  let out = String(text || '');
  for (const key of Object.keys(en)) {
    const from = en[key];
    const to = map[key];
    if (from !== to) {
      out = out.replace(new RegExp(`^${from}$`, 'gim'), to);
      out = out.replace(new RegExp(`\\b${from}\\b`, 'gi'), to);
    }
  }
  return out;
}

/**
 * @param {string} country
 */
export function countryLabel(country) {
  return COUNTRY_LABELS[String(country || 'US').toUpperCase()] || country;
}

export { SECTION_MAP, COUNTRY_LABELS };
