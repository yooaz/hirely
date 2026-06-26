#!/usr/bin/env node
/**
 * P0 — Template data integrity: missing OK, wrong forbidden (all production templates).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  TEN_PREMIUM_TEMPLATE_IDS,
  TEN_PREMIUM_TEMPLATE_NAMES,
} from '../ui/templates/ten-premium-templates.mjs';
import {
  DATA_INTEGRITY_TENETS,
  DATA_INTEGRITY_TENET_LINES,
  isAcceptableDisplayName,
} from '../core/validation/no-fake-data-policy.js';
import {
  FINAL_CV_FORBIDDEN_PLACEHOLDERS,
  isFinalCvPlaceholder,
} from '../core/validation/final-cv-placeholder-guard.js';
import { loadHirelyTemplates } from './lib/pdf-hardening-suite.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const OUT_DIR = path.join(ROOT, 'tests/output/template-data-integrity');

const FORBIDDEN_IN_HTML = [
  ...FINAL_CV_FORBIDDEN_PLACEHOLDERS,
  'Email à confirmer',
  'Téléphone à confirmer',
  'Poste à compléter',
];

let failed = 0;
const checks = [];

function record(id, pass, detail = '') {
  checks.push({ id, pass, detail });
  if (!pass) {
    failed++;
    console.error(`FAIL ${id}${detail ? ` — ${detail}` : ''}`);
  } else {
    console.log(`PASS ${id}`);
  }
}

function stripText(html) {
  return String(html || '')
    .replace(/<[^>]+>/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function htmlForbiddenHits(html) {
  const text = stripText(html).toLowerCase();
  const hits = [];
  for (const frag of FORBIDDEN_IN_HTML) {
    if (text.includes(String(frag).toLowerCase())) hits.push(frag);
  }
  if (/\blorem\s+ipsum\b/i.test(text)) hits.push('lorem ipsum');
  return hits;
}

function cvNameText(html) {
  const m = String(html || '').match(/class="cvName"[^>]*>([^<]+)/i);
  return (m?.[1] || '').replace(/&amp;/g, '&').trim();
}

record('tenets_exported', DATA_INTEGRITY_TENET_LINES.length === 5);
record('missing_acceptable', DATA_INTEGRITY_TENETS.missingAcceptable === true);
record('wrong_forbidden', DATA_INTEGRITY_TENETS.wrongForbidden === true);

const HT = loadHirelyTemplates();
fs.mkdirSync(OUT_DIR, { recursive: true });

record(
  'unknown_template_falls_back_to_ats',
  HT.resolve('not-a-real-template-id').id === 'ats',
  HT.resolve('not-a-real-template-id').id
);

const scenarios = [
  {
    id: 'sparse',
    label: 'missing name + email',
    cv: {
      name: '',
      title: 'Product Designer',
      email: '',
      phone: '',
      location: 'Paris',
      summary: 'Designer focused on brand systems and editorial layout.',
      experience: ['Art Director — Studio Nova — 2018–Present'],
      education: [],
      skills: ['Branding', 'Typography'],
      _fromFinalResumeData: true,
    },
    assert(html) {
      const hits = htmlForbiddenHits(html);
      const name = cvNameText(html);
      return {
        pass: hits.length === 0 && !name,
        detail: hits.length ? hits.join(', ') : name || 'empty name OK',
      };
    },
  },
  {
    id: 'corrupted_email',
    label: 'corrupted email stripped',
    cv: {
      name: 'Marie Laurent',
      title: 'Consultant',
      email: 'not-an-email',
      phone: '+33 6 12 34 56 78',
      summary: 'Strategy consultant for luxury and technology brands.',
      experience: ['Consultant — Bain — 2019–Present'],
      _fromFinalResumeData: true,
    },
    assert(html) {
      const text = stripText(html).toLowerCase();
      const hits = htmlForbiddenHits(html);
      return {
        pass: hits.length === 0 && !text.includes('not-an-email'),
        detail: hits.join(', ') || (text.includes('not-an-email') ? 'corrupted email leaked' : 'email omitted'),
      };
    },
  },
  {
    id: 'company_as_name',
    label: 'employer name not used as identity',
    cv: {
      name: 'Nike',
      title: 'Art Director',
      email: 'alex@studio.example',
      experience: [{ role: 'Art Director', company: 'Nike', dates: '2020–Present' }],
      _fromFinalResumeData: true,
    },
    assert(html) {
      const name = cvNameText(html);
      const hits = htmlForbiddenHits(html);
      const ok = hits.length === 0 && name !== 'Nike' && !name;
      return {
        pass: ok,
        detail: hits.join(', ') || name || 'name empty (OK)',
      };
    },
  },
  {
    id: 'uncertain_labels',
    label: 'parser confirm labels stripped',
    cv: {
      name: 'Nom à confirmer',
      title: 'Poste à compléter',
      email: 'Email à confirmer',
      summary: 'Information non détectée',
      experience: [],
      _fromFinalResumeData: true,
    },
    assert(html) {
      const hits = htmlForbiddenHits(html);
      const name = cvNameText(html);
      return {
        pass: hits.length === 0 && !name,
        detail: hits.join(', ') || 'clean',
      };
    },
  },
];

const templateRows = [];

for (const templateId of TEN_PREMIUM_TEMPLATE_IDS) {
  for (const scenario of scenarios) {
    const html = String(HT.render(scenario.cv, templateId) || '');
    const result = scenario.assert(html);
    record(`${templateId}:${scenario.id}`, result.pass, result.detail);

    if (scenario.id === 'sparse') {
      const name = cvNameText(html);
      record(
        `${templateId}:acceptable_name_policy`,
        !name || isAcceptableDisplayName(name, scenario.cv.experience || []),
        name || '(empty)'
      );
    }
  }

  const mini = HT.renderMini ? HT.renderMini(templateId) : '';
  const miniHits = htmlForbiddenHits(mini);
  record(`${templateId}:mini_no_fake_labels`, miniHits.length === 0, miniHits.join(', '));

  templateRows.push({
    id: templateId,
    name: TEN_PREMIUM_TEMPLATE_NAMES[templateId],
    scenarios: scenarios.map((s) => {
      const html = String(HT.render(s.cv, templateId) || '');
      const result = s.assert(html);
      return { id: s.id, pass: result.pass, detail: result.detail };
    }),
    miniClean: miniHits.length === 0,
  });
}

const report = {
  generatedAt: new Date().toISOString(),
  tenets: DATA_INTEGRITY_TENET_LINES,
  pass: failed === 0,
  passCount: checks.filter((c) => c.pass).length,
  failCount: failed,
  checks,
  templates: templateRows,
};

fs.writeFileSync(path.join(OUT_DIR, 'report.json'), `${JSON.stringify(report, null, 2)}\n`);

console.log(`\n═══ Template Data Integrity: ${report.passCount}/${checks.length} PASS ═══`);
process.exit(failed ? 1 : 0);
