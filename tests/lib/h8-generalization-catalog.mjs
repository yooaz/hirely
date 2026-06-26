/**
 * H8 — 100 CV generalization stress corpus (10 archetypes × 10).
 */
import { parseGroundTruthFromFixture } from './section-ground-truth.mjs';

export const H8_ENGINE = 'HIRELY_H8_GENERALIZATION_STRESS';
export const H8_ARCHETYPES = [
  'developer',
  'designer',
  'marketing',
  'sales',
  'finance',
  'legal',
  'healthcare',
  'student',
  'executive',
  'consultant',
];

const FIRST = [
  'Alex', 'Jordan', 'Sam', 'Taylor', 'Morgan', 'Casey', 'Riley', 'Avery', 'Quinn', 'Jamie',
];
const LAST = [
  'Chen', 'Martin', 'Patel', 'Garcia', 'Kim', 'Nguyen', 'Brooks', 'Silva', 'Dubois', 'Khan',
];
const CITIES = ['San Francisco', 'London', 'Paris', 'New York', 'Berlin', 'Toronto', 'Sydney', 'Singapore'];

export const H8_ARCHETYPE_TEMPLATE = {
  developer: 'ats',
  designer: 'creative',
  marketing: 'premium',
  sales: 'ats',
  finance: 'executive',
  legal: 'minimal',
  healthcare: 'ats',
  student: 'minimal',
  executive: 'executive',
  consultant: 'premium',
};

function person(i) {
  return `${FIRST[i % FIRST.length]} ${LAST[(i + 3) % LAST.length]}`;
}

function emailFor(name, i) {
  const [first, last] = name.toLowerCase().split(/\s+/);
  return `${first}.${last}${i % 10}@email.com`;
}

function phoneFor(i) {
  return `+1 ${415 + (i % 50)} 555 ${String(1000 + i).padStart(4, '0')}`;
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
  };
}

function baseFixture(id, archetype, label, text, identity) {
  return {
    id,
    archetype,
    label,
    text,
    templateId: H8_ARCHETYPE_TEMPLATE[archetype] || 'ats',
    groundTruth: buildGroundTruth(text, identity),
  };
}

function developerCv(i) {
  const name = person(i);
  const email = emailFor(name, i);
  const phone = phoneFor(i);
  const city = CITIES[i % CITIES.length];
  const co1 = ['Stripe', 'Dropbox', 'Atlassian', 'Shopify'][i % 4];
  const co2 = ['Datadog', 'Cloudflare', 'Twilio', 'MongoDB'][(i + 1) % 4];
  const y1 = 2018 + (i % 4);
  const text = `${name}
Senior Software Engineer
${email} · ${phone} · ${city}

Summary
Full-stack engineer with ${5 + (i % 6)} years building APIs, distributed systems, and developer tooling.

Experience
Senior Software Engineer — ${co1} — ${city} — ${y1} – Present
- Led migration of billing microservices to Kubernetes.
- Built observability dashboards used by ${120 + i} engineers.

Software Engineer — ${co2} — ${y1 - 4} – ${y1}
- Shipped performance improvements reducing latency by ${15 + (i % 20)}%.

Education
MIT — B.S. Computer Science — ${y1 - 8} – ${y1 - 4}

Skills
System design, API design, distributed systems, mentoring, code review

Tools
TypeScript, Python, Go, React, PostgreSQL, Docker, Kubernetes, AWS

Languages
English — fluent
Spanish — conversational
`;
  return baseFixture(`h8-dev-${String(i + 1).padStart(2, '0')}`, 'developer', `Developer ${i + 1}`, text, { name, email, phone });
}

function designerCv(i) {
  const name = person(i + 1);
  const email = emailFor(name, i);
  const phone = phoneFor(i + 50);
  const clientA = ['Nike', 'Adobe', 'Marvel', 'Spotify'][i % 4];
  const clientB = ['Pantone', 'Fortune', 'Converse', 'Arte'][(i + 1) % 4];
  const y = 2012 + (i % 5);
  const text = `${name}
Graphic Designer & Illustrator
${email} · ${phone} · Portfolio · LinkedIn

Profile
Creative professional specializing in illustration, graphic design and visual storytelling.

Experience
Freelance Illustrator / Graphic Designer — Independent — ${y} – Present
- Created illustration and brand assets for ${clientA}, ${clientB}, and cultural clients.

Education
LISAA — Web & Motion Design — ${y - 6} – ${y - 2}
Créapole — Visual Communication — ${y - 10} – ${y - 6}

Skills
Illustration, Graphic Design, Visual Identity, Poster Design, Art Direction

Tools
Photoshop, Illustrator, InDesign, Figma

Languages
French — native
English — fluent
`;
  return baseFixture(`h8-des-${String(i + 1).padStart(2, '0')}`, 'designer', `Designer ${i + 1}`, text, { name, email, phone });
}

function marketingCv(i) {
  const name = person(i + 2);
  const email = emailFor(name, i);
  const phone = phoneFor(i + 100);
  const city = CITIES[(i + 2) % CITIES.length];
  const co1 = ['HubSpot', 'Unilever', 'Canva', 'Mailchimp'][i % 4];
  const co2 = ['Salesforce', 'Shopify', 'Spotify', 'GrowthLab'][(i + 2) % 4];
  const text = `${name}
Digital Marketing Manager
${email} · ${phone} · ${city}

Profile
Growth marketer with ${4 + (i % 7)} years driving acquisition, brand campaigns, and automation.

Experience
Digital Marketing Manager — ${co1} — ${city} — 2020 – Present
- Scaled paid social spend with ${2 + (i % 3)}x ROAS improvement.
- Launched email nurture flows lifting MQL conversion by ${18 + (i % 15)}%.

Marketing Executive — ${co2} — 2016 – 2020
- Managed integrated campaigns across regional markets.

Education
NYU — MSc Marketing — 2014 – 2015
Columbia — BA Communications — 2010 – 2014

Skills
Growth marketing, SEO, content strategy, campaign management, analytics

Tools
Google Analytics, HubSpot, Meta Ads Manager, Canva, Excel

Languages
English — native
French — professional
`;
  return baseFixture(`h8-mkt-${String(i + 1).padStart(2, '0')}`, 'marketing', `Marketing ${i + 1}`, text, { name, email, phone });
}

function salesCv(i) {
  const name = person(i + 3);
  const email = emailFor(name, i);
  const phone = phoneFor(i + 150);
  const city = CITIES[(i + 1) % CITIES.length];
  const co1 = ['Salesforce', 'HubSpot', 'Zendesk', 'Snowflake'][i % 4];
  const co2 = ['Oracle', 'SAP', 'Workday', 'ServiceNow'][(i + 1) % 4];
  const text = `${name}
Senior Account Executive
${email} · ${phone} · ${city}

Profile
B2B sales leader with ${6 + (i % 5)} years closing enterprise SaaS deals and building pipeline.

Experience
Senior Account Executive — ${co1} — ${city} — 2021 – Present
- Closed ${1.2 + (i % 4) * 0.3}M ARR in new logo revenue.
- Exceeded quota ${110 + (i % 20)}% for three consecutive years.

Account Executive — ${co2} — 2017 – 2021
- Managed ${40 + i} enterprise accounts across financial services.

Education
LSE — B.A. Economics — 2013 – 2017
Columbia — B.A. Business — 2009 – 2013

Skills
Enterprise sales, pipeline management, negotiation, forecasting, CRM hygiene

Tools
Salesforce, Outreach, Gong, LinkedIn Sales Navigator, Excel

Languages
English — native
Spanish — conversational
`;
  return baseFixture(`h8-sal-${String(i + 1).padStart(2, '0')}`, 'sales', `Sales ${i + 1}`, text, { name, email, phone });
}

function financeCv(i) {
  const name = person(i + 4);
  const email = emailFor(name, i);
  const phone = phoneFor(i + 200);
  const city = CITIES[(i + 3) % CITIES.length];
  const co1 = ['Goldman Sachs', 'JPMorgan', 'BlackRock', 'Morgan Stanley'][i % 4];
  const co2 = ['Deloitte', 'KPMG', 'EY', 'PwC'][(i + 2) % 4];
  const text = `${name}
Financial Analyst
${email} · ${phone} · ${city}

Profile
Finance professional with expertise in FP&A, modeling, and investor reporting.

Experience
Senior Financial Analyst — ${co1} — ${city} — 2019 – Present
- Built quarterly forecasts supporting ${200 + i}M revenue planning.
- Led variance analysis for executive leadership reviews.

Financial Analyst — ${co2} — 2015 – 2019
- Prepared audit-ready schedules and management dashboards.

Education
LSE — MSc Finance — 2013 – 2014
HEC Paris — Bachelor in Economics — 2010 – 2013

Skills
Financial modeling, FP&A, valuation, reporting, stakeholder management

Tools
Excel, Power BI, SQL, Bloomberg, SAP

Languages
English — fluent
French — native
`;
  return baseFixture(`h8-fin-${String(i + 1).padStart(2, '0')}`, 'finance', `Finance ${i + 1}`, text, { name, email, phone });
}

function legalCv(i) {
  const name = person(i + 5);
  const email = emailFor(name, i);
  const phone = phoneFor(i + 250);
  const city = CITIES[(i + 4) % CITIES.length];
  const firm1 = ['Kirkland & Ellis', 'Latham & Watkins', 'Clifford Chance', 'Freshfields'][i % 4];
  const firm2 = ['Allen & Overy', 'Linklaters', 'White & Case', 'Skadden'][(i + 1) % 4];
  const text = `${name}
Corporate Associate
${email} · ${phone} · ${city}

Profile
Corporate lawyer advising on M&A, venture financings, and commercial contracts.

Experience
Corporate Associate — ${firm1} — ${city} — 2018 – Present
- Advised on ${15 + i} cross-border acquisition transactions.
- Drafted and negotiated SaaS and licensing agreements.

Junior Associate — ${firm2} — 2015 – 2018
- Supported due diligence and disclosure schedules for PE deals.

Education
Columbia — J.D. Law — 2012 – 2015
Sciences Po — B.A. Political Science — 2008 – 2012

Skills
M&A, venture finance, contract negotiation, due diligence, legal research

Tools
Westlaw, LexisNexis, Microsoft Word, Excel

Languages
English — native
German — professional
`;
  return baseFixture(`h8-leg-${String(i + 1).padStart(2, '0')}`, 'legal', `Legal ${i + 1}`, text, { name, email, phone });
}

function healthcareCv(i) {
  const name = person(i + 6);
  const email = emailFor(name, i);
  const phone = phoneFor(i + 300);
  const city = CITIES[(i + 5) % CITIES.length];
  const org1 = ['Mayo Clinic', 'Pfizer', 'Johnson & Johnson', 'NHS'][i % 4];
  const org2 = ['Roche', 'Novartis', 'GSK', 'AstraZeneca'][(i + 2) % 4];
  const text = `${name}
Clinical Research Coordinator
${email} · ${phone} · ${city}

Profile
Healthcare operations specialist with ${5 + (i % 4)} years in clinical trials and patient programs.

Experience
Clinical Research Coordinator — ${org1} — ${city} — 2019 – Present
- Coordinated Phase II trials across ${6 + (i % 4)} sites.
- Improved patient enrollment timelines by ${12 + (i % 10)}%.

Research Associate — ${org2} — 2016 – 2019
- Maintained regulatory documentation and site monitoring logs.

Education
Stanford — MPH — 2014 – 2016
Berkeley — B.S. Biology — 2010 – 2014

Skills
Clinical operations, regulatory compliance, patient coordination, data quality

Tools
REDCap, Medidata, Excel, Epic

Languages
English — native
Spanish — conversational
`;
  return baseFixture(`h8-hlt-${String(i + 1).padStart(2, '0')}`, 'healthcare', `Healthcare ${i + 1}`, text, { name, email, phone });
}

function studentCv(i) {
  const name = person(i + 7);
  const email = emailFor(name, i);
  const phone = phoneFor(i + 350);
  const city = CITIES[i % CITIES.length];
  const internCo = ['Monzo', 'Revolut', 'Stripe', 'Shopify'][i % 4];
  const school = ['Berkeley', 'MIT', 'Stanford', 'Columbia'][(i + 1) % 4];
  const school2 = ['NYU', 'LSE', 'HEC Paris', 'Sciences Po'][i % 4];
  const text = `${name}
Computer Science Student
${email} · ${phone} · ${city}

Profile
Final-year student seeking software engineering roles with internship experience in fintech.

Experience
Software Engineering Intern — ${internCo} — Summer ${2024 + (i % 2)}
- Built internal tooling improving onboarding workflow for ${20 + i} engineers.

Teaching Assistant — ${school} — 2023 – Present
- Supported algorithms coursework for ${80 + i} students.

Education
${school} — BSc Computer Science — 2021 – 2025
${school2} — B.S. Mathematics — 2019 – 2021

Skills
Algorithms, data structures, Python, JavaScript, teamwork

Tools
Python, Git, React, PostgreSQL, Docker

Languages
English — native
French — intermediate
`;
  return baseFixture(`h8-stu-${String(i + 1).padStart(2, '0')}`, 'student', `Student ${i + 1}`, text, { name, email, phone });
}

function executiveCv(i) {
  const name = person(i + 8);
  const email = emailFor(name, i);
  const phone = phoneFor(i + 400);
  const city = CITIES[(i + 2) % CITIES.length];
  const co1 = ['Salesforce', 'Adobe', 'ServiceNow', 'Workday'][i % 4];
  const co2 = ['Oracle', 'SAP', 'Intuit', 'Autodesk'][(i + 1) % 4];
  const text = `${name}
Chief Operating Officer
${email} · ${phone} · ${city}

Profile
Operations executive with ${15 + (i % 8)} years scaling global SaaS businesses through operational excellence.

Experience
Chief Operating Officer — ${co1} — ${city} — 2019 – Present
- Scaled organization from ${400 + i * 10} to ${900 + i * 15} employees.
- Led integration of two acquisitions totaling $${180 + i * 5}M.

VP Operations — ${co2} — 2013 – 2019
- Owned global support, professional services, and business systems.

Education
HEC Paris — MBA — 2009 – 2011
Berkeley — B.S. Industrial Engineering — 2003 – 2007

Skills
Operations strategy, P&L ownership, M&A integration, executive leadership

Tools
Excel, Tableau, Workday, Salesforce

Languages
English — native
French — professional
`;
  return baseFixture(`h8-exe-${String(i + 1).padStart(2, '0')}`, 'executive', `Executive ${i + 1}`, text, { name, email, phone });
}

function consultantCv(i) {
  const name = person(i + 9);
  const email = emailFor(name, i);
  const phone = phoneFor(i + 450);
  const city = CITIES[(i + 1) % CITIES.length];
  const co1 = ['McKinsey', 'BCG', 'Bain', 'Deloitte'][i % 4];
  const co2 = ['Accenture', 'KPMG', 'EY', 'PwC'][(i + 2) % 4];
  const text = `${name}
Management Consultant
${email} · ${phone} · ${city}

Profile
Strategy and operations consultant helping leadership teams on transformation programs.

Experience
Senior Consultant — ${co1} — ${city} — 2018 – Present
- Led €${25 + i}M cost transformation program for European retailer.
- Facilitated executive workshops with multi-country leadership teams.

Business Analyst — ${co2} — 2014 – 2018
- Built financial models supporting M&A due diligence.

Education
HEC Paris — Master in Management — 2012 – 2014
Sciences Po — Bachelor in Economics — 2009 – 2012

Skills
Strategy, operations, financial modeling, stakeholder management, facilitation

Tools
Excel, PowerPoint, SQL, Tableau

Languages
French — native
English — fluent
German — professional
`;
  return baseFixture(`h8-con-${String(i + 1).padStart(2, '0')}`, 'consultant', `Consultant ${i + 1}`, text, { name, email, phone });
}

const BUILDERS = {
  developer: developerCv,
  designer: designerCv,
  marketing: marketingCv,
  sales: salesCv,
  finance: financeCv,
  legal: legalCv,
  healthcare: healthcareCv,
  student: studentCv,
  executive: executiveCv,
  consultant: consultantCv,
};

function buildCategory(archetype, count = 10) {
  const factory = BUILDERS[archetype];
  return Array.from({ length: count }, (_, i) => factory(i));
}

/** @type {Array<ReturnType<typeof baseFixture>>} */
export const H8_STRESS_FIXTURES = H8_ARCHETYPES.flatMap((a) => buildCategory(a, 10));

export function fixturesByArchetype(archetype) {
  return H8_STRESS_FIXTURES.filter((f) => f.archetype === archetype);
}
