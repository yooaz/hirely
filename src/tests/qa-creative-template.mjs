#!/usr/bin/env node
/**
 * HIRELY H4 — Creative Designer template QA.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { resumeDataToTemplateView } from '../ui/templates/v2/view-model.js';
import { resolveTemplateV2 } from '../ui/templates/v2/registry.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
const TEMPLATES_PATH = path.join(ROOT, 'src/ui/templates/cv-templates.js');

let failed = 0;
function ok(cond, msg) {
  if (!cond) {
    console.error('FAIL', msg);
    failed++;
  } else {
    console.log('OK', msg);
  }
}

const CREATIVE_RD = {
  identity: {
    name: 'Yohann Azancot',
    title: 'Graphic Designer & Illustrator',
    email: 'yoaz@hotmail.fr',
    website: 'https://yoaz.studio',
  },
  summary: 'Creative professional specializing in illustration and brand design.',
  experiences: [
    {
      role: 'Freelance Illustrator',
      company: 'Independent',
      dates: '2011–2022',
      bullets: ['Posters, packaging, logos.'],
    },
  ],
  education: ['Créapole — Visual Communication'],
  skills: ['Illustration', 'Brand Identity'],
  tools: ['Photoshop', 'Illustrator', 'InDesign'],
  languages: ['French — native', 'English — fluent'],
  clients: ['Nike', 'Louis Vuitton', 'Adobe'],
  projects: ['Brand campaign — Global sportswear client · 2023'],
  portfolioLinks: ['Behance — yoaz.studio'],
  unsorted: [],
  meta: {},
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

const HT = bootTemplates();
const view = enrichViewForRender(resumeDataToTemplateView(CREATIVE_RD, { skipFinalGate: true }), CREATIVE_RD);
const spec = resolveTemplateV2('creative');

ok(spec.bestFor.includes('illustrators'), 'registry targets illustrators');
ok(spec.sections.includes('software'), 'registry lists software section');
ok(spec.sections.includes('portfolioLinks'), 'registry lists portfolio links');

const html = HT.render(view, 'creative');
ok(html && html.length > 200, 'creative template renders');
ok(/cvSection--clients/.test(html), 'client highlights section');
ok(/cvSection--projects/.test(html), 'project highlights section');
ok(/cvSection--software/.test(html), 'software section');
ok(/cvSection--portfolio/.test(html), 'portfolio links section');
ok(/Photoshop/.test(html), 'software tools in output');
ok(/yoaz\.studio/.test(html), 'portfolio URL in output');
ok(!/<img[^>]+src=/i.test(html), 'no image-only blocks (ATS)');
ok(/<h3[^>]*>/.test(html), 'semantic section headings (ATS)');

const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
ok(plain.includes('Nike'), 'clients plain text');
ok(plain.includes('Illustrator'), 'software plain text');
ok(plain.includes('Freelance'), 'experience plain text');

if (failed) {
  process.exitCode = 1;
  console.error(`\n${failed} check(s) failed`);
} else {
  console.log('\nqa-creative-template: PASS');
}
