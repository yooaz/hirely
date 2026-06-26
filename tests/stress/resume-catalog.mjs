/**
 * 50 synthetic stress CVs — 10 per category (ATS, modern, Canva, creative, scanned).
 * Text fixtures simulate document types; scanned applies OCR-like noise.
 */

function seededRand(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0xffffffff;
  };
}

const FIRST = ['Alex', 'Jordan', 'Sam', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn', 'Jamie'];
const LAST = ['Chen', 'Martin', 'Patel', 'Garcia', 'Kim', 'Nguyen', 'Brooks', 'Silva', 'Dubois', 'Khan'];
const COMPANIES = ['Stripe', 'Google', 'Adobe', 'Nike', 'Spotify', 'McKinsey', 'LISAA', 'Créapole', 'Marvel', 'Fortune'];
const TOOLS = ['Photoshop', 'Illustrator', 'Figma', 'TypeScript', 'Python', 'InDesign', 'Excel', 'Tableau'];
const SCHOOLS = ['LISAA', 'Créapole', 'MIT', 'HEC Paris', 'Stanford', 'ENSAD', 'Gobelins'];

function person(i) {
  return `${FIRST[i % 10]} ${LAST[i % 10]}`;
}

function atsResume(i) {
  const name = person(i);
  const co = COMPANIES[i % COMPANIES.length];
  const school = SCHOOLS[i % SCHOOLS.length];
  const tool = TOOLS[i % TOOLS.length];
  return {
    id: `ats-${String(i + 1).padStart(2, '0')}`,
    category: 'ats',
    label: `ATS linear ${i + 1}`,
    text: `${name}
Software Engineer
${name.split(' ')[0].toLowerCase()}@email.com · +1 415 555 ${1000 + i}

SUMMARY
Engineer with ${5 + (i % 6)} years building APIs and product features at scale.

EXPERIENCE
Senior Engineer — ${co} — 2019 – Present
- Shipped billing APIs used by ${100 + i}k customers.
- Reduced latency by ${10 + i}% on core paths.

Software Engineer — Acme Corp — 2015 – 2019
- Built internal tools in ${tool} and React.

EDUCATION
${school} — B.S. Computer Science — 2011 – 2015

SKILLS
System design, APIs, mentoring, code review

TOOLS
${tool}, TypeScript, PostgreSQL, Docker, AWS

LANGUAGES
English — fluent
French — professional
`,
    anchors: [
      { text: co, bucket: 'experience' },
      { text: school, bucket: 'education' },
      { text: tool, bucket: 'tools' },
      { text: 'System design', bucket: 'skills' },
    ],
  };
}

function modernResume(i) {
  const name = person(i);
  const co = COMPANIES[(i + 2) % COMPANIES.length];
  const school = SCHOOLS[(i + 3) % SCHOOLS.length];
  return {
    id: `modern-${String(i + 1).padStart(2, '0')}`,
    category: 'modern',
    label: `Modern two-tone ${i + 1}`,
    text: `${name}  |  Product Designer
${name.split(' ')[0].toLowerCase()}@studio.com  ·  behance.net/${name.split(' ')[0].toLowerCase()}

PROFILE
Design leader focused on product systems, research, and cross-functional delivery.

CORE COMPETENCIES
Design systems · Prototyping · User research · Stakeholder alignment

PROFESSIONAL EXPERIENCE
Lead Designer · ${co} · Remote · 2020 – Present
▸ Grew design system adoption to ${70 + i}% across 4 squads.
▸ Partnered with PM and engineering on roadmap planning.

Designer · Studio North · 2016 – 2020
▸ Delivered mobile onboarding improving activation by ${12 + i}%.

EDUCATION
${school} — M.A. Design — 2014 – 2016

TECHNICAL SKILLS
Figma, Sketch, Principle, HTML/CSS

LANGUAGES
English — native · Spanish — conversational
`,
    anchors: [
      { text: co, bucket: 'experience' },
      { text: school, bucket: 'education' },
      { text: 'Figma', bucket: 'tools' },
      { text: 'Design systems', bucket: 'skills' },
    ],
  };
}

function canvaResume(i) {
  const name = person(i);
  const co = COMPANIES[(i + 4) % COMPANIES.length];
  return {
    id: `canva-${String(i + 1).padStart(2, '0')}`,
    category: 'canva',
    label: `Canva-style ${i + 1}`,
    text: `✦ ${name.toUpperCase()}
Creative Strategist ✦ Brand Storyteller

About Me
I help brands show up with clarity, color, and confidence across digital and print.

What I Do
✦ Brand identity  ✦ Campaign concepts  ✦ Social content

✦ Experience ✦
Creative Lead @ ${co} ( ${2018 + (i % 4)} – Present )
• Concepted seasonal campaigns for lifestyle and tech clients.
• Managed freelancers and vendors for photo shoots.

✦ Education ✦
${SCHOOLS[i % SCHOOLS.length]} — Visual Communication

✦ Tools ✦
Canva Pro, Photoshop, Illustrator, Premiere

✦ Languages ✦
English · French
`,
    anchors: [
      { text: co, bucket: 'experience' },
      { text: SCHOOLS[i % SCHOOLS.length], bucket: 'education' },
      { text: 'Photoshop', bucket: 'tools' },
    ],
  };
}

function creativeResume(i) {
  const name = person(i);
  const client = COMPANIES[i % COMPANIES.length];
  const client2 = COMPANIES[(i + 1) % COMPANIES.length];
  return {
    id: `creative-${String(i + 1).padStart(2, '0')}`,
    category: 'creative',
    label: `Creative portfolio ${i + 1}`,
    text: `${name}
Art Director · Illustrator
${name.split(' ')[0].toLowerCase()}@mail.com · Instagram · LinkedIn

SUMMARY
Visual storyteller for brands including ${client} and ${client2}.

EXPERIENCE
Freelance Illustrator — Independent — 2012 – Present
- Editorial and packaging illustration for global clients.

CLIENTS
${client}
${client2}
Adobe
Nike

PROJECTS
${client} campaign — key visual series
Editorial spread — personal work

AWARDS
D&AD Pencil ${2020 + (i % 4)}
Communication Arts feature

EXHIBITIONS
Saatchi Gallery — Group Show ${2019 + (i % 3)}

PUBLICATIONS
Featured in Creative Review

EDUCATION
LISAA — Bachelor Design
Créapole — Visual Communication

TOOLS
Illustrator, Photoshop, InDesign

LANGUAGES
French — native
English — fluent
`,
    anchors: [
      { text: client, bucket: 'clients' },
      { text: 'D&AD', bucket: 'awards' },
      { text: 'Saatchi', bucket: 'exhibitions' },
      { text: 'Creative Review', bucket: 'publications' },
      { text: 'LISAA', bucket: 'education' },
      { text: 'Illustrator', bucket: 'tools' },
    ],
  };
}

/** Deterministic OCR-like degradation for scanned category. */
export function simulateScannedNoise(text, seed = 1) {
  const rnd = seededRand(seed);
  const lines = String(text || '').split('\n');
  const out = lines.map((line) => {
    let l = line;
    if (rnd() < 0.12 && l.length > 8) {
      l = l.replace(/\b([a-z]{5,})\b/gi, (m) =>
        rnd() < 0.4 ? m.split('').join(' ') : m.replace(/rn/g, 'm')
      );
    }
    if (rnd() < 0.08) l = l.replace(/fi/g, 'ﬁ').replace(/fl/g, 'ﬂ');
    if (rnd() < 0.06) l = l.replace(/0/g, 'O').replace(/1/g, 'l');
    if (rnd() < 0.05 && l.length > 4) l = ` ${l} `;
    return l;
  });
  return out.join('\n');
}

function scannedResume(i) {
  const base = atsResume(i);
  const noisy = simulateScannedNoise(base.text, 1000 + i * 17);
  return {
    id: `scanned-${String(i + 1).padStart(2, '0')}`,
    category: 'scanned',
    label: `Scanned OCR ${i + 1}`,
    text: noisy,
    anchors: base.anchors,
    simulatedOcr: true,
  };
}

function buildCategory(factory, count = 10) {
  return Array.from({ length: count }, (_, i) => factory(i));
}

export const STRESS_CATEGORIES = [
  { id: 'ats', label: 'ATS resumes', description: 'Single-column, standard section headers' },
  { id: 'modern', label: 'Modern resumes', description: 'Profile / competencies / experience blocks' },
  { id: 'canva', label: 'Canva resumes', description: 'Decorative headers and informal sections' },
  { id: 'creative', label: 'Creative resumes', description: 'Clients, projects, awards, exhibitions' },
  { id: 'scanned', label: 'Scanned resumes', description: 'ATS content with OCR-like noise' },
];

export const STRESS_FIXTURES = [
  ...buildCategory(atsResume),
  ...buildCategory(modernResume),
  ...buildCategory(canvaResume),
  ...buildCategory(creativeResume),
  ...buildCategory(scannedResume),
];

export function fixturesByCategory(categoryId) {
  return STRESS_FIXTURES.filter((f) => f.category === categoryId);
}
