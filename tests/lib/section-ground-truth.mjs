/**
 * Ground truth extraction from fixture.txt (+ optional per-fixture overrides).
 */

import fs from 'fs';
import path from 'path';

const SECTION_ALIASES = {
  experience: /^(experiences?)$/i,
  education: /^(education|formation|academic)$/i,
  skills: /^(skills?|competencies|compétences|competences|expertise|stack)$/i,
  tools: /^(tools?|software|technologies|tech\s*stack|stack|outils)$/i,
  languages: /^(languages?|langues)$/i,
  clients: /^(clients?)$/i,
};

/** Sections whose body lines are ignored for ground truth. */
const SKIP_BODY_SECTIONS = new Set(['profile', 'summary', 'interests', 'contact']);

const SECTION_KEYS = ['experience', 'education', 'skills', 'tools', 'languages', 'clients'];

/** Manual overrides when fixture layout is ambiguous or merged. */
export const GROUND_TRUTH_OVERRIDES = {
  'creative-cv': {
    experience: ['Freelance Illustrator / Graphic Designer — Independent — 2011 — Present'],
    education: [
      'LISAA — Web & Motion Design',
      'Créapole — Visual Communication / Product Design',
    ],
    clients: ['Nike', 'Louis Vuitton', 'Marvel', 'Adobe', 'McCann', 'Cadillac', 'Fortune', 'Converse', 'Pantone', 'Arte'],
  },
  'yoaz-cv': {
    experience: [
      'Freelance Illustrator / Graphic Designer — Independent — 2011 — Present',
      'McCann Paris — Lead Illustrator — 2011 — 2014',
      'Publicis Conseil — Art Director — 2014 — 2016',
      'Havas Paris — Senior Illustrator — 2016 — 2018',
      'Freelance — Senior Art Director — 2018 — 2020',
      'BETC — Illustrator / Designer — 2020 — 2021',
      'DDB Paris — Visual Designer — 2021 — 2022',
      'AKQA Paris — Lead Visual Designer — 2022 — 2023',
      'Studio Yoaz — Creative Director — 2023 — Present',
    ],
    education: [
      'LISAA — Web & Motion Design',
      'Créapole — Visual Communication / Product Design',
    ],
    clients: [
      'Nike', 'Louis Vuitton', 'Marvel', 'Cadillac', 'Fortune', 'Converse', 'Pantone', 'Adobe', 'Arte', 'McCann',
    ],
  },
  'developer-cv': {
    experience: [
      'Senior Software Engineer — Stripe — 2019 — Present',
      'Software Engineer — Dropbox — 2015 — 2019',
    ],
    languages: ['English — fluent', 'Mandarin — conversational'],
  },
  'sales-cv': {
    experience: [
      'Senior Account Executive — CloudNine SaaS — 2021 – Present',
      'Account Executive — Salesforce — 2017 – 2021',
    ],
    education: ['Northwestern University — B.A. Economics — 2013 – 2017'],
    languages: ['English — native', 'Spanish — conversational'],
  },
  'student-cv': {
    experience: [
      'Software Engineering Intern — Monzo — Summer 2025',
      'Teaching Assistant — University College London — 2024 – Present',
    ],
    education: [
      'University College London — BSc Computer Science — 2022 – 2026',
      'Westminster School — A-Levels — 2020 – 2022',
    ],
    languages: ['English — native', 'Spanish — intermediate'],
  },
  'academic-cv': {
    experience: [
      'Associate Professor — MIT Department of Biology — 2018 – Present',
      'Postdoctoral Researcher — Harvard Medical School — 2014 – 2018',
    ],
    education: [
      'Ph.D. Molecular Biology — Stanford University — 2009 – 2014',
      'B.S. Biochemistry — UC Berkeley — 2005 – 2009',
    ],
    languages: ['English — native', 'Portuguese — fluent'],
  },
  'executive-cv': {
    experience: [
      'Chief Operating Officer — CloudScale Inc — 2017 – Present',
      'VP Operations — Salesforce — 2010 – 2017',
    ],
    education: [
      'Harvard Business School — MBA — 2008 – 2010',
      'University of Michigan — BBA Finance — 1998 – 2002',
    ],
    languages: ['English — native'],
  },
  'marketing-cv': {
    experience: [
      'Digital Marketing Manager — GrowthLab — 2020 — Present',
      'Marketing Executive — Unilever — 2016 — 2020',
    ],
    education: [
      'London School of Economics — MSc Marketing — 2014 — 2015',
      'University of Leeds — BA Communications — 2011 — 2014',
    ],
    languages: ['English — native', 'French — professional'],
  },
  'recruiter-cv': {
    experience: [
      'Senior Recruiter — TechScale — 2019 — Present',
      'Recruiter — Randstad — 2015 — 2019',
    ],
    education: ['NYU — B.A. Human Resources — 2011 — 2015'],
    languages: ['English — native', 'Spanish — conversational'],
  },
  'consultant-cv': {
    experience: [
      'Senior Consultant — Strategy firm — 2018 — Present',
      'Business Analyst — Deloitte — 2014 — 2018',
    ],
    education: [
      'HEC Paris — Master in Management — 2012 — 2014',
      'Sciences Po — Bachelor in Economics — 2009 — 2012',
    ],
    languages: ['French — native', 'English — fluent', 'German — professional'],
  },
  'text-pdf': {
    experience: [
      'Senior Product Manager — Acme SaaS — 2019 — Present',
      'Product Manager — Beta Corp — 2015 — 2019',
    ],
    education: ['HEC Paris — MBA 2018'],
    skills: ['Product strategy', 'Agile', 'SQL', 'User research', 'Roadmapping'],
  },
  'scanned-pdf': {
    experience: ['Senior PM — Acme — 2019 — Present'],
    education: ['HEC Paris — MBA 2018'],
    skills: ['Product strategy', 'Agile', 'SQL', 'User research'],
  },
  'docx': {
    experience: [
      'Senior Product Manager — Acme SaaS — 2019 — Present',
      'Product Manager — Beta Corp — 2015 — 2019',
    ],
    education: ['HEC Paris — MBA 2018'],
    skills: ['Product strategy', 'Agile', 'SQL', 'User research', 'Roadmapping'],
  },
  'two-column-cv': {
    experience: [
      'Senior Product Manager — Acme SaaS — 2019 — Present',
      'Product Manager — Beta Corp — 2015 — 2019',
    ],
    education: ['HEC Paris — MBA — 2018'],
    skills: ['Product strategy', 'Agile', 'SQL'],
  },
  'mvp-sample': {
    experience: ['Freelance Illustrator / Graphic Designer — Independent — 2011 — Present'],
    clients: [],
    tools: ['Photoshop', 'Illustrator'],
  },
  artist: {
    experience: [
      'Lead Illustrator — Atelier Mercier — Paris — 2019 – Present',
      'Freelance Artist — Independent — 2014 – 2019',
    ],
    education: ['École des Beaux-Arts — DNSEP Art — 2010 – 2014'],
    skills: ['Illustration', 'mural art', 'gouache', 'ink drawing', 'exhibition curation', 'art direction'],
  },
  'creative-director': {
    experience: [
      'Creative Director — Studio North — San Francisco — 2020 – Present',
      'Associate Creative Director — Huge — San Francisco — 2015 – 2020',
      'Senior Art Director — AKQA — 2011 – 2015',
    ],
    education: ['Rhode Island School of Design — BFA Graphic Design — 2007 – 2011'],
    skills: ['Creative direction', 'brand strategy', 'team leadership', 'campaign development', 'typography'],
  },
  'yoaz-pdf-live': {
    experience: [
      'Freelance Illustrator / Graphic Designer — Independent — 2011 — Present',
      'McCann Paris — Lead Illustrator — 2011 — 2014',
      'Publicis Conseil — Art Director — 2014 — 2016',
      'Havas Paris — Senior Illustrator — 2016 — 2018',
      'Freelance — Senior Art Director — 2018 — 2020',
      'BETC — Illustrator / Designer — 2020 — 2021',
      'DDB Paris — Visual Designer — 2021 — 2022',
      'AKQA Paris — Lead Visual Designer — 2022 — 2023',
      'Studio Yoaz — Creative Director — 2023 — Present',
    ],
    education: [
      'LISAA — Web & Motion Design',
      'Créapole — Visual Communication',
    ],
    clients: [
      'Nike', 'Louis Vuitton', 'Marvel', 'Cadillac', 'Fortune', 'Converse', 'Pantone', 'Adobe', 'Arte', 'McCann',
    ],
  },
};

function resolveSection(line) {
  const t = String(line || '').trim();
  if (/^(profile|summary|interests|contact)$/i.test(t)) return `skip:${t.toLowerCase()}`;
  for (const key of SECTION_KEYS) {
    if (SECTION_ALIASES[key].test(t)) return key;
  }
  return null;
}

function splitListLine(line) {
  return String(line || '')
    .split(/[,;·]/)
    .map((p) => p.trim())
    .filter((p) => p.length > 1);
}

function isBullet(line) {
  return /^[-•*]\s+/.test(String(line || '').trim());
}

function isDateOrCompanyLine(line) {
  const t = String(line || '').trim();
  return /\d{4}/.test(t) || /present|freelance|independent/i.test(t);
}

function mergeExperienceBlock(roleLine, detailLine) {
  const role = String(roleLine || '').trim();
  const detail = String(detailLine || '').trim();
  if (!role) return detail;
  if (!detail) return role;
  return `${role} — ${detail.replace(/\s*·\s*/g, ' — ')}`;
}

/**
 * @param {string} rawText
 * @returns {Record<string, string[]>}
 */
export function parseGroundTruthFromFixture(rawText) {
  const out = Object.fromEntries(SECTION_KEYS.map((k) => [k, []]));
  const lines = String(rawText || '').split(/\r?\n/);
  let section = null;
  let pendingRole = null;

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;

    const sec = resolveSection(trimmed);
    if (sec) {
      if (sec.startsWith('skip:')) {
        section = sec;
        pendingRole = null;
      } else {
        section = sec;
        pendingRole = null;
      }
      continue;
    }

    if (!section || section.startsWith('skip:')) continue;
    if (isBullet(trimmed)) continue;

    if (section === 'experience') {
      if (pendingRole && isDateOrCompanyLine(trimmed)) {
        out.experience.push(mergeExperienceBlock(pendingRole, trimmed));
        pendingRole = null;
        continue;
      }
      if (!isDateOrCompanyLine(trimmed) && !/—/.test(trimmed)) {
        pendingRole = trimmed;
        continue;
      }
      out.experience.push(trimmed.replace(/\s*·\s*/g, ' — '));
      pendingRole = null;
      continue;
    }

    if (section === 'skills' || section === 'tools' || section === 'clients') {
      out[section].push(...splitListLine(trimmed));
    } else if (section === 'languages') {
      out.languages.push(trimmed);
    } else {
      out[section].push(trimmed);
    }
  }

  if (pendingRole) out.experience.push(pendingRole);

  return out;
}

/**
 * @param {string} fixtureId
 * @param {string} rawText
 */
export function groundTruthForFixture(fixtureId, rawText) {
  const parsed = parseGroundTruthFromFixture(rawText);
  const override = GROUND_TRUTH_OVERRIDES[fixtureId] || {};
  const merged = { ...parsed };
  for (const key of SECTION_KEYS) {
    if (Array.isArray(override[key])) merged[key] = [...override[key]];
  }
  return merged;
}

/**
 * @param {string} root
 * @param {{ manifestId?: string, file?: string, id: string }} entry
 */
export function loadFixtureRawText(root, entry) {
  if (entry.id === 'yoaz-pdf-live') {
    const yoazTxt = path.join(root, 'tests/fixtures/yoaz-cv/fixture.txt');
    if (fs.existsSync(yoazTxt)) return fs.readFileSync(yoazTxt, 'utf8');
  }
  if (entry.file) {
    return fs.readFileSync(path.join(root, entry.file), 'utf8');
  }
  const fp = path.join(root, 'tests/fixtures', entry.manifestId || entry.id, 'fixture.txt');
  return fs.readFileSync(fp, 'utf8');
}
