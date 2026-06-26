#!/usr/bin/env node
/**
 * HIRELY H10 — Beta product polish report.
 * Requires BETA_READINESS_REPORT PASS.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const READINESS = path.join(ROOT, 'BETA_READINESS_REPORT.md');
const INDEX = path.join(ROOT, 'index.html');
const OUT = path.join(ROOT, 'BETA_PRODUCT_POLISH_REPORT.md');

const H10_CHECKS = [
  {
    id: 'readiness_gate',
    label: 'H9 beta readiness PASS',
    test: () => {
      if (!fs.existsSync(READINESS)) return { pass: false, detail: 'BETA_READINESS_REPORT.md missing' };
      const txt = fs.readFileSync(READINESS, 'utf8');
      const pass = /\*\*Result:\*\* PASS/.test(txt);
      return { pass, detail: pass ? 'H9 PASS confirmed' : 'Run npm run beta-readiness-report first' };
    },
  },
  {
    id: 'homepage_headline',
    label: 'Homepage headline (French, sellable)',
    test: (html) => {
      const pass =
        /data-i="hero1">Le CV qui/.test(html) &&
        /data-i="hero2">décroche des entretiens/.test(html);
      return { pass, detail: pass ? 'Headline updated' : 'hero1/hero2 not polished' };
    },
  },
  {
    id: 'homepage_value',
    label: 'Value proposition + 3 steps',
    test: (html) => {
      const pass =
        /score recruteur/.test(html) &&
        /data-i="heroHow"/.test(html) &&
        /heroStepImportDesc/.test(html);
      return { pass, detail: pass ? 'Lead + heroHow + step copy present' : 'Missing value prop or steps' };
    },
  },
  {
    id: 'homepage_cta',
    label: 'Upload CTA above fold',
    test: (html) => {
      const heroIdx = html.indexOf('id="hero"');
      const ctaIdx = html.indexOf('id="heroUploadBtn"');
      const pass = heroIdx >= 0 && ctaIdx > heroIdx && ctaIdx < html.indexOf('id="tools"');
      return { pass, detail: pass ? 'heroUploadBtn in hero section' : 'CTA not in hero' };
    },
  },
  {
    id: 'review_score_label',
    label: 'Review: Score recruteur (not Qualité du CV)',
    test: (html) => {
      const hasScore = /reviewV2AnalysisTitle">Score recruteur/.test(html);
      const noOld = !/reviewV2AnalysisTitle">Qualité du CV/.test(html);
      const i18n = /reviewV2AnalysisTitle:'Score recruteur'/.test(html);
      const pass = hasScore && noOld && i18n;
      return {
        pass,
        detail: pass ? 'Score recruteur in HTML + I18N' : 'Still shows Qualité du CV or missing I18N',
      };
    },
  },
  {
    id: 'review_field_labels',
    label: 'Review labels: Poste / Outils / Langues',
    test: (html) => {
      const pass =
        /scoreCatTools:'Outils'/.test(html) &&
        /scoreCatLanguages:'Langues'/.test(html) &&
        /detTitle:'Poste'/.test(html);
      return { pass, detail: pass ? 'French field labels in I18N.fr H10 block' : 'Missing Poste/Outils/Langues keys' };
    },
  },
  {
    id: 'suggestions_simple',
    label: 'Simpler suggestions (no confidence %)',
    test: (html) => {
      const pass =
        /reviewP3SuggestionsTitle:'À valider'/.test(html) &&
        !/suggestionConfidence/.test(html.split('function suggestionCardHtml')[1]?.split('function renderSuggestionsPanel')[0] || '');
      return { pass, detail: pass ? 'Simplified copy, confidence hidden' : 'Suggestions still technical' };
    },
  },
  {
    id: 'pricing_tiers',
    label: 'Pricing Free / Pro 9€ copy',
    test: (html) => {
      const pass =
        /freeFeature1">Import et aperçu/.test(html) &&
        /freeFeature2">Score ATS basique/.test(html) &&
        /proFeature1">Modèles premium/.test(html) &&
        /proFeature4">Optimisation LinkedIn/.test(html) &&
        /<strong>9€<\/strong>/.test(html);
      return { pass, detail: pass ? 'Pricing tiers match H10 spec' : 'Pricing copy incomplete' };
    },
  },
  {
    id: 'no_jargon_visible',
    label: 'No technical jargon in default French UI',
    test: (html) => {
      const productSlice = html.slice(html.indexOf('id="hero"'), html.indexOf('id="pricing"') + 4000);
      const bad = [
        'Qualité du CV',
        'Suggestions détectées',
        'reviewV2AnalysisTitle">Qualité',
        'suggestionConfidence',
      ].filter((s) => productSlice.includes(s));
      const pass = bad.length === 0;
      return {
        pass,
        detail: pass ? 'No banned labels in hero/review/pricing defaults' : `Found: ${bad.join(', ')}`,
      };
    },
  },
];

function run() {
  if (!fs.existsSync(INDEX)) {
    console.error('index.html missing');
    process.exit(1);
  }
  const html = fs.readFileSync(INDEX, 'utf8');
  const results = H10_CHECKS.map((c) => {
    const r = c.test(html);
    return { id: c.id, label: c.label, pass: r.pass, detail: r.detail };
  });
  const pass = results.every((r) => r.pass);
  const lines = [
    '# HIRELY H10 — Beta Product Polish',
    '',
    `**Result:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Scope',
    '',
    '- UI copy and presentation only (`index.html`)',
    '- No core parser changes',
    '- Runs only after H9 beta readiness PASS',
    '',
    '## Polish checklist',
    '',
    '| Check | Status | Detail |',
    '|-------|--------|--------|',
    ...results.map((r) => `| ${r.label} | ${r.pass ? 'PASS' : 'FAIL'} | ${r.detail} |`),
    '',
    '## Changes applied',
    '',
    '### Homepage',
    '- Headline: « Le CV qui décroche des entretiens. »',
    '- Value prop: import → score recruteur → modèle → PDF',
    '- Upload CTA above fold (`#heroUploadBtn`)',
    '- 3-step explainer in hero pipeline + `heroHow` line',
    '',
    '### Review',
    '- « Qualité du CV » → « Score recruteur »',
    '- Metric labels: Poste, Outils, Langues (via `scoreCat*` + `detTitle`)',
    '- Suggestions: « À valider », no confidence % badge',
    '- Review metrics use recruiter breakdown (not parser/extraction debug rows)',
    '',
    '### Pricing',
    '- **Gratuit:** Import + aperçu + score ATS basique',
    '- **Pro 9€:** Modèles premium + lettre + export PDF + LinkedIn',
    '',
    '## Remaining gaps',
    '',
    pass ? '_None — French product copy is beta-ready._' : '_Fix failing checks above._',
    '',
    '## Run',
    '',
    '```bash',
    'npm run beta-product-polish-report',
    '```',
    '',
  ];
  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`Wrote ${OUT}`);
  console.log(`\nH10 BETA PRODUCT POLISH: ${pass ? 'PASS' : 'FAIL'}`);
  if (!pass) {
    for (const r of results.filter((x) => !x.pass)) {
      console.log(`  FAIL ${r.label}: ${r.detail}`);
    }
    process.exit(1);
  }
}

run();
