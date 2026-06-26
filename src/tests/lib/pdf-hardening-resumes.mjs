/**
 * HIRELY H7 — synthetic resume generator for PDF export hardening (100 variants).
 */

const TEMPLATES = ['ats', 'creative', 'executive-minimal', 'modern-two-column', 'editorial'];

const FIRST = [
  'Alex', 'Marie', 'Thomas', 'Léa', 'Yohann', 'Sophie', 'Karim', 'Nina', 'James', 'Elena',
  'Omar', 'Clara', 'Lucas', 'Amina', 'Noah', 'Zoé', 'Hugo', 'Maya', 'Ethan', 'Inès',
];
const LAST = [
  'Martin', 'Dupont', 'Renard', 'Bernard', 'Azancot', 'Moreau', 'Petit', 'Garcia', 'Kim', 'Nguyen',
  'Rossi', 'Silva', 'Khan', 'Patel', 'Lopez', 'Chen', 'Dubois', 'Weber', 'Fischer', 'Costa',
];
const ROLES = [
  'Product Designer', 'Graphic Designer', 'Software Engineer', 'Project Manager',
  'Art Director', 'Data Analyst', 'Marketing Manager', 'UX Researcher',
  'Illustrator', 'Consultant', 'Brand Strategist', 'Frontend Developer',
];
const COMPANIES = ['Acme Corp', 'Studio Nova', 'Global Tech', 'Agency Blue', 'Freelance', 'McCann G.'];
const SKILLS = ['Leadership', 'Strategy', 'Design', 'Research', 'Branding', 'Analytics', 'Communication'];
const TOOLS = ['Figma', 'Photoshop', 'Excel', 'Python', 'Illustrator', 'Notion', 'Jira', 'InDesign'];

function pick(arr, i) {
  return arr[i % arr.length];
}

function buildExperience(i, count) {
  const lines = [];
  for (let e = 0; e < count; e++) {
    const y = 2010 + ((i + e) % 14);
    const role = pick(ROLES, i + e);
    const company = pick(COMPANIES, i + e * 2);
    const metric = 12 + ((i + e) % 40);
    lines.push(
      `${role} — ${company} — Paris — ${y}–${y + 1}. Delivered ${metric}% improvement on key initiatives and led cross-functional delivery.`
    );
  }
  return lines;
}

/**
 * @param {number} [count]
 * @returns {Array<{ id: string, templateId: string, label: string, cv: object, expectPages: { min: number, max: number } }>}
 */
export function generateHardeningResumes(count = 100) {
  const items = [];
  for (let i = 0; i < count; i++) {
    const templateId = pick(TEMPLATES, i);
    const tier = Math.floor(i / TEMPLATES.length);
    const expCount = 1 + (tier % 14);
    const name = `${pick(FIRST, i)} ${pick(LAST, i + 3)}`;
    const title = pick(ROLES, i + 1);
    const cv = {
      name,
      title,
      email: `${name.split(' ')[0].toLowerCase()}@example.com`,
      phone: `+33 6 ${String(10 + (i % 89)).padStart(2, '0')} ${String(20 + (i % 79)).padStart(2, '0')} ${String(30 + (i % 69)).padStart(2, '0')} ${String(40 + (i % 59)).padStart(2, '0')}`,
      location: pick(['Paris', 'Lyon', 'London', 'Berlin', 'Remote'], i),
      linkedin: `https://linkedin.com/in/${name.split(' ')[0].toLowerCase()}`,
      summary:
        tier % 3 === 0
          ? `${title} with ${3 + (tier % 8)} years of experience across product, brand, and delivery.`
          : `${title} focused on measurable outcomes, stakeholder alignment, and high-quality execution across ${2 + (tier % 5)} industries.`,
      experience: buildExperience(i, expCount),
      education: [
        `${pick(['HEC Paris', 'ENSAD', 'Créapole', 'MIT', 'Sciences Po'], i)} — ${pick(['MBA', 'MDes', 'BSc', 'MA'], i)} — ${2004 + (i % 12)}`,
      ],
      skills: SKILLS.slice(0, 4 + (tier % 4)),
      tools: TOOLS.slice(0, 2 + (tier % 5)),
      languages: ['French — native', 'English — fluent'].slice(0, 1 + (tier % 2)),
      clients: tier % 2 === 0 ? ['Nike', 'Adobe', 'Marvel'].slice(0, 1 + (tier % 3)) : [],
      projects:
        templateId === 'creative'
          ? [`Campaign ${i + 1} — Global brand · 20${20 + (i % 4)}`]
          : [],
      photo:
        tier % 7 === 0
          ? 'data:image/svg+xml,' +
            encodeURIComponent(
              '<svg xmlns="http://www.w3.org/2000/svg" width="88" height="88"><rect fill="#e2e8f0" width="88" height="88"/><text x="44" y="48" text-anchor="middle" font-size="12" fill="#64748b">Photo</text></svg>'
            )
          : null,
    };

    const minPages = 1;
    const maxPages = expCount >= 10 ? 4 : expCount >= 6 ? 3 : 2;

    items.push({
      id: `h7-${String(i + 1).padStart(3, '0')}`,
      templateId,
      label: `${name} · ${templateId} · ${expCount} exp`,
      cv,
      expectPages: { min: minPages, max: maxPages },
    });
  }
  return items;
}
