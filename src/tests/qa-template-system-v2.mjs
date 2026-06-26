#!/usr/bin/env node
/**
 * Template System H3 — registry, view-model, page policy.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import {
  TEMPLATE_V2_IDS,
  TEMPLATE_V2_REGISTRY,
  TEMPLATE_V2_RULES,
  TEMPLATE_V2_PAGE_POLICY,
  resolveTemplateV2,
  resolveTemplateV2RenderLayer,
  resumeDataToTemplateView,
  assertTemplateViewContract,
  evaluateTemplatePagePolicy,
  templateV2ShellClasses,
} from '../ui/templates/v2/index.js';
import {
  PRODUCTION_TEMPLATE_IDS,
  TEMPLATE_SYSTEM_VERSION,
} from '../ui/templates/production-template-ids.mjs';

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

ok(TEMPLATE_SYSTEM_VERSION === 'ux-p3', 'production-template-ids declares ux-p3');
ok(PRODUCTION_TEMPLATE_IDS.length === 5, 'five production templates');
ok(
  PRODUCTION_TEMPLATE_IDS.every((id) => TEMPLATE_V2_IDS.includes(id)),
  'production ids match H3 registry'
);

for (const id of TEMPLATE_V2_IDS) {
  const t = TEMPLATE_V2_REGISTRY[id];
  ok(!!t, `registry entry ${id}`);
  ok(t.pagePolicy.maxPages === 2, `${id} max 2 pages`);
  ok(t.pagePolicy.priorityPages === 1, `${id} 1-page priority`);
  ok(t.pagePolicy.a4Safe && t.pagePolicy.pdfSafe, `${id} A4 + PDF safe`);
}

ok(resolveTemplateV2('pentagram').id === 'creative', 'alias pentagram → creative');
ok(resolveTemplateV2('swiss').id === 'editorial', 'alias swiss → editorial');
ok(resolveTemplateV2('sidebar').id === 'modern-two-column', 'alias sidebar → modern-two-column');
ok(resolveTemplateV2('agencyportfolio').id === 'creative', 'alias agencyportfolio → creative');
ok(resolveTemplateV2('executive').id === 'executive-minimal', 'alias executive → executive-minimal');

const sampleRd = {
  identity: { name: 'Alex Martin', title: 'Designer', email: 'a@test.com' },
  experiences: [{ role: 'Designer', company: 'Studio', dates: '2020–2024', bullets: ['Led projects.'] }],
  education: ['MA Design — School'],
  skills: ['Branding'],
  tools: ['Figma'],
  languages: ['English'],
  clients: [],
  projects: [],
  unsorted: [],
  meta: {},
};

const view = resumeDataToTemplateView(sampleRd, { skipFinalGate: true });
const contract = assertTemplateViewContract(view);
ok(contract.ok, 'template view has no forbidden parser fields');
ok(view._templateMeta.parserInvoked === false, 'parser not invoked in view-model');
ok(view.experience?.length >= 1 || view.name, 'view-model maps experience/name');

const pageOk = evaluateTemplatePagePolicy({ pageCount: 1, widthPx: 794, overflowPx: 0 });
ok(pageOk.ok && pageOk.onePagePriority, 'one-page policy passes');
const pageBad = evaluateTemplatePagePolicy({ pageCount: 3, widthPx: 794 });
ok(!pageBad.withinMax, 'three pages exceeds max');

const shell = templateV2ShellClasses('ats', { spacing: 'compact' });
ok(shell.includes('template-ats') && shell.includes('cv-page'), 'shell classes for export');

function loadHirelyTemplates() {
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
    sectionLabel: (k) => k,
    cvBlock: (t, b) => (b ? `<section>${esc(t)}${b}</section>` : ''),
    cvSkillsHtml: (skills) => `<p>${(skills || []).map(esc).join(' · ')}</p>`,
    getPhotoHtml: () => '',
  });
  return sandbox.HirelyTemplates;
}

const HT = loadHirelyTemplates();
ok(!!HT, 'cv-templates boot');

for (const id of TEMPLATE_V2_IDS) {
  const layer = resolveTemplateV2RenderLayer(id);
  const resolved = HT.resolve(layer);
  ok(!!resolved?.render, `render layer ${layer} for ${id}`);
  const html = HT.render(view, id);
  ok(html && html.length > 80, `${id} renders HTML`);
  ok(!TEMPLATE_V2_RULES.noRawTextInTemplates || !/rawText|ocrText/i.test(html), `${id} HTML has no raw OCR`);
}

if (failed) {
  process.exitCode = 1;
  console.error(`\n${failed} check(s) failed`);
} else {
  console.log('\nqa-template-system-v2: all passed');
}
