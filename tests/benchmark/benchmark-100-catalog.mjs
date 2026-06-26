/**
 * 100 CV benchmark — 20 per archetype (creative, developer, marketing, recruiter, consultant).
 * Synthetic, seeded fixtures with embedded ground truth. No candidate-specific literals.
 */

import { parseGroundTruthFromFixture } from '../lib/section-ground-truth.mjs';

const FIRST = [
  'Alex', 'Jordan', 'Sam', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn', 'Jamie',
  'Noah', 'Emma', 'Liam', 'Olivia', 'Ethan', 'Sophia', 'Lucas', 'Mia', 'Henry', 'Chloe',
];
const LAST = [
  'Chen', 'Martin', 'Patel', 'Garcia', 'Kim', 'Nguyen', 'Brooks', 'Silva', 'Dubois', 'Khan',
  'Walker', 'Reed', 'Cole', 'Hayes', 'Bennett', 'Foster', 'Gray', 'Howard', 'Coleman', 'Ross',
];
const CITIES = ['San Francisco', 'London', 'Paris', 'New York', 'Berlin', 'Toronto', 'Sydney'];
const DEV_COMPANIES = ['Stripe', 'Dropbox', 'Atlassian', 'Shopify', 'Datadog', 'Cloudflare', 'Twilio', 'MongoDB'];
const CREATIVE_CLIENTS = ['Nike', 'Adobe', 'Marvel', 'Spotify', 'Pantone', 'Fortune', 'Converse', 'Arte'];
const MKT_COMPANIES = ['GrowthLab', 'Unilever', 'HubSpot', 'Salesforce', 'Canva', 'Mailchimp', 'Shopify', 'Spotify'];
const REC_COMPANIES = ['TechScale', 'Randstad', 'Greenhouse', 'LinkedIn', 'Indeed', 'Adecco', 'Robert Half', 'Hired'];
const CONS_COMPANIES = ['Deloitte', 'McKinsey', 'BCG', 'Bain', 'Accenture', 'KPMG', 'EY', 'PwC'];
const SCHOOLS = ['MIT', 'Stanford', 'HEC Paris', 'NYU', 'LSE', 'Sciences Po', 'LISAA', 'Créapole', 'Berkeley', 'Columbia'];

function person(i) {
  return `${FIRST[i % FIRST.length]} ${LAST[(i + 3) % LAST.length]}`;
}

function emailFor(name, i) {
  const [first, last] = name.toLowerCase().split(/\s+/);
  return `${first}.${last}${i % 10}@email.com`;
}

function phoneFor(i) {
  const area = 415 + (i % 50);
  const tail = 1000 + i;
  return `+1 ${area} 555 ${String(tail).padStart(4, '0')}`;
}

function buildGroundTruth(text, identity) {
  const parsed = parseGroundTruthFromFixture(text);
  return {
    name: identity.name,
    email: identity.email,
    phone: identity.phone,
    experience: parsed.experience,
    education: parsed.education,
    skills: parsed.skills,
    tools: parsed.tools,
    languages: parsed.languages,
    clients: parsed.clients,
  };
}

function developerCv(i) {
  const name = person(i);
  const email = emailFor(name, i);
  const phone = phoneFor(i);
  const city = CITIES[i % CITIES.length];
  const co1 = DEV_COMPANIES[i % DEV_COMPANIES.length];
  const co2 = DEV_COMPANIES[(i + 2) % DEV_COMPANIES.length];
  const school = SCHOOLS[i % SCHOOLS.length];
  const y1 = 2017 + (i % 3);
  const y2 = y1 - 4;
  const y3 = y2 - 4;
  const text = `${name}
Senior Software Engineer
${email} · ${phone} · ${city}

Summary
Full-stack engineer with ${6 + (i % 5)} years building APIs, distributed systems, and developer tooling.

Experience
Senior Software Engineer — ${co1} — ${city} — ${y1} – Present
- Led migration of billing microservices to Kubernetes, improving deployment frequency by ${3 + (i % 4)}x.
- Built observability dashboards used by ${150 + i} engineers.

Software Engineer — ${co2} — ${y2} – ${y1}
- Shipped performance improvements reducing latency by ${20 + (i % 15)}%.

Education
${school} — B.S. Computer Science — ${y3 - 4} – ${y3}

Skills
System design, API design, distributed systems, mentoring, code review

Tools
TypeScript, Python, Go, React, PostgreSQL, Docker, Kubernetes, AWS

Languages
English — fluent
Spanish — conversational
`;
  return {
    id: `developer-${String(i + 1).padStart(2, '0')}`,
    archetype: 'developer',
    label: `Developer CV ${i + 1}`,
    text,
    groundTruth: buildGroundTruth(text, { name, email, phone }),
  };
}

function creativeCv(i) {
  const name = person(i + 5);
  const email = emailFor(name, i);
  const phone = phoneFor(i + 100);
  const clientA = CREATIVE_CLIENTS[i % CREATIVE_CLIENTS.length];
  const clientB = CREATIVE_CLIENTS[(i + 1) % CREATIVE_CLIENTS.length];
  const schoolA = SCHOOLS[(i + 6) % SCHOOLS.length];
  const schoolB = SCHOOLS[(i + 7) % SCHOOLS.length];
  const startYear = 2010 + (i % 4);
  const eduEnd = startYear - 2;
  const eduStart = eduEnd - 3;
  const text = `${name}
Graphic Designer & Illustrator
${email} · ${phone} · Portfolio · LinkedIn

Profile
Creative professional specializing in illustration, graphic design and visual storytelling for cultural and commercial projects.

Experience
Freelance Illustrator / Graphic Designer — Independent / Freelance — ${startYear} – Present
- Created illustration and graphic design work across posters, packaging, logos and brand assets.
- Collaborated with brands including ${clientA}, ${clientB}, and cultural clients.

Education
${schoolA} — Web & Motion Design — ${eduStart} – ${eduEnd}
${schoolB} — Visual Communication / Product Design — ${eduStart - 4} – ${eduStart}

Skills
Illustration, Graphic Design, Visual Identity, Poster Design, Packaging, Art Direction

Tools
Photoshop, Illustrator, InDesign, Adobe Creative Suite

Languages
French — native
English — fluent
`;
  return {
    id: `creative-${String(i + 1).padStart(2, '0')}`,
    archetype: 'creative',
    label: `Creative CV ${i + 1}`,
    text,
    groundTruth: buildGroundTruth(text, { name, email, phone }),
  };
}

function marketingCv(i) {
  const name = person(i + 10);
  const email = emailFor(name, i);
  const phone = phoneFor(i + 200);
  const city = CITIES[(i + 2) % CITIES.length];
  const co1 = MKT_COMPANIES[i % MKT_COMPANIES.length];
  const co2 = MKT_COMPANIES[(i + 3) % MKT_COMPANIES.length];
  const school1 = SCHOOLS[(i + 1) % SCHOOLS.length];
  const school2 = SCHOOLS[(i + 4) % SCHOOLS.length];
  const text = `${name}
Digital Marketing Manager
${email} · ${phone} · ${city}

Profile
Growth marketer with ${5 + (i % 6)} years driving acquisition, brand campaigns, and marketing automation.

Experience
Digital Marketing Manager — ${co1} — ${city} — 2020 – Present
- Scaled paid social spend to £${1 + (i % 3)}M ARR with ${2 + (i % 2)}.${i % 10}x ROAS.
- Launched email nurture flows lifting MQL conversion by ${20 + (i % 12)}%.

Marketing Executive — ${co2} — 2016 – 2020
- Managed integrated campaigns across regional markets.

Education
${school1} — MSc Marketing — 2014 – 2015
${school2} — BA Communications — 2011 – 2014

Skills
Growth marketing, SEO, content strategy, campaign management, analytics

Tools
Google Analytics, HubSpot, Meta Ads Manager, Canva, Excel

Languages
English — native
French — professional
`;
  return {
    id: `marketing-${String(i + 1).padStart(2, '0')}`,
    archetype: 'marketing',
    label: `Marketing CV ${i + 1}`,
    text,
    groundTruth: buildGroundTruth(text, { name, email, phone }),
  };
}

function recruiterCv(i) {
  const name = person(i + 15);
  const email = emailFor(name, i);
  const phone = phoneFor(i + 300);
  const city = CITIES[(i + 4) % CITIES.length];
  const co1 = REC_COMPANIES[i % REC_COMPANIES.length];
  const co2 = REC_COMPANIES[(i + 2) % REC_COMPANIES.length];
  const school = SCHOOLS[(i + 2) % SCHOOLS.length];
  const text = `${name}
Senior Talent Acquisition Specialist
${email} · ${phone} · ${city}

Profile
Corporate recruiter specializing in tech and creative hiring, full-cycle recruitment, and employer branding.

Experience
Senior Recruiter — ${co1} — ${city} — 2019 – Present
- Hired ${60 + i} engineers and product roles in 24 months.
- Reduced time-to-fill from ${60 + (i % 10)} to ${35 + (i % 8)} days.

Recruiter — ${co2} — 2015 – 2019
- Managed requisitions for finance and operations roles across regional markets.

Education
${school} — B.A. Human Resources — 2011 – 2015

Skills
Full-cycle recruiting, sourcing, interviewing, ATS management, employer branding

Tools
LinkedIn Recruiter, Greenhouse, Workday, Excel

Languages
English — native
Spanish — conversational
`;
  return {
    id: `recruiter-${String(i + 1).padStart(2, '0')}`,
    archetype: 'recruiter',
    label: `Recruiter CV ${i + 1}`,
    text,
    groundTruth: buildGroundTruth(text, { name, email, phone }),
  };
}

function consultantCv(i) {
  const name = person(i + 7);
  const email = emailFor(name, i);
  const phone = phoneFor(i + 400);
  const city = CITIES[(i + 1) % CITIES.length];
  const co1 = CONS_COMPANIES[(i + 1) % CONS_COMPANIES.length];
  const co2 = CONS_COMPANIES[i % CONS_COMPANIES.length];
  const school1 = SCHOOLS[(i + 3) % SCHOOLS.length];
  const school2 = SCHOOLS[(i + 5) % SCHOOLS.length];
  const text = `${name}
Management Consultant
${email} · ${phone} · ${city}

Profile
Strategy and operations consultant helping leadership teams on transformation, cost optimization, and integration programs.

Experience
Senior Consultant — ${co1} — ${city} — 2018 – Present
- Led €${30 + i}M cost transformation program for European retailer.
- Facilitated executive workshops with multi-country leadership teams.

Business Analyst — ${co2} — 2014 – 2018
- Built financial models supporting M&A due diligence.

Education
${school1} — Master in Management — 2012 – 2014
${school2} — Bachelor in Economics — 2009 – 2012

Skills
Strategy, operations, financial modeling, stakeholder management, facilitation

Tools
Excel, PowerPoint, SQL, Tableau

Languages
French — native
English — fluent
German — professional
`;
  return {
    id: `consultant-${String(i + 1).padStart(2, '0')}`,
    archetype: 'consultant',
    label: `Consultant CV ${i + 1}`,
    text,
    groundTruth: buildGroundTruth(text, { name, email, phone }),
  };
}

function buildCategory(factory, count = 20) {
  return Array.from({ length: count }, (_, i) => factory(i));
}

export const BENCHMARK_100_CATEGORIES = [
  { id: 'creative', label: 'Creative CVs', count: 20 },
  { id: 'developer', label: 'Developer CVs', count: 20 },
  { id: 'marketing', label: 'Marketing CVs', count: 20 },
  { id: 'recruiter', label: 'Recruiter CVs', count: 20 },
  { id: 'consultant', label: 'Consultant CVs', count: 20 },
];

export const BENCHMARK_100_FIXTURES = [
  ...buildCategory(creativeCv),
  ...buildCategory(developerCv),
  ...buildCategory(marketingCv),
  ...buildCategory(recruiterCv),
  ...buildCategory(consultantCv),
];

export function fixturesByArchetype(archetype) {
  return BENCHMARK_100_FIXTURES.filter((f) => f.archetype === archetype);
}
