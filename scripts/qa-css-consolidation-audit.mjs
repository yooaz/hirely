#!/usr/bin/env node
/**
 * CSS consolidation audit — selectors, duplicates, dead/debug/unused.
 * Writes CSS_CONSOLIDATION_PLAN.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');

const DEBUG_PATTERNS = []; // legacy — use isDebugSelector(sel, source)

const BUNDLE_MAP = {
  core: [
    'src/ui/hirely-document.css',
    'src/ui/hirely-progress-nav.css',
    'src/ui/studio/studio-layout.css',
    'src/ui/document-experience-v1.css',
    'src/ui/product/p0-subtraction.css',
    'src/ui/product/ui-scale-fix.css',
    'src/ui/hirely-ui-scale.css',
    'src/ui/product/import-flow-v2.css',
    'src/ui/product/import-analysis-stages.css',
    'src/ui/product/linkedin-import.css',
    'src/ui/product/extraction-recovery.css',
    'src/ui/studio/resume-studio.css',
    'src/ui/studio/resume-blocks.css',
    'src/ui/studio/review-studio-v2.css',
    'src/ui/studio/recruiter-mode.css',
    'src/ui/studio/recruiter-command-center.css',
    'src/ui/studio/template-gallery-position.css',
    'src/ui/editor/resume-editor.css',
    'src/ui/export/a4-viewport.css',
    'src/ui/export/cv-a4-pages.css',
    'inline:index.html',
  ],
  'design-system': [
    'src/ui/design-system-v3.css',
    'src/ui/typography-system.css',
    'src/ui/hirely-premium-polish.css',
    'src/ui/hirely-wow-factor.css',
    'src/ui/pro/pro-cv-features.css',
    'src/ui/pro/photo-system-v2.css',
    'src/ui/product/import-debug-panel.css',
  ],
  templates: [
    'src/ui/templates/cv-design-tokens.css',
    'src/ui/templates/cv-templates-pack.css',
    'src/ui/templates/cv-templates-professional.css',
    'src/ui/templates/cv-templates-h16.css',
    'src/ui/templates/cv-templates-h20.css',
    'src/ui/templates/cv-templates-ats-elite.css',
    'src/ui/templates/cv-templates-ats-executive.css',
    'src/ui/templates/cv-templates-creative-director.css',
    'src/ui/templates/cv-templates-executive-luxury.css',
    'src/ui/templates/cv-templates-swiss-editorial.css',
    'src/ui/templates/cv-templates-visual-timeline.css',
    'src/ui/templates/cv-templates-art-director-portfolio.css',
    'src/ui/templates/premium-template-gallery.css',
    'src/ui/templates/cv-templates-tech-structured.css',
    'src/ui/templates/cv-templates-agency-designer.css',
    'src/ui/templates/cv-templates-editorial-magazine.css',
    'src/ui/templates/cv-templates-startup-builder.css',
    'src/ui/templates/cv-templates-v2-families.css',
    'src/ui/templates/cv-templates-showcase-v8.css',
    'src/ui/templates/cv-templates-v3-families.css',
    'src/ui/templates/cv-template-density.css',
    'src/ui/templates/cv-pdf-export.css',
    'src/ui/export/pdf-export-v2.css',
  ],
};

function walkDir(dir, ext, out = []) {
  if (!fs.existsSync(dir)) return out;
  for (const e of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, e.name);
    if (e.isDirectory() && !e.name.startsWith('.')) walkDir(p, ext, out);
    else if (e.name.endsWith(ext)) out.push(p);
  }
  return out;
}

function extractInlineStyle(html) {
  const m = html.match(/<style>([\s\S]*?)<\/style>/);
  return m ? m[1] : '';
}

function stripComments(css) {
  return css.replace(/\/\*[\s\S]*?\*\//g, '');
}

function extractRules(css, source) {
  const cleaned = stripComments(css);
  const rules = [];
  const re = /([^{}]+)\{([^{}]*)\}/g;
  let match;
  while ((match = re.exec(cleaned)) !== null) {
    const selectorRaw = match[1].trim();
    const body = match[2].trim();
    if (!selectorRaw || selectorRaw.startsWith('@')) continue;
    const selectors = selectorRaw.split(',').map((s) => s.trim()).filter(Boolean);
    for (const sel of selectors) {
      rules.push({ selector: sel, body, source, bytes: sel.length + body.length + 4 });
    }
  }
  return rules;
}

function normalizeSelector(sel) {
  return sel.replace(/\s+/g, ' ').trim();
}

function extractClassIds(selector) {
  const classes = new Set();
  const ids = new Set();
  for (const m of selector.matchAll(/\.([a-zA-Z0-9_-]+)/g)) classes.add(m[1]);
  for (const m of selector.matchAll(/#([a-zA-Z0-9_-]+)/g)) ids.add(m[1]);
  return { classes: [...classes], ids: [...ids] };
}

function collectUsageCorpus() {
  const corpus = new Set();
  const addTokens = (text) => {
    for (const m of text.matchAll(/class(?:Name)?=["'`]([^"'`]+)["'`]/g)) {
      m[1].split(/\s+/).forEach((c) => corpus.add(c));
    }
    for (const m of text.matchAll(/classList\.(add|remove|toggle)\(["'`]([^"'`]+)["'`]/g)) {
      corpus.add(m[2]);
    }
    for (const m of text.matchAll(/classList\.(add|remove|toggle)\(([^)]+)\)/g)) {
      const inner = m[2];
      for (const sm of inner.matchAll(/["'`]([^"'`]+)["'`]/g)) corpus.add(sm[1]);
    }
    for (const m of text.matchAll(/id=["'`]([^"'`]+)["'`]/g)) corpus.add(`#${m[1]}`);
    for (const m of text.matchAll(/getElementById\(["'`]([^"'`]+)["'`]\)/g)) corpus.add(`#${m[1]}`);
    for (const m of text.matchAll(/querySelector(?:All)?\(["'`]([^"'`]+)["'`]\)/g)) {
      const q = m[1];
      for (const cm of q.matchAll(/\.([a-zA-Z0-9_-]+)/g)) corpus.add(cm[1]);
      for (const im of q.matchAll(/#([a-zA-Z0-9_-]+)/g)) corpus.add(`#${im[1]}`);
    }
    for (const m of text.matchAll(/`[^`]*class="([^"]+)"[^`]*`/g)) {
      m[1].split(/\s+/).forEach((c) => corpus.add(c));
    }
    for (const m of text.matchAll(/template-([a-z0-9-]+)/gi)) corpus.add(`template-${m[1]}`);
  };

  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  addTokens(html);
  const jsFiles = [
    ...walkDir(path.join(ROOT, 'src'), '.js'),
    ...walkDir(path.join(ROOT, 'src'), '.mjs'),
    ...walkDir(path.join(ROOT, 'scripts'), '.mjs'),
  ];
  for (const f of jsFiles) {
    try {
      addTokens(fs.readFileSync(f, 'utf8'));
    } catch {
      /* skip */
    }
  }
  return corpus;
}

function isDebugSelector(sel, source) {
  if (/import-debug-panel\.css/.test(source)) return true;
  if (/\.debug-mode(?!\s*\))/.test(sel) && !/:not\(\.debug-mode\)/.test(sel)) return true;
  if (/\[data-debug/.test(sel)) return true;
  if (/\b(debug-panel|debugPanel|import-debug|forensic-panel|engine-health-banner)\b/i.test(sel)) return true;
  if (/\?debug|dev-only/i.test(sel)) return true;
  return false;
}

function selectorLikelyUsed(sel, corpus) {
  const { classes, ids } = extractClassIds(sel);
  if (!classes.length && !ids.length) {
    // element selectors, pseudo, :root vars — assume used
    if (/^(:root|html|body|main|button|input|a|h[1-6]|p|ul|li|section|header|footer|nav|table|tr|td|th|svg|path|@)/.test(sel)) return true;
    if (sel.includes('::') || sel.includes(':hover') || sel.includes(':focus')) return true;
    if (sel.startsWith('@')) return true;
    return null; // unknown
  }
  for (const id of ids) {
    if (corpus.has(`#${id}`) || corpus.has(id)) return true;
  }
  for (const cls of classes) {
    if (corpus.has(cls)) return true;
  }
  return false;
}

function gzipEstimate(bytes) {
  // rough: text CSS gzip ~28-35% of raw
  return Math.round(bytes * 0.32);
}

function main() {
  const html = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  const linked = [...html.matchAll(/href="([^"]+\.css)"/g)].map((m) => m[1]);
  const inlineCss = extractInlineStyle(html);
  const inlineBytes = Buffer.byteLength(inlineCss, 'utf8');

  const fileInventory = [];
  let totalLinkedBytes = 0;
  for (const href of linked) {
    const fp = path.join(ROOT, href);
    const bytes = fs.statSync(fp).size;
    totalLinkedBytes += bytes;
    fileInventory.push({ href, bytes, linked: true });
  }
  fileInventory.sort((a, b) => b.bytes - a.bytes);

  const allUiCss = walkDir(path.join(ROOT, 'src/ui'), '.css');
  const orphans = allUiCss.filter((f) => !linked.some((l) => f.endsWith(l.replace(/^src\//, '')) || l === path.relative(ROOT, f).replace(/\\/g, '/')));

  const sources = {};
  for (const { href } of fileInventory) {
    const fp = path.join(ROOT, href);
    sources[href] = fs.readFileSync(fp, 'utf8');
  }
  sources['inline:index.html'] = inlineCss;

  const allRules = [];
  for (const [src, css] of Object.entries(sources)) {
    allRules.push(...extractRules(css, src));
  }

  const byNormalized = new Map();
  for (const rule of allRules) {
    const key = normalizeSelector(rule.selector);
    if (!byNormalized.has(key)) byNormalized.set(key, []);
    byNormalized.get(key).push(rule);
  }

  const duplicateSelectors = [...byNormalized.entries()]
    .filter(([, rules]) => rules.length > 1)
    .map(([sel, rules]) => ({
      selector: sel,
      count: rules.length,
      sources: [...new Set(rules.map((r) => r.source))],
      duplicateBytes: rules.slice(1).reduce((s, r) => s + r.bytes, 0),
    }))
    .sort((a, b) => b.duplicateBytes - a.duplicateBytes);

  const debugRules = allRules.filter((r) => isDebugSelector(r.selector, r.source));
  const corpus = collectUsageCorpus();

  const unusedCandidates = [];
  const deadCandidates = [];
  for (const rule of allRules) {
    const used = selectorLikelyUsed(rule.selector, corpus);
    if (used === false) {
      const isTemplate = /\.cv|template-|\.hirely-cv/.test(rule.selector);
      if (isTemplate) unusedCandidates.push(rule);
      else deadCandidates.push(rule);
    }
  }

  const duplicateBytesTotal = duplicateSelectors.reduce((s, d) => s + d.duplicateBytes, 0);
  const debugBytes = debugRules.reduce((s, r) => s + r.bytes, 0);
  const deadBytes = deadCandidates.reduce((s, r) => s + r.bytes, 0);
  const templateUnusedBytes = unusedCandidates.reduce((s, r) => s + r.bytes, 0);

  const bundleBytes = { core: 0, 'design-system': 0, templates: 0, unmapped: 0 };
  for (const { href, bytes } of fileInventory) {
    let mapped = false;
    for (const [bundle, files] of Object.entries(BUNDLE_MAP)) {
      if (files.includes(href)) {
        bundleBytes[bundle] += bytes;
        mapped = true;
        break;
      }
    }
    if (!mapped) bundleBytes.unmapped += bytes;
  }
  bundleBytes.core += inlineBytes;

  const consolidatedEstimate = {
    core: Math.round(bundleBytes.core * 0.88),
    designSystem: Math.round(bundleBytes['design-system'] * 0.85),
    templates: Math.round(bundleBytes.templates * 0.72),
  };
  const afterConsolidation =
    consolidatedEstimate.core + consolidatedEstimate.designSystem + consolidatedEstimate.templates;
  const beforeTotal = totalLinkedBytes + inlineBytes;
  const savingsRaw = beforeTotal - afterConsolidation;
  const savingsDupRemoval = Math.round(duplicateBytesTotal * 0.9);
  const savingsDead = Math.round(deadBytes * 0.85);
  const savingsDebug = Math.round(debugBytes * 0.95);
  const savingsOrphans = orphans.reduce((s, f) => s + fs.statSync(f).size, 0);
  const savingsTemplateTrim = Math.round(templateUnusedBytes * 0.6);

  const aggressiveSavings =
    savingsRaw + savingsDupRemoval + savingsDead + savingsDebug + savingsOrphans + savingsTemplateTrim;

  const lines = [];
  lines.push('# CSS Consolidation Plan');
  lines.push('');
  lines.push(`**Generated:** ${new Date().toISOString()}`);
  lines.push('**Scope:** Active `src/ui/**` stylesheets linked from `index.html` + inline `<style>` block');
  lines.push('');
  lines.push('## Executive summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|-------|');
  lines.push(`| Linked CSS files | ${linked.length} |`);
  lines.push(`| Orphan CSS files (not linked) | ${orphans.length} |`);
  lines.push(`| Inline \`<style>\` in index.html | ${(inlineBytes / 1024).toFixed(1)} KB |`);
  lines.push(`| Total raw CSS delivered | **${(beforeTotal / 1024).toFixed(1)} KB** (${beforeTotal.toLocaleString()} bytes) |`);
  lines.push(`| Est. gzip today | ~${(gzipEstimate(beforeTotal) / 1024).toFixed(1)} KB |`);
  lines.push(`| Unique selector rules parsed | ${allRules.length.toLocaleString()} |`);
  lines.push(`| Duplicate selector groups | ${duplicateSelectors.length.toLocaleString()} |`);
  lines.push(`| Debug-tagged rules | ${debugRules.length} |`);
  lines.push(`| Dead selector candidates (app chrome) | ${deadCandidates.length} |`);
  lines.push(`| Unused template selector candidates | ${unusedCandidates.length} |`);
  lines.push('');
  lines.push('### Target bundles');
  lines.push('');
  lines.push('| Bundle | Purpose | Current raw | Post-consolidation est. |');
  lines.push('|--------|---------|-------------|-------------------------|');
  lines.push(`| \`core.css\` | App shell, import, studio layout, editor, export viewport | ${(bundleBytes.core / 1024).toFixed(1)} KB | ${(consolidatedEstimate.core / 1024).toFixed(1)} KB |`);
  lines.push(`| \`design-system.css\` | Tokens, typography, buttons, polish, pro/photo UI | ${(bundleBytes['design-system'] / 1024).toFixed(1)} KB | ${(consolidatedEstimate.designSystem / 1024).toFixed(1)} KB |`);
  lines.push(`| \`templates.css\` | CV template families, density, PDF print rules | ${(bundleBytes.templates / 1024).toFixed(1)} KB | ${(consolidatedEstimate.templates / 1024).toFixed(1)} KB |`);
  if (bundleBytes.unmapped) {
    lines.push(`| *(unmapped — assign during migration)* | — | ${(bundleBytes.unmapped / 1024).toFixed(1)} KB | — |`);
  }
  lines.push('');
  lines.push('### Bundle reduction estimate');
  lines.push('');
  lines.push('| Savings source | Raw bytes | Notes |');
  lines.push('|----------------|-----------|-------|');
  lines.push(`| File merge + dedupe overhead (3 files vs 50 links) | ~${Math.round(beforeTotal * 0.05).toLocaleString()} | HTTP/header elimination; minify pass |`);
  lines.push(`| Duplicate selector merge | ~${savingsDupRemoval.toLocaleString()} | ${duplicateSelectors.length} selector groups repeat across files |`);
  lines.push(`| Dead app selectors removal | ~${savingsDead.toLocaleString()} | Classes/IDs not referenced in HTML/JS corpus |`);
  lines.push(`| Debug-only CSS (dev gate) | ~${savingsDebug.toLocaleString()} | Load \`import-debug-panel.css\` only when \`?debug=1\` |`);
  lines.push(`| Orphan file deletion | ~${savingsOrphans.toLocaleString()} | Not linked from index.html |`);
  lines.push(`| Legacy template CSS trim | ~${savingsTemplateTrim.toLocaleString()} | Per-template files for gallery-unused IDs |`);
  lines.push(`| **Conservative total** | **~${Math.round((beforeTotal - afterConsolidation + savingsDupRemoval + savingsDebug) / 1024)} KB** | **~${(((beforeTotal - afterConsolidation + savingsDupRemoval + savingsDebug) / beforeTotal) * 100).toFixed(0)}% raw reduction** |`);
  lines.push(`| **Aggressive total** | **~${Math.round(aggressiveSavings / 1024)} KB** | **~${((aggressiveSavings / beforeTotal) * 100).toFixed(0)}% raw reduction** |`);
  lines.push(`| Est. gzip after conservative | ~${(gzipEstimate(beforeTotal - (beforeTotal - afterConsolidation + savingsDupRemoval + savingsDebug)) / 1024).toFixed(1)} KB | from ~${(gzipEstimate(beforeTotal) / 1024).toFixed(1)} KB today |`);
  lines.push('');
  lines.push('## Current inventory (linked, by size)');
  lines.push('');
  lines.push('| File | Bytes | Target bundle |');
  lines.push('|------|------:|---------------|');
  for (const { href, bytes } of fileInventory) {
    let bundle = 'unmapped';
    for (const [b, files] of Object.entries(BUNDLE_MAP)) {
      if (files.includes(href)) {
        bundle = b;
        break;
      }
    }
    lines.push(`| \`${href}\` | ${bytes.toLocaleString()} | ${bundle} |`);
  }
  lines.push(`| \`inline:index.html\` | ${inlineBytes.toLocaleString()} | core |`);
  lines.push('');
  lines.push('## Orphan files (delete or archive)');
  lines.push('');
  for (const f of orphans) {
    const rel = path.relative(ROOT, f).replace(/\\/g, '/');
    lines.push(`- \`${rel}\` — ${fs.statSync(f).size.toLocaleString()} bytes (not linked from index.html)`);
  }
  lines.push('');
  lines.push('## Proposed bundle contents');
  lines.push('');
  lines.push('### `core.css`');
  lines.push('App chrome, workspace grid, import pipeline UI, progress nav, studio shell, editor, A4 viewport.');
  lines.push('');
  for (const f of BUNDLE_MAP.core) lines.push(`- \`${f}\``);
  lines.push('');
  lines.push('### `design-system.css`');
  lines.push('Design tokens, typography scale, buttons, cards, modals, pro/photo controls. Debug panel behind dev flag.');
  lines.push('');
  for (const f of BUNDLE_MAP['design-system']) lines.push(`- \`${f}\``);
  lines.push('');
  lines.push('### `templates.css`');
  lines.push('All `.cv` / `template-*` rules, v2/v3 families, density, PDF export. Lazy-load optional for non-style steps.');
  lines.push('');
  for (const f of BUNDLE_MAP.templates) lines.push(`- \`${f}\``);
  lines.push('');
  lines.push('## Duplicate selectors (top 40 by wasted bytes)');
  lines.push('');
  lines.push('| Selector | Occurrences | Sources | Est. duplicate bytes |');
  lines.push('|----------|------------:|---------|---------------------:|');
  for (const d of duplicateSelectors.slice(0, 40)) {
    const srcShort = d.sources.map((s) => s.replace('src/ui/', '')).join(', ');
    lines.push(`| \`${d.selector.slice(0, 80)}${d.selector.length > 80 ? '…' : ''}\` | ${d.count} | ${srcShort} | ${d.duplicateBytes} |`);
  }
  lines.push('');
  lines.push(`*…and ${Math.max(0, duplicateSelectors.length - 40)} more duplicate groups.*`);
  lines.push('');
  lines.push('## Debug selectors (gate behind `?debug=1` or remove)');
  lines.push('');
  if (debugRules.length === 0) {
    lines.push('None matched debug heuristics.');
  } else {
    lines.push('| Selector | Source |');
    lines.push('|----------|--------|');
    const seen = new Set();
    for (const r of debugRules) {
      const key = `${r.source}::${r.selector}`;
      if (seen.has(key)) continue;
      seen.add(key);
      lines.push(`| \`${r.selector.slice(0, 100)}\` | \`${r.source}\` |`);
    }
  }
  lines.push('');
  lines.push('## Dead selector candidates (app chrome — top 50)');
  lines.push('');
  lines.push('Selectors whose class/id tokens were **not** found in `index.html` + `src/**` JS corpus. Manual review required before deletion (dynamic templates may false-negative).');
  lines.push('');
  lines.push('| Selector | Source |');
  lines.push('|----------|--------|');
  const deadUnique = new Map();
  for (const r of deadCandidates) {
    const k = `${r.source}::${r.selector}`;
    if (!deadUnique.has(k)) deadUnique.set(k, r);
  }
  let deadShown = 0;
  for (const r of deadUnique.values()) {
    if (deadShown++ >= 50) break;
    lines.push(`| \`${r.selector.slice(0, 90)}${r.selector.length > 90 ? '…' : ''}\` | \`${r.source}\` |`);
  }
  lines.push('');
  lines.push(`Total dead candidates: **${deadUnique.size}** (~${(deadBytes / 1024).toFixed(1)} KB rule bodies).`);
  lines.push('');
  lines.push('## Unused template selectors');
  lines.push('');
  lines.push(`**${unusedCandidates.length}** rules target \`.cv\` / \`template-*\` classes not present in the usage corpus. Many are valid for gallery templates not exercised in static analysis — trim only after matching against \`production-template-ids.mjs\`.`);
  lines.push('');
  lines.push('### Legacy per-template files (consolidation candidates)');
  lines.push('');
  const legacyTemplateFiles = [
    'cv-templates-h16.css',
    'cv-templates-h20.css',
    'cv-templates-ats-elite.css',
    'cv-templates-ats-executive.css',
    'cv-templates-creative-director.css',
    'cv-templates-executive-luxury.css',
    'cv-templates-swiss-editorial.css',
    'cv-templates-visual-timeline.css',
    'cv-templates-art-director-portfolio.css',
    'cv-templates-tech-structured.css',
    'cv-templates-agency-designer.css',
    'cv-templates-editorial-magazine.css',
    'cv-templates-startup-builder.css',
  ];
  let legacyBytes = 0;
  for (const name of legacyTemplateFiles) {
    const href = `src/ui/templates/${name}`;
    const inv = fileInventory.find((f) => f.href === href);
    if (inv) {
      legacyBytes += inv.bytes;
      lines.push(`- \`${href}\` — ${inv.bytes.toLocaleString()} bytes → merge into \`templates.css\`; drop if template ID retired`);
    }
  }
  lines.push('');
  lines.push(`Legacy per-template subtotal: **${(legacyBytes / 1024).toFixed(1)} KB**. Prefer v2/v3 family files as canonical.`);
  lines.push('');
  lines.push('## Overlap hotspots');
  lines.push('');
  lines.push('| Area | Files | Issue |');
  lines.push('|------|-------|-------|');
  lines.push('| Typography / scale | `typography-system.css`, `hirely-ui-scale.css`, `ui-scale-fix.css`, `design-system-v3.css` | Competing `--font-*` and scale overrides |');
  lines.push('| Document shell | `hirely-document.css`, inline `index.html`, `document-experience-v1.css` | `.workspaceGrid`, step panels defined 2–3× |');
  lines.push('| Template families | `cv-templates-v2-families.css`, `cv-templates-v3-families.css`, `cv-templates-pack.css`, `cv-templates-professional.css` | Duplicate `.cv.template-*` blocks |');
  lines.push('| PDF export | `cv-pdf-export.css`, `pdf-export-v2.css`, `cv-a4-pages.css`, `a4-viewport.css` | Print margin/page rules repeated |');
  lines.push('| Polish passes | `hirely-premium-polish.css`, `hirely-wow-factor.css`, `p0-subtraction.css` | Layered overrides on same selectors |');
  lines.push('');
  lines.push('## Migration plan (phased)');
  lines.push('');
  lines.push('### Phase 0 — Safety');
  lines.push('1. Add `npm run qa:css-consolidation` (this script) to CI as informational.');
  lines.push('2. Screenshot baseline: import, review, style, export at 1280px and 390px.');
  lines.push('3. Do **not** change selectors used by PDF export or template `renderCV()` output.');
  lines.push('');
  lines.push('### Phase 1 — Stop the bleed');
  lines.push('1. Delete or move orphans: `visual-density-pass.css`, unused `cv-templates-premium.css` (only parser-lab/debug).');
  lines.push('2. Gate `import-debug-panel.css` behind `?debug=1` dynamic `<link>`.');
  lines.push('3. Extract inline `index.html` `<style>` (~83 KB) into `src/ui/core-inline-migration.css` → fold into `core.css`.');
  lines.push('');
  lines.push('### Phase 2 — Build bundles');
  lines.push('1. Concatenate per bundle order; run CSSO/cssnano minify.');
  lines.push('2. Merge duplicate selectors (keep last in cascade order).');
  lines.push('3. Replace 50 `<link>` tags with 3 (+ optional debug).');
  lines.push('');
  lines.push('### Phase 3 — Template trim');
  lines.push('1. Cross-reference rules with `listProduction()` / `production-template-ids.mjs`.');
  lines.push('2. Remove CSS for 26 unused legacy template IDs (see `TEMPLATE_ENGINE_REPORT.md`).');
  lines.push('3. Collapse h16/h20/ats-elite per-file CSS into v3 families where redundant.');
  lines.push('');
  lines.push('### Phase 4 — Lazy load');
  lines.push('1. Load `templates.css` only when user enters Style step (or on first `renderCV`).');
  lines.push(`2. Keeps import/review path ~${Math.round(bundleBytes.templates / 1024)} KB lighter on cold start.`);
  lines.push('');
  lines.push('## Risks');
  lines.push('');
  lines.push('- **Cascade order**: 50 files impose order; bundling must preserve final specificity order.');
  lines.push('- **Template false negatives**: Static corpus misses dynamically rendered CV classes.');
  lines.push('- **PDF parity**: Print rules must stay byte-identical until `npm run qa:pdf-export` passes.');
  lines.push('- **Import gate**: Consolidation is infrastructure; avoid visual polish churn until import gates PASS.');
  lines.push('');
  lines.push('## Verification');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run qa:css-consolidation   # regenerate this report');
  lines.push('npm run qa:dom-contract');
  lines.push('npm run qa:template-engine');
  lines.push('# After bundle swap:');
  lines.push('npm run qa:boot');
  lines.push('```');
  lines.push('');

  const outPath = path.join(ROOT, 'CSS_CONSOLIDATION_PLAN.md');
  fs.writeFileSync(outPath, lines.join('\n'));
  console.log(`Wrote ${outPath}`);
  console.log(`Files: ${linked.length} linked, ${orphans.length} orphans`);
  console.log(`Raw CSS: ${(beforeTotal / 1024).toFixed(1)} KB`);
  console.log(`Duplicates: ${duplicateSelectors.length} groups, ~${duplicateBytesTotal} duplicate bytes`);
  console.log(`Dead: ${deadUnique.size}, Debug: ${debugRules.length}`);
}

main();
