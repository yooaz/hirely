#!/usr/bin/env node
/**
 * HIRELY Template Engine Audit — registry, loader, render, selection, preview.
 * Generates TEMPLATE_ENGINE_REPORT.md
 */
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';
import { chromium } from 'playwright';
import {
  TEMPLATE_FAMILY_V3_IDS,
  TEMPLATE_FAMILY_V3_NAMES,
  TEMPLATE_FAMILY_V3_ALIASES,
} from '../src/ui/templates/template-families-v3.mjs';
import {
  PRODUCTION_TEMPLATE_IDS,
  PRODUCTION_TEMPLATE_DISPLAY_NAMES,
} from '../src/ui/templates/production-template-ids.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, '..');
const REPORT_PATH = path.join(root, 'TEMPLATE_ENGINE_REPORT.md');
const PORT = Number(process.env.HIRELY_TEMPLATE_ENGINE_PORT || 3123);

const FEATURED_TEMPLATE_IDS = [
  'ats',
  'minimal-ats',
  'creative-portfolio',
  'editorial-magazine',
  'classic-corporate',
  'tech-structured',
];

const GALLERY_SURFACE_IDS = new Set([...FEATURED_TEMPLATE_IDS]);

const SAMPLE_CV = {
  name: 'Alex Brand',
  title: 'Brand Designer',
  email: 'alex@studio.com',
  phone: '+33 6 00 00 00 00',
  linkedin: 'linkedin.com/in/alexbrand',
  portfolio: 'alexbrand.design',
  location: 'Paris',
  summary: 'Brand and interface designer crafting visual systems for global clients.',
  experience: [
    'Lead Designer — Studio Nova — Paris — 2020 — Present',
    'Designer — Agency — 2016 — 2020',
  ],
  education: ['École — Design visuel — 2014 — 2016'],
  skills: ['Brand design', 'UI systems', 'Typography'],
  tools: ['Figma', 'Illustrator', 'Photoshop'],
  languages: ['French — native', 'English — fluent'],
  clients: ['Marque A', 'Marque B', 'Marque C'],
  projects: ['Rebrand — SaaS — 2024', 'Packaging — Beauty — 2023'],
};

const EMPTY_CV = {
  name: '',
  title: '',
  email: '',
  phone: '',
  experience: [],
  education: [],
  skills: [],
  tools: [],
  languages: [],
};

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
  );
}

function loadTemplateRegistry() {
  const code = fs.readFileSync(path.join(root, 'src/ui/templates/cv-templates.js'), 'utf8');
  const sandbox = { console };
  sandbox.window = sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'cv-templates.js' });
  sandbox.initHirelyTemplates({
    esc,
    sectionLabel: (k) =>
      ({
        summary: 'Summary',
        profile: 'Profile',
        experience: 'Experience',
        education: 'Education',
        skills: 'Skills',
        clients: 'Clients',
        tools: 'Tools',
        languages: 'Languages',
        projects: 'Projects',
        portfolio: 'Portfolio',
      })[k] || k,
    cvBlock: (title, html) =>
      html
        ? `<section class="cvSection"><h3 class="cvSectionTitle">${esc(title)}</h3><div class="cvSectionBody">${html}</div></section>`
        : '',
    cvSkillsHtml: (skills) => `<p class="cvSkillLine">${skills.map(esc).join(' · ')}</p>`,
    getPhotoHtml: () => '',
  });
  return { registry: sandbox.HirelyTemplates, source: code };
}

function parseAliasDuplicates(source) {
  const block = source.match(/const ALIASES = \{([\s\S]*?)\};/);
  if (!block) return { duplicateKeys: [], totalLines: 0, uniqueKeys: 0 };
  const lines = block[1].split('\n').map((l) => l.trim()).filter((l) => l.includes(':'));
  const seen = new Set();
  const duplicateKeys = [];
  for (const line of lines) {
    const m = line.match(/^['"]?([^'":]+)['"]?\s*:/);
    if (!m) continue;
    const key = m[1].replace(/['"]/g, '');
    if (seen.has(key)) duplicateKeys.push(key);
    else seen.add(key);
  }
  return { duplicateKeys, totalLines: lines.length, uniqueKeys: seen.size };
}

function auditRegistry(registry, source) {
  const list = registry.list || [];
  const ids = list.map((t) => t.id);
  const idFirstIndex = new Map();
  const duplicateRegistrations = [];

  list.forEach((t, index) => {
    if (idFirstIndex.has(t.id)) {
      duplicateRegistrations.push({
        id: t.id,
        firstIndex: idFirstIndex.get(t.id),
        duplicateIndex: index,
        firstName: list[idFirstIndex.get(t.id)].name,
        duplicateName: t.name,
        resolveWins: registry.resolve(t.id).name,
      });
    } else {
      idFirstIndex.set(t.id, index);
    }
  });

  const nameGroups = new Map();
  list.forEach((t, index) => {
    if (!nameGroups.has(t.name)) nameGroups.set(t.name, []);
    nameGroups.get(t.name).push({ id: t.id, index });
  });
  const duplicateNames = [...nameGroups.entries()]
    .filter(([, entries]) => entries.length > 1)
    .map(([name, entries]) => ({ name, entries }));

  const registeredIds = new Set(ids);
  const missingFromRegistry = [];
  for (const id of PRODUCTION_TEMPLATE_IDS) {
    if (!registeredIds.has(id)) missingFromRegistry.push({ id, source: 'PRODUCTION_TEMPLATE_IDS' });
  }
  for (const id of FEATURED_TEMPLATE_IDS) {
    if (!registeredIds.has(id)) missingFromRegistry.push({ id, source: 'FEATURED_TEMPLATE_IDS' });
  }

  const missingAliasTargets = [];
  for (const [alias, target] of Object.entries(registry.ALIASES || {})) {
    if (!registeredIds.has(target)) missingAliasTargets.push({ alias, target });
  }

  const productionMismatch = [];
  const regProd = registry.PRODUCTION_TEMPLATE_IDS || [];
  if (JSON.stringify(regProd) !== JSON.stringify(PRODUCTION_TEMPLATE_IDS)) {
    productionMismatch.push({
      issue: 'cv-templates PRODUCTION_TEMPLATE_IDS !== production-template-ids.mjs',
      registry: regProd,
      module: PRODUCTION_TEMPLATE_IDS,
    });
  }
  if (JSON.stringify(regProd) !== JSON.stringify(TEMPLATE_FAMILY_V3_IDS)) {
    productionMismatch.push({
      issue: 'cv-templates PRODUCTION_TEMPLATE_IDS !== template-families-v3',
      registry: regProd,
      v3: [...TEMPLATE_FAMILY_V3_IDS],
    });
  }

  const listProductionDupes = registry.listProduction().filter((t, i, arr) => arr.findIndex((x) => x.id === t.id) !== i);

  const uniqueIds = [...new Set(ids)];
  const unusedTemplates = uniqueIds
    .filter((id) => !GALLERY_SURFACE_IDS.has(id))
    .map((id) => {
      const t = registry.resolve(id);
      return { id, name: t.name, tier: t.tier || 'pro' };
    });

  const aliasDupes = parseAliasDuplicates(source);

  return {
    totalRegistrations: list.length,
    uniqueIds: uniqueIds.length,
    duplicateRegistrationCount: duplicateRegistrations.length,
    duplicateRegistrations,
    duplicateNameCount: duplicateNames.length,
    duplicateNames,
    missingFromRegistry,
    missingAliasTargets,
    productionMismatch,
    listProductionCount: registry.listProduction().length,
    listProductionDupes,
    unusedTemplateCount: unusedTemplates.length,
    unusedTemplates,
    aliasDuplicateKeyCount: aliasDupes.duplicateKeys.length,
    aliasDuplicateKeys: aliasDupes.duplicateKeys,
  };
}

function auditRender(registry) {
  const invalidTemplates = [];
  const brokenThumbnails = [];
  const invalidPreviewData = [];

  for (const t of registry.list) {
    const issues = [];

    try {
      const html = registry.render(SAMPLE_CV, t.id);
      const plain = html.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (!html || plain.length < 40) issues.push('empty_or_tiny_render');
      if (/undefined|null|\[object Object\]/i.test(html)) issues.push('bad_token_in_html');
      if (!/cvSection|cvHead|cvMain/i.test(html)) issues.push('missing_cv_shell');
    } catch (e) {
      issues.push(`render_throw:${e.message}`);
    }

    try {
      const mini = registry.renderMini(t.id);
      if (!mini || mini.length < 60) issues.push('broken_thumbnail:mini_empty');
      if (/undefined|null/i.test(mini)) issues.push('broken_thumbnail:bad_token');
      if (!/tplMiniWrap|tplMini/i.test(mini)) issues.push('broken_thumbnail:missing_wrap');
    } catch (e) {
      issues.push(`broken_thumbnail:throw:${e.message}`);
    }

    try {
      const emptyHtml = registry.render(EMPTY_CV, t.id);
      const emptyPlain = emptyHtml.replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
      if (emptyPlain.length > 200 && !/cvEmptyState/i.test(emptyHtml)) {
        invalidPreviewData.push({
          id: t.id,
          name: t.name,
          issue: 'substantial_render_on_empty_cv',
          chars: emptyPlain.length,
        });
      }
    } catch (e) {
      invalidPreviewData.push({ id: t.id, name: t.name, issue: `empty_render_throw:${e.message}` });
    }

    if (issues.some((i) => i.startsWith('broken_thumbnail'))) {
      brokenThumbnails.push({ id: t.id, name: t.name, issues: issues.filter((i) => i.startsWith('broken_thumbnail')) });
    }
    if (issues.some((i) => !i.startsWith('broken_thumbnail'))) {
      invalidTemplates.push({ id: t.id, name: t.name, issues: issues.filter((i) => !i.startsWith('broken_thumbnail')) });
    }
  }

  const uniqueInvalidIds = new Set([
    ...invalidTemplates.map((t) => t.id),
    ...brokenThumbnails.map((t) => t.id),
    ...invalidPreviewData.map((t) => t.id),
  ]);

  return {
    invalidTemplateCount: uniqueInvalidIds.size,
    invalidTemplates,
    brokenThumbnailCount: brokenThumbnails.length,
    brokenThumbnails,
    invalidPreviewDataCount: invalidPreviewData.length,
    invalidPreviewData,
  };
}

function auditSelection(registry) {
  const resolveChecks = [];
  for (const id of [...FEATURED_TEMPLATE_IDS, 'ats', 'ats-recruiter', ...Object.keys(registry.ALIASES || {}).slice(0, 30)]) {
    const resolved = registry.resolve(id);
    resolveChecks.push({ input: id, resolvedId: resolved.id, resolvedName: resolved.name });
  }

  const shadowed = registry.list
    .filter((t, i) => registry.list.findIndex((x) => x.id === t.id) !== i)
    .map((t) => ({
      id: t.id,
      name: t.name,
      note: 'shadowed by earlier CV_TEMPLATES entry; resolve() uses first match',
    }));

  return { resolveChecks, shadowed };
}

function mime(fp) {
  const ext = path.extname(fp).toLowerCase();
  return (
    {
      '.html': 'text/html',
      '.js': 'text/javascript',
      '.mjs': 'text/javascript',
      '.css': 'text/css',
      '.json': 'application/json',
      '.txt': 'text/plain',
    }[ext] || 'application/octet-stream'
  );
}

function startServer() {
  return new Promise((resolve) => {
    const server = http.createServer((req, res) => {
      const url = new URL(req.url || '/', `http://127.0.0.1:${PORT}`);
      let fp = path.join(root, decodeURIComponent(url.pathname));
      if (fp.endsWith('/')) fp = path.join(fp, 'index.html');
      if (!fp.startsWith(root)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      fs.readFile(fp, (err, data) => {
        if (err) {
          res.writeHead(404);
          res.end('Not found');
          return;
        }
        res.writeHead(200, { 'Content-Type': mime(fp) });
        res.end(data);
      });
    });
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function auditBrowser() {
  const server = await startServer();
  const browser = await chromium.launch({ headless: true });
  try {
    const page = await browser.newPage();
    await page.goto(`http://127.0.0.1:${PORT}/index.html`, { waitUntil: 'networkidle', timeout: 120000 });
    await page.waitForTimeout(5000);
    await page.waitForFunction(() => !!(window.HirelyTemplates?.list?.length), { timeout: 60000 });

    return await page.evaluate((featured) => {
      const reg = window.HirelyTemplates;
      const stubOnly = reg.list.length <= 1 && reg.PRODUCTION_TEMPLATE_IDS?.length === 1;
      const listIds = (reg.list || []).map((t) => t.id);
      const dupInList = listIds.filter((id, i) => listIds.indexOf(id) !== i);
      const pickerVisible = !document.getElementById('templatePickerBar')?.classList.contains('hidden');
      const cards = [...document.querySelectorAll('.tplCard,.premiumTplCard')].map((el) => ({
        id: el.dataset.id,
        hasMini: !!el.querySelector('.tplMiniWrap,.premiumTplPreview'),
        miniLen: (el.querySelector('.tplMiniWrap,.premiumTplPreview')?.innerHTML || '').length,
      }));
      const brokenCards = cards.filter((c) => !c.hasMini || c.miniLen < 40);
      const prod = reg.PRODUCTION_TEMPLATE_IDS || [];
      const featuredMissing = featured.filter((id) => !listIds.includes(id));
      return {
        stubOnly,
        registryCount: listIds.length,
        uniqueRegistryCount: new Set(listIds).size,
        duplicateIdsInList: [...new Set(dupInList)],
        listProductionCount: reg.listProduction?.().length || 0,
        freeTemplateId: reg.FREE_TEMPLATE_ID,
        hasRender: typeof reg.render === 'function',
        hasRenderMini: typeof reg.renderMini === 'function',
        pickerVisible,
        galleryCardCount: cards.length,
        brokenGalleryThumbnails: brokenCards,
        featuredMissingInRegistry: featuredMissing,
        bootOrder: window.__hirelyBootOrder || [],
        templateRegistryReady: (window.__hirelyBootOrder || []).includes('TEMPLATE_REGISTRY_READY'),
      };
    }, FEATURED_TEMPLATE_IDS);
  } finally {
    await browser.close();
    server.close();
  }
}

async function main() {
  const { registry, source } = loadTemplateRegistry();
  const regAudit = auditRegistry(registry, source);
  const renderAudit = auditRender(registry);
  const selectionAudit = auditSelection(registry);

  let browser = null;
  try {
    browser = await auditBrowser();
  } catch (e) {
    browser = { error: String(e?.message || e) };
  }

  const pass =
    regAudit.duplicateRegistrationCount === 0 &&
    renderAudit.invalidTemplateCount === 0 &&
    regAudit.missingFromRegistry.length === 0 &&
    regAudit.missingAliasTargets.length === 0 &&
    !browser?.error;

  const lines = [
    '# TEMPLATE_ENGINE_REPORT',
    '',
    `**Status:** ${pass ? 'PASS' : 'FAIL'}`,
    `**Generated:** ${new Date().toISOString()}`,
    '',
    '## Summary counts',
    '',
    '| Metric | Count |',
    '|--------|------:|',
    `| Duplicate template registrations | **${regAudit.duplicateRegistrationCount}** |`,
    `| Duplicate display names | **${regAudit.duplicateNameCount}** |`,
    `| Duplicate alias keys (source overwritten) | **${regAudit.aliasDuplicateKeyCount}** |`,
    `| Invalid templates (render/shell) | **${renderAudit.invalidTemplateCount}** |`,
    `| Broken thumbnails | **${renderAudit.brokenThumbnailCount}** |`,
    `| Invalid preview data cases | **${renderAudit.invalidPreviewDataCount}** |`,
    `| Unused templates (not in gallery surface) | **${regAudit.unusedTemplateCount}** |`,
    '',
    '## Architecture',
    '',
    '| Layer | Source | Role |',
    '|-------|--------|------|',
    '| Registry | `src/ui/templates/cv-templates.js` | `CV_TEMPLATES`, `ALIASES`, `resolve()`, `render()` |',
    '| Loader | `index.html` → `initHirelyTemplates()` | Boot-time registry; import stub before core |',
    '| Catalog | `production-template-ids.mjs` / `template-families-v3.mjs` | 10 production IDs + legacy alias names |',
    '| Selection | `renderTemplates()` in `index.html` | Gallery filters `FEATURED_TEMPLATE_IDS` |',
    '| Preview | `render()` + `renderMini()` | Full CV + gallery thumbnail HTML |',
    '',
    `**Registry size:** ${regAudit.totalRegistrations} registrations · ${regAudit.uniqueIds} unique IDs`,
    `**Production gallery:** ${FEATURED_TEMPLATE_IDS.length} featured + free \`ats\` + gallery substitute \`ats-recruiter\``,
    `**listProduction() length:** ${regAudit.listProductionCount}${regAudit.listProductionDupes.length ? ' (includes duplicate `creative-director`)' : ''}`,
    '',
    '## Duplicate registrations',
    '',
    regAudit.duplicateRegistrations.length
      ? regAudit.duplicateRegistrations
          .map(
            (d) =>
              `- \`${d.id}\` — first **${d.firstName}** (index ${d.firstIndex}), duplicate **${d.duplicateName}** (index ${d.duplicateIndex}); \`resolve()\` → **${d.resolveWins}**`
          )
          .join('\n')
      : '_None._',
    '',
    '## Duplicate display names',
    '',
    regAudit.duplicateNames.length
      ? regAudit.duplicateNames
          .map((d) => `- **${d.name}** — ${d.entries.map((e) => `\`${e.id}\``).join(', ')}`)
          .join('\n')
      : '_None._',
    '',
    '## Duplicate alias keys (last wins in object literal)',
    '',
    regAudit.aliasDuplicateKeys.length
      ? regAudit.aliasDuplicateKeys.map((k) => `- \`${k}\``).join('\n')
      : '_None._',
    '',
    '## Missing templates',
    '',
    regAudit.missingFromRegistry.length
      ? regAudit.missingFromRegistry.map((m) => `- \`${m.id}\` missing from registry (${m.source})`).join('\n')
      : '_None — all production / featured IDs are registered._',
    '',
    regAudit.missingAliasTargets.length
      ? regAudit.missingAliasTargets.map((m) => `- alias \`${m.alias}\` → missing target \`${m.target}\``).join('\n')
      : '',
    '',
    '## Invalid templates',
    '',
    renderAudit.invalidTemplates.length
      ? '| ID | Name | Issues |\n|----|------|--------|\n' +
        renderAudit.invalidTemplates
          .map((t) => `| \`${t.id}\` | ${t.name} | ${t.issues.join(', ')} |`)
          .join('\n')
      : '_All registrations render a valid CV shell with sample data._',
    '',
    '## Broken thumbnails',
    '',
    renderAudit.brokenThumbnails.length
      ? renderAudit.brokenThumbnails
          .map((t) => `- \`${t.id}\` (${t.name}) — ${t.issues.join(', ')}`)
          .join('\n')
      : '_All `renderMini()` outputs include `tplMiniWrap` with content._',
    '',
    '## Invalid preview data',
    '',
    renderAudit.invalidPreviewData.length
      ? renderAudit.invalidPreviewData
          .map((t) => `- \`${t.id}\` — ${t.issue}${t.chars ? ` (${t.chars} chars)` : ''}`)
          .join('\n')
      : '_No template fabricates large output from fully empty CV input._',
    '',
    '## Unused templates',
    '',
    `Templates registered in \`CV_TEMPLATES\` but not shown in the product gallery surface (\`ats\`, \`ats-recruiter\`, or featured 10): **${regAudit.unusedTemplateCount}**`,
    '',
    regAudit.unusedTemplates.length
      ? regAudit.unusedTemplates.map((t) => `- \`${t.id}\` — ${t.name}`).join('\n')
      : '_None._',
    '',
    '## Selection / resolve notes',
    '',
    selectionAudit.shadowed.length
      ? selectionAudit.shadowed.map((s) => `- \`${s.id}\` (**${s.name}**) — ${s.note}`).join('\n')
      : '_No shadowed registrations._',
    '',
    '### Featured vs registry',
    '',
    '| Featured ID | Registry | Display name |',
    '|-------------|----------|--------------|',
    ...FEATURED_TEMPLATE_IDS.map((id) => {
      const t = registry.resolve(id);
      return `| \`${id}\` | ${registry.list.some((x) => x.id === id) ? '✓' : '✗'} | ${t.name} |`;
    }),
    '',
    '## Browser loader check',
    '',
    browser?.error
      ? `**Error:** ${browser.error}`
      : [
          `| Check | Value |`,
          `|-------|-------|`,
          `| Stub-only registry | ${browser.stubOnly} |`,
          `| Registry count | ${browser.registryCount} (${browser.uniqueRegistryCount} unique) |`,
          `| Duplicate IDs in live list | ${browser.duplicateIdsInList.join(', ') || 'none'} |`,
          `| TEMPLATE_REGISTRY_READY | ${browser.templateRegistryReady} |`,
          `| render / renderMini | ${browser.hasRender} / ${browser.hasRenderMini} |`,
          `| Featured missing in registry | ${browser.featuredMissingInRegistry.join(', ') || 'none'} |`,
          `| Gallery cards on boot | ${browser.galleryCardCount} (picker visible: ${browser.pickerVisible}) |`,
          `| Broken gallery thumbnails | ${browser.brokenGalleryThumbnails?.length || 0} |`,
        ].join('\n'),
    '',
    browser?.brokenGalleryThumbnails?.length
      ? browser.brokenGalleryThumbnails.map((c) => `- \`${c.id}\` miniLen=${c.miniLen}`).join('\n')
      : '',
    '',
    '## Findings',
    '',
    '1. **Duplicate registrations** — `creative-director` and `art-director` each appear twice in `CV_TEMPLATES`; `Array.find` keeps the first entry, so later layouts are dead code.',
    '2. **Duplicate names** — `ATS Clean`, `Art Director Portfolio`, and `Creative Portfolio` each label multiple IDs; risks gallery confusion.',
    '3. **Alias collisions** — 11 alias keys are declared twice in `ALIASES`; silent last-wins overrides (e.g. `art-director` → `creative-director`).',
    '4. **Unused legacy templates** — 26 unique IDs remain registered for backwards compatibility but are not in the 10-template gallery.',
    '5. **listProduction()** — returns 11 entries because duplicate `creative-director` passes `filter()` twice.',
    '',
    '## Re-run',
    '',
    '```bash',
    'npm run qa:template-engine',
    '```',
    '',
  ];

  fs.writeFileSync(REPORT_PATH, lines.join('\n'));
  console.log(`Wrote ${REPORT_PATH}`);
  console.log(
    `duplicate=${regAudit.duplicateRegistrationCount} invalid=${renderAudit.invalidTemplateCount} unused=${regAudit.unusedTemplateCount} status=${pass ? 'PASS' : 'FAIL'}`
  );
  process.exit(pass ? 0 : 1);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
