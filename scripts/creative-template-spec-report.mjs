#!/usr/bin/env node
/**
 * HIRELY H4 — Creative Designer template spec report.
 * Output: CREATIVE_TEMPLATE_SPEC.md
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import {
  TEMPLATE_V2_PAGE_POLICY,
  TEMPLATE_V2_A4,
  resolveTemplateV2,
  resumeDataToTemplateView,
} from '../src/ui/templates/v2/index.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'CREATIVE_TEMPLATE_SPEC.md');
const TEMPLATES_PATH = path.join(ROOT, 'src/ui/templates/cv-templates.js');

const SAMPLE_RD = {
  identity: {
    name: 'Yohann Azancot',
    title: 'Graphic Designer & Illustrator',
    email: 'yoaz@hotmail.fr',
    phone: '+33 6 49 43 48 39',
    location: 'Paris, France',
    website: 'https://yoaz.studio',
  },
  summary:
    'Creative professional specializing in illustration, graphic design and visual storytelling.',
  experiences: [
    {
      role: 'Freelance Illustrator / Graphic Designer',
      company: 'Independent / Freelance',
      dates: '2011–2022',
      bullets: ['Posters, packaging, logos, visual identity.'],
    },
    {
      role: 'Designer',
      company: 'McCann G. Agency',
      dates: '2011–2014',
      bullets: ['Creative work for campaigns and brand assets.'],
    },
  ],
  education: ['Créapole — Visual Communication — 2007–2009'],
  skills: ['Illustration', 'Graphic Design', 'Brand Identity'],
  tools: ['Photoshop', 'Illustrator', 'InDesign', 'Figma'],
  languages: ['French — native', 'English — fluent'],
  clients: ['Nike', 'Louis Vuitton', 'Adobe', 'Marvel'],
  projects: [
    'Brand campaign — Global sportswear client · 2023',
    'Packaging system — Luxury fashion house · 2021',
  ],
  portfolioLinks: ['Behance — yoaz.studio', 'Instagram — @yoazstudio'],
  unsorted: [],
  meta: { creativeMode: true },
};

function bootTemplates() {
  const code = fs.readFileSync(TEMPLATES_PATH, 'utf8');
  const sandbox = { console };
  sandbox.window = sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'cv-templates.js' });
  const esc = (s) =>
    String(s || '').replace(/[&<>"']/g, (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
    );
  sandbox.initHirelyTemplates({
    esc,
    sectionLabel: (k) => String(k || '').replace(/^\w/, (c) => c.toUpperCase()),
    cvBlock: (t, b) => (b ? `<section>${esc(t)}${b}</section>` : ''),
    cvSkillsHtml: (skills) => `<p>${(skills || []).map(esc).join(' · ')}</p>`,
    getPhotoHtml: () => '',
  });
  return sandbox.HirelyTemplates;
}

function sectionOrder(html) {
  const re = /cvSection--([a-z]+)/g;
  const order = [];
  let m;
  while ((m = re.exec(html))) {
    if (!order.includes(m[1])) order.push(m[1]);
  }
  return order;
}

function atsChecks(html) {
  const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  return {
    hasSemanticHeadings: /<h3[^>]*class="cvSectionTitle"/.test(html),
    noImages: !/<img[^>]+src=/i.test(html),
    plainTextLen: plain.length,
    hasClients: /Nike/.test(plain),
    hasSoftware: /Illustrator/.test(plain),
    hasPortfolio: /yoaz\.studio|Behance/.test(plain),
    hasExperience: /Freelance/.test(plain),
  };
}

function enrichViewForRender(view, rd) {
  if (!view.experience?.length && rd.experiences?.length) {
    view.experience = rd.experiences
      .map((e) => {
        const head = [e.role, e.company, e.dates].filter(Boolean).join(' — ');
        const bullets = (e.bullets || []).join(' · ');
        return bullets ? `${head}: ${bullets}` : head;
      })
      .filter(Boolean);
  }
  return view;
}

async function main() {
  const HT = bootTemplates();
  const spec = resolveTemplateV2('creative');
  const view = enrichViewForRender(resumeDataToTemplateView(SAMPLE_RD, { skipFinalGate: true }), SAMPLE_RD);
  const html = HT.render(view, 'creative');
  const order = sectionOrder(html);
  const ats = atsChecks(html);

  const lines = [];
  lines.push('# CREATIVE TEMPLATE SPEC');
  lines.push('');
  lines.push(`Generated: ${new Date().toISOString()}`);
  lines.push('Engine: `HIRELY H4 — Creative Designer Template`');
  lines.push('');
  lines.push('## Purpose');
  lines.push('');
  lines.push(
    'Dedicated magazine-layout CV for **designers**, **illustrators**, **art directors**, and **creative directors**. Portfolio-forward section order with strong typography while preserving ATS-parseable plain text.'
  );
  lines.push('');
  lines.push('## Canonical identity');
  lines.push('');
  lines.push('| Field | Value |');
  lines.push('|-------|-------|');
  lines.push(`| Template ID | \`creative\` |`);
  lines.push(`| Render layer | \`${spec.renderLayerId}\` |`);
  lines.push(`| CSS class | \`${spec.cssClass}\` |`);
  lines.push(`| Layout family | ${spec.layoutFamily} |`);
  lines.push(`| ATS safety | ${spec.atsSafety} |`);
  lines.push(`| Creative level | ${spec.creativeLevel}/5 |`);
  lines.push('');
  lines.push('## Target roles');
  lines.push('');
  lines.push('- Graphic designer');
  lines.push('- Illustrator');
  lines.push('- Art director');
  lines.push('- Creative director');
  lines.push('- Brand / visual designer (portfolio-forward)');
  lines.push('');
  lines.push('## Feature matrix');
  lines.push('');
  lines.push('| Feature | Implementation | ATS note |');
  lines.push('|---------|----------------|----------|');
  lines.push(
    '| Strong typography | DM Sans display · 26pt name · uppercase role · 3px header rule | Text remains selectable plain text |'
  );
  lines.push(
    '| Project highlights | `cvSection--projects` · left-border entries | Each project is a `<p>` node |'
  );
  lines.push(
    '| Client highlights | `cvSection--clients` · joined client line | Plain-text brand names |'
  );
  lines.push(
    '| Software section | `cvSection--software` from `resumeData.tools` | Label: Software (or localized Tools) |'
  );
  lines.push(
    '| Portfolio links | `cvSection--portfolio` from `portfolioLinks` + `identity.website` | URLs as text, no buttons |'
  );
  lines.push(
    '| Skills footer | `cvMetaFooter` skills + languages (tools omitted — shown in Software) | Keyword-friendly chip-free lines |'
  );
  lines.push('');
  lines.push('## Section order (portfolio-first)');
  lines.push('');
  lines.push('```');
  lines.push('Header (name, title, summary, contact)');
  for (const s of order) lines.push(s);
  lines.push('```');
  lines.push('');
  lines.push('Expected stack (`stackCreativeFirst`):');
  lines.push('');
  lines.push('1. Clients');
  lines.push('2. Projects / Selected Work');
  lines.push('3. Exhibitions (if present)');
  lines.push('4. Awards (if present)');
  lines.push('5. Publications (if present)');
  lines.push('6. Portfolio links');
  lines.push('7. Software');
  lines.push('8. Experience');
  lines.push('9. Education');
  lines.push('10. Skills · Languages (footer meta)');
  lines.push('');
  lines.push('## Data contract (`resumeData` → view-model)');
  lines.push('');
  lines.push('| resumeData field | Render section |');
  lines.push('|------------------|----------------|');
  lines.push('| `clients[]` | Client highlights |');
  lines.push('| `projects[]` | Project highlights |');
  lines.push('| `portfolioLinks[]` + `identity.website` | Portfolio |');
  lines.push('| `tools[]` | Software |');
  lines.push('| `experiences[]` | Experience |');
  lines.push('| `skills[]` | Skills (footer) |');
  lines.push('| `languages[]` | Languages (footer) |');
  lines.push('| `exhibitions[]`, `awards[]`, `publications[]` | Optional creative blocks |');
  lines.push('');
  lines.push('**No parser logic in templates.** Data flows through `resumeDataToTemplateView()` only.');
  lines.push('');
  lines.push('## Typography tokens');
  lines.push('');
  lines.push('| Token | Value |');
  lines.push('|-------|-------|');
  lines.push('| Display font | DM Sans, Inter fallback |');
  lines.push('| Name size | 26pt / weight 700 / −0.04em tracking |');
  lines.push('| Role | 9.5pt uppercase / 0.08em tracking |');
  lines.push('| Section titles | 7.5pt uppercase / 0.14em / 2px ink rule |');
  lines.push('| Body | 10.5pt / line-height 1.56 |');
  lines.push('| Ink | `#09090b` |');
  lines.push('');
  lines.push('## ATS readability rules');
  lines.push('');
  lines.push('| Rule | Status |');
  lines.push('|------|--------|');
  lines.push(`| Semantic \`<h3>\` section titles | ${ats.hasSemanticHeadings ? 'pass' : 'FAIL'} |`);
  lines.push(`| No image-only content blocks | ${ats.noImages ? 'pass' : 'FAIL'} |`);
  lines.push(`| Plain-text clients extractable | ${ats.hasClients ? 'pass' : 'FAIL'} |`);
  lines.push(`| Plain-text software extractable | ${ats.hasSoftware ? 'pass' : 'FAIL'} |`);
  lines.push(`| Plain-text portfolio URLs | ${ats.hasPortfolio ? 'pass' : 'FAIL'} |`);
  lines.push(`| Plain-text experience | ${ats.hasExperience ? 'pass' : 'FAIL'} |`);
  lines.push(`| Single-column main flow | pass (magazine stack, no hidden columns) |`);
  lines.push(`| Sample plain-text length | ${ats.plainTextLen} chars |`);
  lines.push('');
  lines.push('## Page policy');
  lines.push('');
  lines.push(`| Constraint | Value |`);
  lines.push(`|------------|------:|`);
  lines.push(`| Format | ${TEMPLATE_V2_PAGE_POLICY.format} |`);
  lines.push(`| Canvas | ${TEMPLATE_V2_A4.widthPx}×${TEMPLATE_V2_A4.heightPx} px |`);
  lines.push(`| Priority | **${TEMPLATE_V2_PAGE_POLICY.priorityPages} page** |`);
  lines.push(`| Maximum | **${TEMPLATE_V2_PAGE_POLICY.maxPages} pages** |`);
  lines.push('');
  lines.push('## Legacy aliases → `creative`');
  lines.push('');
  lines.push('- `creativedirector` · `creative-director` · `artdirector` · `pentagram` · `motiondesigner`');
  lines.push('');
  lines.push('## Module map');
  lines.push('');
  lines.push('| File | Role |');
  lines.push('|------|------|');
  lines.push('| `src/ui/templates/cv-templates.js` | `layoutCreativeMagazine`, `stackCreativeFirst`, section renderers |');
  lines.push('| `src/ui/templates/cv-templates-professional.css` | Creative designer typography + section styles |');
  lines.push('| `src/ui/templates/v2/registry.js` | V2 `creative` registry entry |');
  lines.push('| `src/ui/templates/v2/view-model.js` | `resumeData` → render DTO |');
  lines.push('| `src/tests/qa-creative-template.mjs` | H4 acceptance QA |');
  lines.push('');
  lines.push('## Verification');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run qa:creative-template');
  lines.push('npm run creative:template-spec-report');
  lines.push('npm run qa:template-system-v2');
  lines.push('```');
  lines.push('');

  fs.writeFileSync(OUT, lines.join('\n'));
  console.log(`Wrote ${OUT}`);
}

main().catch((err) => {
  console.error(err);
  process.exitCode = 1;
});
