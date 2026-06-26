#!/usr/bin/env node
/**
 * index.html decomposition audit — HTML regions, JS modules, line budget for <1500 target.
 * Writes COMPONENT_SPLIT_PLAN.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const INDEX = path.join(ROOT, 'index.html');

const COMPONENTS = {
  Header: { start: 1017, end: 1021, root: 'header.top', docSteps: ['*'] },
  Landing: { start: 1022, end: 1049, root: 'section#hero', docSteps: ['import'] },
  ImportStep: {
    start: 1083,
    end: 1154,
    root: 'aside#wsImport',
    docSteps: ['import'],
    also: ['1054-1082 ProgressNav (shared shell)'],
  },
  ReviewStep: {
    ranges: [
      [1156, 1161, 'header#resumeStudioHead'],
      [1308, 1380, 'reviewStudioCenter + reviewStudioAnalysis'],
      [1383, 1421, 'aside#wsInsights (review mode)'],
      [1423, 1461, 'aside#studioRail'],
    ],
    root: 'docStep-edit | docStep-verify',
    docSteps: ['edit', 'verify'],
  },
  StyleStep: {
    ranges: [
      [1162, 1166, 'header#styleStepHead'],
      [1176, 1183, '#extractionQualityStep'],
      [1185, 1198, '#templatePickerBar'],
      [1222, 1262, '#proCvLayoutTools + photoEditorDialog'],
    ],
    root: 'docStep-style',
    docSteps: ['style'],
  },
  ExportStep: {
    ranges: [
      [1167, 1173, 'header#exportStepHead'],
      [1263, 1269, '#a4ZoomBar'],
      [1510, 1521, '#cvExportBar'],
    ],
    root: 'docStep-export',
    docSteps: ['export'],
  },
  SharedStudio: {
    start: 1174,
    end: 1307,
    root: '#studioPreview / #cvStage',
    docSteps: ['edit', 'style', 'export'],
    note: 'CV preview shell shared across Review, Style, Export',
  },
  Footer: {
    ranges: [
      [1464, 1522, 'footer.docFooter'],
      [1525, 1526, '#pricing + .footer tag'],
    ],
    root: 'footer.docFooter, #pricing, .footer',
    docSteps: ['*'],
  },
};

const JS_MODULE_MAP = [
  {
    file: 'src/ui/shell/app-header.js',
    component: 'Header',
    patterns: ['heroUpload', 'uiLang', 'navCv', 'applyI18n', 'pricingImport'],
    estLines: 120,
  },
  {
    file: 'src/ui/shell/landing.js',
    component: 'Landing',
    patterns: ['heroTemplates', 'heroUploadBtn', 'heroTitle', 'scrollToWorkspace'],
    estLines: 80,
  },
  {
    file: 'src/ui/shell/doc-nav.js',
    component: 'Shell',
    patterns: ['setDocStep', 'renderProgressNav', 'guardCvDataStep', 'hirelyProgress'],
    estLines: 200,
  },
  {
    file: 'src/ui/import/import-step.js',
    component: 'ImportStep',
    patterns: ['handleFileImport', 'importLog', 'showImportPaste', 'finishImportUi', 'importState', 'linkedinImport', 'drop', 'fileInput'],
    estLines: 2200,
    funcHint: 'import',
  },
  {
    file: 'src/ui/review/review-step.js',
    component: 'ReviewStep',
    patterns: ['renderReview', 'suggestion', 'toClassify', 'reviewStudio', 'verifyPanel', 'issuesPanel', 'recruiter'],
    estLines: 1800,
    funcHint: 'review',
  },
  {
    file: 'src/ui/style/style-step.js',
    component: 'StyleStep',
    patterns: ['renderTemplates', 'premiumGallery', 'templateGrid', 'spacing', 'extractionQuality', 'proCvLayout'],
    estLines: 900,
    funcHint: 'style',
  },
  {
    file: 'src/ui/export/export-step.js',
    component: 'ExportStep',
    patterns: ['downloadPDF', 'downloadBtn', 'emailCv', 'a4Zoom', 'cvExportBar', 'exportMore'],
    estLines: 700,
    funcHint: 'export',
  },
  {
    file: 'src/ui/render/render-cv.js',
    component: 'SharedStudio',
    patterns: ['renderCV', 'renderCVInner', 'renderAll', 'renderAllFromFinalResume', 'syncActiveTemplate'],
    estLines: 600,
    funcHint: 'render-core',
  },
  {
    file: 'src/ui/shell/app-state.js',
    component: 'Shell',
    patterns: ['const state=', 'getFinalResumeData', 'getFinalCvData', 'emptyCVData'],
    estLines: 150,
  },
  {
    file: 'src/ui/shell/app-boot.js',
    component: 'Shell',
    patterns: ['getHirelyCore', 'bootHirely', 'validateDomContract', 'HirelyParse', 'DOMContentLoaded'],
    estLines: 400,
  },
  {
    file: 'src/ui/shell/i18n.js',
    component: 'Shell',
    patterns: ['const I18N', 'applyI18n', 't(', 'data-i'],
    estLines: 350,
  },
  {
    file: 'src/ui/footer/doc-footer.js',
    component: 'Footer',
    patterns: ['coverLetter', 'generateLetter', 'flowPrimaryCta', 'unlockBtn', 'pricing'],
    estLines: 400,
  },
];

function lineCount(start, end) {
  return end - start + 1;
}

function categorizeFunction(name) {
  const n = name.toLowerCase();
  if (/^rendercv|^renderall|^renderoutputs|^applytemplate|^updatecv|^renderallfrom/.test(n)) return 'render-core';
  if (/import|extract|ocr|paste|drop|file|linkedin|upload/.test(n)) return 'import';
  if (/export|pdf|download|email|letter|a4zoom/.test(n)) return 'export';
  if (/template|tpl|gallery|spacing|premiumgallery/.test(n)) return 'style';
  if (/review|verify|suggest|issue|recruit|studio|classify|suggestion/.test(n)) return 'review';
  if (/setdoc|progress|nav|hero|pricing|i18n|locale|translate/.test(n)) return 'shell';
  if (/^render/.test(n)) return 'render-ui';
  if (/boot|dom|hirelytrace|validate/.test(n)) return 'runtime-dup';
  return 'shared';
}

function parseFunctions(script, scriptStartLine) {
  const funcRe = /^(async )?function (\w+)|^const (\w+) = (async )?function/gm;
  const funcs = [];
  let m;
  while ((m = funcRe.exec(script))) {
    const name = m[2] || m[3];
    const line = scriptStartLine + script.slice(0, m.index).split('\n').length;
    funcs.push({ name, line, category: categorizeFunction(name) });
  }
  return funcs;
}

function countIdsInRange(lines, start, end) {
  const slice = lines.slice(start - 1, end).join('\n');
  return [...slice.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]);
}

function main() {
  const html = fs.readFileSync(INDEX, 'utf8');
  const lines = html.split('\n');
  const totalLines = lines.length;

  const regions = {
    'head-meta': [1, 13],
    'head-css-links-1': [14, 47],
    'head-lazy-boot-script': [48, 68],
    'inline-style': [69, 997],
    'head-css-links-2': [998, 1013],
    'body-html': [1014, 1527],
    'external-script-tags': [1528, 1549],
    'inline-script': [1550, lines.length - 2],
  };

  const regionLines = Object.fromEntries(
    Object.entries(regions).map(([k, [s, e]]) => [k, e - s + 1])
  );

  const scriptStart = 1550;
  const script = lines.slice(scriptStart - 1, lines.length - 2).join('\n');
  const funcs = parseFunctions(script, scriptStart);

  const funcByCat = {};
  for (const f of funcs) {
    if (!funcByCat[f.category]) funcByCat[f.category] = [];
    funcByCat[f.category].push(f);
  }

  const linkedCss = [...html.matchAll(/href="([^"]+\.css)"/g)].length;
  const requiredDom = fs.existsSync(path.join(ROOT, 'src/ui/runtime/dom-contract.js'))
    ? [...fs.readFileSync(path.join(ROOT, 'src/ui/runtime/dom-contract.js'), 'utf8').matchAll(/'([a-zA-Z][a-zA-Z0-9_]*)'/g)]
        .map((m) => m[1])
        .filter((id) => id.length > 2 && /^[a-z]/.test(id))
    : [];

  const importIds = countIdsInRange(lines, 1083, 1154);
  const reviewIds = [
    ...countIdsInRange(lines, 1308, 1380),
    ...countIdsInRange(lines, 1423, 1461),
  ];
  const styleIds = countIdsInRange(lines, 1185, 1198);
  const exportIds = [...countIdsInRange(lines, 1167, 1173), ...countIdsInRange(lines, 1510, 1521)];

  const targetShell = 180;
  const targetAfterStyleExtract = totalLines - regionLines['inline-style'];
  const targetAfterScriptExtract = targetAfterStyleExtract - regionLines['inline-script'] + 35;
  const targetAfterHtmlPartials =
    targetAfterScriptExtract - regionLines['body-html'] + targetShell + 120;

  const out = [];
  out.push('# Component Split Plan');
  out.push('');
  out.push(`**Generated:** ${new Date().toISOString()}`);
  out.push('**Goal:** Decompose `index.html` into **ImportStep**, **ReviewStep**, **StyleStep**, **ExportStep**, **Landing**, **Header**, **Footer** — target **`index.html` < 1,500 lines**.');
  out.push('');
  out.push('## Executive summary');
  out.push('');
  out.push('| Metric | Value |');
  out.push('|--------|-------|');
  out.push(`| Current \`index.html\` lines | **${totalLines.toLocaleString()}** |`);
  out.push(`| Inline \`<style>\` block | ${regionLines['inline-style']} lines (~83 KB) |`);
  out.push(`| Inline \`<script>\` block | ${regionLines['inline-script']} lines |`);
  out.push(`| Body HTML (components) | ${regionLines['body-html']} lines |`);
  out.push(`| External \`<script src>\` tags | ${regionLines['external-script-tags']} lines |`);
  out.push(`| External \`<link>\` CSS tags | ${linkedCss} |`);
  out.push(`| Inline JS functions | ${funcs.length} |`);
  out.push(`| Target \`index.html\` | **< 1,500 lines** |`);
  out.push('');
  out.push('### Line budget to reach < 1,500');
  out.push('');
  out.push('| Removal / move | Lines freed | Running total |');
  out.push('|----------------|------------:|--------------:|');
  out.push(`| Move inline CSS → \`core.css\` (see CSS_CONSOLIDATION_PLAN) | −${regionLines['inline-style']} | ${(totalLines - regionLines['inline-style']).toLocaleString()} |`);
  out.push(`| Extract inline JS → ES modules | −${regionLines['inline-script']} + ~35 script tags | **~${targetAfterScriptExtract.toLocaleString()}** |`);
  out.push(`| Extract HTML partials → \`src/ui/components/*.html\` | −${regionLines['body-html']} + ~${targetShell + 120} shell | **~${targetAfterHtmlPartials.toLocaleString()}** |`);
  out.push('');
  out.push('> **Verdict:** `< 1,500` is achievable only when **inline CSS, inline JS, and body HTML** all leave `index.html`. The shell retains meta, bundle links, mount points, and `type="module"` entry.');
  out.push('');
  out.push('## Current structure');
  out.push('');
  out.push('```');
  out.push('index.html (8,476 lines)');
  out.push('├── <head>');
  out.push(`│   ├── meta + fonts          (${regionLines['head-meta']} lines)`);
  out.push(`│   ├── 50× CSS <link>        (${regionLines['head-css-links-1'] + regionLines['head-css-links-2']} lines)`);
  out.push(`│   ├── HirelyLazy boot       (${regionLines['head-lazy-boot-script']} lines)`);
  out.push(`│   └── inline <style>        (${regionLines['inline-style']} lines)  ← MOVE OUT`);
  out.push('├── <body>');
  out.push(`│   ├── Header                (5 lines)`);
  out.push(`│   ├── Landing (#hero)       (28 lines)`);
  out.push(`│   ├── Workspace shell       (33 lines)`);
  out.push(`│   ├── ImportStep (#wsImport) (72 lines)`);
  out.push(`│   ├── wsProduct main        (~310 lines, multi-step)`);
  out.push(`│   ├── Footer + pricing      (64 lines)`);
  out.push(`│   ├── 22× external scripts  (${regionLines['external-script-tags']} lines)`);
  out.push(`│   └── inline <script>       (${regionLines['inline-script']} lines)  ← MOVE OUT`);
  out.push('└── </html>');
  out.push('```');
  out.push('');
  out.push('### Doc-step mapping');
  out.push('');
  out.push('| UI step | `docStep-*` class | Primary DOM roots |');
  out.push('|---------|-------------------|-------------------|');
  out.push('| **ImportStep** | `import` | `#wsImport`, `#drop`, `#fileInput`, `#importPasteFallback` |');
  out.push('| **ReviewStep** | `edit`, `verify` | `#reviewStudioCenter`, `#reviewStudioAnalysis`, `#studioRail`, `#wsInsights` |');
  out.push('| **StyleStep** | `style` | `#styleStepHead`, `#templatePickerBar`, `#premiumTemplateGallery` |');
  out.push('| **ExportStep** | `export` | `#exportStepHead`, `#a4ZoomBar`, `#cvExportBar`, `#downloadBtn` |');
  out.push('| **Landing** | pre-workspace | `#hero`, `#heroUploadBtn` |');
  out.push('| **Header** | global | `header.top`, `#uiLang`, nav anchors |');
  out.push('| **Footer** | global + step CTAs | `footer.docFooter`, `#pricing`, `.footer` |');
  out.push('');
  out.push('## Component extraction map (HTML)');
  out.push('');

  for (const [name, cfg] of Object.entries(COMPONENTS)) {
    out.push(`### ${name}`);
    out.push('');
    out.push(`| Property | Value |`);
    out.push(`|----------|-------|`);
    if (cfg.start) out.push(`| Lines | ${cfg.start}–${cfg.end} (${lineCount(cfg.start, cfg.end)} lines) |`);
    if (cfg.ranges) {
      const total = cfg.ranges.reduce((s, r) => s + lineCount(r[0], r[1]), 0);
      out.push(`| Lines (fragmented) | ${total} across ${cfg.ranges.length} regions |`);
    }
    out.push(`| Root | \`${cfg.root}\` |`);
    if (cfg.docSteps) out.push(`| Active on | ${cfg.docSteps.join(', ')} |`);
    if (cfg.note) out.push(`| Note | ${cfg.note} |`);
    if (cfg.ranges) {
      out.push('');
      out.push('| Region | Lines | Anchor |');
      out.push('|--------|------:|--------|');
      for (const [s, e, anchor] of cfg.ranges) {
        out.push(`| | ${s}–${e} | \`${anchor}\` |`);
      }
    }
    if (cfg.also) out.push(`| Also includes | ${cfg.also.join('; ')} |`);
    out.push('');
    out.push(`**Proposed file:** \`src/ui/components/${name}.html\``);
    out.push('');
  }

  out.push('### SharedStudio (not a user-facing step)');
  out.push('');
  out.push(`Lines **1174–1307** (${lineCount(1174, 1307)} lines): \`#studioPreview\`, \`#cvStage\`, \`#cvDoc\`, \`#a4Viewport\`. Required by DOM contract (\`cvDoc\` / \`cvPreview\`). Lives in \`src/ui/components/SharedStudio.html\` or stays in shell.`);
  out.push('');
  out.push('### ProgressNav (workspace chrome)');
  out.push('');
  out.push('Lines **1054–1082** (29 lines): `#docNav` — mount in shell or `WorkspaceShell.html`.');
  out.push('');
  out.push('## Component extraction map (JavaScript)');
  out.push('');
  out.push(`**${funcs.length} functions** in the monolithic script. Recommended ES module split:`);
  out.push('');
  out.push('| Module | Component | Est. lines | Functions (category) |');
  out.push('|--------|-----------|----------:|----------------------|');
  for (const mod of JS_MODULE_MAP) {
    const count = mod.funcHint ? (funcByCat[mod.funcHint]?.length || 0) : '—';
    out.push(`| \`${mod.file}\` | ${mod.component} | ~${mod.estLines} | ${count} |`);
  }
  out.push('');
  out.push('### Function inventory by category');
  out.push('');
  out.push('| Category | Count | Extract to |');
  out.push('|----------|------:|------------|');
  const extractMap = {
    import: 'import-step.js',
    review: 'review-step.js',
    style: 'style-step.js',
    export: 'export-step.js',
    'render-core': 'render-cv.js',
    'render-ui': 'render-cv.js + step modules',
    shell: 'doc-nav.js + app-boot.js',
    'runtime-dup': 'DELETE (use dom-contract.js / boot-trace.js)',
    shared: 'app-state.js + i18n.js',
  };
  for (const [cat, list] of Object.entries(funcByCat).sort((a, b) => b[1].length - a[1].length)) {
    out.push(`| ${cat} | ${list.length} | ${extractMap[cat] || 'TBD'} |`);
  }
  out.push('');
  out.push('### Duplicate runtime (delete from index after extract)');
  out.push('');
  out.push('These already exist in `src/ui/runtime/` — remove copies from inline script:');
  out.push('');
  out.push('- `hirelyTrace`, `setHTML`, `setText`, `validateDomContract` → `dom-contract.js` / `dom-safe.js`');
  out.push('- `bootTraceStep`, `ensureBootTraceArray` → `boot-trace.js`');
  out.push('- Import forensics hooks → `import-forensics.js`');
  out.push('');
  out.push(`~${funcByCat['runtime-dup']?.length || 0} functions / wrappers can be deleted outright.`);
  out.push('');
  out.push('### Critical anchors (do not break)');
  out.push('');
  out.push('| Symbol | Line | Module owner |');
  out.push('|--------|-----:|--------------|');
  const anchors = [
    ['setDocStep', 'doc-nav.js'],
    ['handleFileImport', 'import-step.js'],
    ['renderCV', 'render-cv.js'],
    ['renderAll', 'render-cv.js'],
    ['state', 'app-state.js'],
    ['getHirelyCore boot', 'app-boot.js'],
  ];
  for (const [sym, owner] of anchors) {
    const f = funcs.find((x) => x.name === sym || (sym === 'state' && false));
    if (sym === 'state') {
      const line = lines.findIndex((l) => l.startsWith('const state=')) + 1;
      out.push(`| \`const state\` | ${line} | \`${owner}\` |`);
    } else if (sym === 'getHirelyCore boot') {
      out.push(`| \`getHirelyCore().then(...)\` | ~8388 | \`${owner}\` |`);
    } else {
      const fn = funcs.find((x) => x.name === sym);
      out.push(`| \`${sym}()\` | ${fn?.line || '—'} | \`${owner}\` |`);
    }
  }
  out.push('');
  out.push('## Target `index.html` shell (< 1,500 lines)');
  out.push('');
  out.push('```html');
  out.push('<!DOCTYPE html>');
  out.push('<html lang="fr">');
  out.push('<head>');
  out.push('  <!-- ~15 lines: meta, title, fonts -->');
  out.push('  <link rel="stylesheet" href="dist/core.css">');
  out.push('  <link rel="stylesheet" href="dist/design-system.css">');
  out.push('  <link rel="stylesheet" href="dist/templates.css">');
  out.push('  <script src="src/ui/runtime/hirely-lazy.js"></script>');
  out.push('</head>');
  out.push('<body>');
  out.push('  <div id="hirelyCoreLoadError" class="hidden">…</div>');
  out.push('  <div id="app">');
  out.push('    <div id="header-mount"></div>');
  out.push('    <div id="landing-mount"></div>');
  out.push('    <div id="workspace-mount"></div>');
  out.push('    <div id="footer-mount"></div>');
  out.push('  </div>');
  out.push('  <!-- ~22 runtime script tags (unchanged until barrel) -->');
  out.push('  <script type="module" src="src/ui/shell/app-main.js"></script>');
  out.push('</body>');
  out.push('</html>');
  out.push('```');
  out.push('');
  out.push(`**Estimated shell size:** ~${targetShell} lines (head) + ~120 (script refs) + ~40 (mount divs) = **~340 lines** with 3 CSS bundles.`);
  out.push('');
  out.push('## Assembly strategies');
  out.push('');
  out.push('| Strategy | Pros | Cons | Recommendation |');
  out.push('|----------|------|------|----------------|');
  out.push('| **A. Build-time HTML includes** (Vite/Esbuild `import.meta.glob`) | Zero runtime fetch; DOM present at parse | Needs bundler in dev | **Preferred** |');
  out.push('| **B. Runtime `fetch()` partials** | No build step | Flash of empty mounts; DOM contract races | Dev-only fallback |');
  out.push('| **C. `document.createRange` templates in JS** | Single module graph | HTML buried in strings | Avoid |');
  out.push('');
  out.push('### Workspace mount tree (post-split)');
  out.push('');
  out.push('```');
  out.push('#workspace-mount');
  out.push('└── WorkspaceShell.html');
  out.push('    ├── ProgressNav.html');
  out.push('    ├── ImportStep.html          ← aside#wsImport');
  out.push('    └── wsProduct');
  out.push('        ├── StepHeads.html       ← resume/style/export headers');
  out.push('        ├── SharedStudio.html    ← #cvStage / #cvDoc');
  out.push('        ├── ReviewStep.html      ← review panels + studioRail');
  out.push('        ├── StyleStep.html       ← gallery + pro layout');
  out.push('        ├── ExportStep.html      ← zoom + export chrome');
  out.push('        └── InsightsAside.html   ← #wsInsights');
  out.push('```');
  out.push('');
  out.push('## DOM IDs per component');
  out.push('');
  out.push('| Component | ID count (sample) | Contract-critical |');
  out.push('|-----------|------------------:|-------------------|');
  out.push(`| ImportStep | ${importIds.length} | \`drop\`, \`fileInput\`, \`importPasteFallback\` |`);
  out.push(`| ReviewStep | ${reviewIds.length} | \`cvDoc\` (via SharedStudio), \`reviewPanel\` |`);
  out.push(`| StyleStep | ${styleIds.length} | \`templateGrid\`, \`premiumTemplateGallery\` |`);
  out.push(`| ExportStep | ${exportIds.length} | \`downloadBtn\`, \`cvExportBar\` |`);
  out.push('');
  out.push('`dom-contract.js` **requiredIds** must resolve after partial assembly: `app`, `docNav`, `wsImport`, `drop`, `fileInput`, `cvPreview` (alias `cvDoc`).');
  out.push('');
  out.push('## Phased migration');
  out.push('');
  out.push('### Phase 0 — Inventory lock');
  out.push('1. Land this plan + `npm run qa:index-decomposition`.');
  out.push('2. Extend `dom-contract.js` optionalIds for every mount root (`header-mount`, etc.) only if using runtime assembly.');
  out.push('3. Baseline: `npm run qa:boot`, `npm run qa:dom-contract`, import forensics.');
  out.push('');
  out.push('### Phase 1 — Extract JS (largest win)');
  out.push('1. Create `src/ui/shell/app-main.js` — sole `type="module"` entry.');
  out.push('2. Move `const state` → `app-state.js`; export `getState()` / `setState()`.');
  out.push('3. Move import pipeline (`handleFileImport` @ line 7387) → `import-step.js`.');
  out.push('4. Move `setDocStep` → `doc-nav.js`; re-export on `window` for QA scripts.');
  out.push('5. Move `renderCV` / `renderAll` → `render-cv.js`.');
  out.push('6. Delete runtime duplicates already in `src/ui/runtime/*`.');
  out.push('');
  out.push(`**Lines removed:** ~${regionLines['inline-script']} → index drops to ~${totalLines - regionLines['inline-script'] + 35}.`);
  out.push('');
  out.push('### Phase 2 — Extract inline CSS');
  out.push('1. Fold `<style>` block into `core.css` (per CSS_CONSOLIDATION_PLAN).');
  out.push(`**Lines removed:** ~${regionLines['inline-style']}.`);
  out.push('');
  out.push('### Phase 3 — Extract HTML partials');
  out.push('1. Cut/paste each component region into `src/ui/components/*.html`.');
  out.push('2. Wire Vite (or lightweight `scripts/assemble-index.mjs`) to emit final `index.html`.');
  out.push('3. Keep **one** `#workspaceGrid` wrapper — do not split across async fetches without shell.');
  out.push('');
  out.push('### Phase 4 — Collapse script tags');
  out.push('1. Optional barrel: `src/ui/shell/runtime-scripts.js` imports existing `src/ui/**` modules.');
  out.push('2. Reduce 22 `<script src>` to 1 module graph.');
  out.push('');
  out.push('## Risks');
  out.push('');
  out.push('| Risk | Mitigation |');
  out.push('|------|------------|');
  out.push('| `setDocStep` CSS class toggles depend on DOM order | Keep `#workspaceGrid` in shell; partials inside stable children |');
  out.push('| Global `state` / `$()` used everywhere | Phase 1: `window.HirelyApp = { state, $ }` shim |');
  out.push('| QA scripts grep `index.html` | Update greps to `src/ui/**/*.js` |');
  out.push('| Import gate | Decomposition is structural — no visual polish during FAIL gate |');
  out.push('| `HirelyParse` export on boot | Preserve `window.HirelyParse` surface in `app-boot.js` |');
  out.push('');
  out.push('## Verification');
  out.push('');
  out.push('```bash');
  out.push('npm run qa:index-decomposition   # regenerate this report');
  out.push('npm run qa:dom-contract');
  out.push('npm run qa:boot');
  out.push('npm run qa:import-forensics');
  out.push('wc -l index.html                 # must be < 1500 after Phase 3');
  out.push('```');
  out.push('');
  out.push('## Related');
  out.push('');
  out.push('- `CSS_CONSOLIDATION_PLAN.md` — inline style extraction (~929 lines)');
  out.push('- `DOM_CONTRACT_REPORT.md` — required DOM IDs');
  out.push('- `DEAD_REFERENCE_REPORT.md` — stale selectors after split');
  out.push('');

  const outPath = path.join(ROOT, 'COMPONENT_SPLIT_PLAN.md');
  fs.writeFileSync(outPath, out.join('\n'));
  console.log(`Wrote ${outPath}`);
  console.log(`index.html: ${totalLines} lines → target < 1500`);
  console.log(`JS functions: ${funcs.length}, inline script: ${regionLines['inline-script']} lines`);
}

main();
