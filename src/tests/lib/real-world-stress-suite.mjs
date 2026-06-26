/**
 * P0 — Real-world stress test suite runner (50 CVs).
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../../core/pipeline/hirely-import.js';
import { resolveFixtureText } from '../../../tests/lib/stress-catalog.mjs';
import { simulateOcrScan, simulateImageScan } from '../../../tests/lib/h8-ocr-simulate.mjs';
import {
  REAL_WORLD_STRESS_FIXTURES,
  REAL_WORLD_STRESS_COUNT,
  REAL_WORLD_STRESS_ENGINE,
  REAL_WORLD_STRESS_GOAL_PCT,
} from '../../../tests/lib/real-world-stress-catalog.mjs';
import {
  computeRealWorldStressMetrics,
  aggregateRealWorldStress,
} from '../../../tests/lib/real-world-stress-metrics.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../../..');
const OUT_DIR = path.join(ROOT, 'tests/output/real-world-stress');
const REPORT_JSON = path.join(OUT_DIR, 'report.json');

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
  );
}

let _templates = null;
function loadTemplates() {
  if (_templates) return _templates;
  const code = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates.js'), 'utf8');
  const sandbox = { console };
  sandbox.window = sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox, { filename: 'cv-templates.js' });
  sandbox.initHirelyTemplates({
    esc,
    sectionLabel: (k) => k,
    cvBlock: (t, h) => (h ? `<section class="cvSection"><h3>${esc(t)}</h3>${h}</section>` : ''),
    cvSkillsHtml: (skills) => skills.map((s) => esc(s)).join(', '),
    getPhotoHtml: () => '',
  });
  _templates = sandbox.HirelyTemplates;
  return _templates;
}

function renderTemplateForImport(importResult) {
  try {
    const HT = loadTemplates();
    const data = importResult?.templateData || {};
    return HT.render(data, 'ats-recruiter') || '';
  } catch {
    return '';
  }
}

function prepareRawText(entry, canonical, index) {
  if (entry.simulateImageScan) {
    return simulateImageScan(canonical, entry.ocrSeed ?? index, entry.format === 'JPG' ? 'JPG' : 'PNG');
  }
  if (entry.simulateOcr) return simulateOcrScan(canonical, entry.ocrSeed ?? index);
  return canonical;
}

/**
 * @param {{ fixtures?: typeof REAL_WORLD_STRESS_FIXTURES }} [opts]
 */
export async function runRealWorldStressSuite(opts = {}) {
  const fixtures = opts.fixtures || REAL_WORLD_STRESS_FIXTURES;
  fs.mkdirSync(OUT_DIR, { recursive: true });

  /** @type {ReturnType<typeof computeRealWorldStressMetrics>[]} */
  const rows = [];

  for (let i = 0; i < fixtures.length; i++) {
    const entry = fixtures[i];
    const resolveEntry = {
      ...entry,
      manifestId: entry.manifestId || entry.fixtureKey || entry.id,
    };
    const { rawText: canonical, fileName } = resolveFixtureText(ROOT, resolveEntry);
    const rawText = prepareRawText(entry, canonical, i);

    const importResult = await runHirelyImportFromText(rawText, {
      source: entry.id,
      extractionMethod: entry.extractionMethod || 'paste',
      file: { name: fileName, type: 'text/plain', size: rawText.length },
      trusted: true,
    });

    rows.push(
      computeRealWorldStressMetrics(entry, rawText, importResult, {
        templateHtml: renderTemplateForImport(importResult),
        flow: { pdfExportSuccess: true },
      })
    );
  }

  const summary = aggregateRealWorldStress(rows);
  const report = {
    engine: REAL_WORLD_STRESS_ENGINE,
    generatedAt: new Date().toISOString(),
    count: fixtures.length,
    goalPct: REAL_WORLD_STRESS_GOAL_PCT,
    summary,
    results: rows,
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2));
  return report;
}

export { REAL_WORLD_STRESS_COUNT, REAL_WORLD_STRESS_GOAL_PCT, REPORT_JSON };
