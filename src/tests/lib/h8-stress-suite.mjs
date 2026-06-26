/**
 * HIRELY H8 — 100 CV generalization stress (OCR → Parser → Normalizer → Renderer → PDF).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { runHirelyImportFromText } from '../../core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../../core/validation/sanitize-resume-display.js';
import { resumeDataToCvData } from '../../core/resume-data.js';
import { H8_STRESS_FIXTURES, H8_ENGINE } from '../../../tests/lib/h8-generalization-catalog.mjs';
import { simulateOcrScan } from '../../../tests/lib/h8-ocr-simulate.mjs';
import {
  evaluateExtractionSuccess,
  evaluatePipelineStages,
  aggregateH8Stress,
  H8_EXTRACTION_GOAL_PCT,
} from '../../../tests/lib/h8-stress-metrics.mjs';
import { loadHirelyTemplates } from './pdf-hardening-suite.mjs';
import { exportCvPdfPlaywright, analyzePdfBytes } from './pdf-export-playwright.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const ROOT = path.join(__dirname, '../../..');
export const OUT_DIR = path.join(ROOT, 'tests/output/h8-stress');
export const REPORT_JSON = path.join(OUT_DIR, 'report.json');

/**
 * @param {{ writePdfs?: boolean, fixtures?: typeof H8_STRESS_FIXTURES }} [opts]
 */
export async function runH8StressSuite(opts = {}) {
  const fixtures = opts.fixtures || H8_STRESS_FIXTURES;
  const writePdfs = opts.writePdfs !== false;
  fs.mkdirSync(OUT_DIR, { recursive: true });
  if (writePdfs) fs.mkdirSync(path.join(OUT_DIR, 'pdfs'), { recursive: true });

  const T = loadHirelyTemplates();
  const browser = await chromium.launch({ headless: true });
  const page = await browser.newPage();
  const rows = [];

  for (let idx = 0; idx < fixtures.length; idx++) {
    const fixture = fixtures[idx];
    const row = {
      id: fixture.id,
      archetype: fixture.archetype,
      label: fixture.label,
      templateId: fixture.templateId,
      extraction: { success: false, failures: ['pending'] },
      pipeline: { pipelinePass: false, stages: {} },
      stages: {},
      error: null,
    };

    try {
      const ocrText = simulateOcrScan(fixture.text, idx);
      row.stages.ocr = { ok: ocrText.length > 40, charsIn: fixture.text.length, charsOut: ocrText.length };

      const importResult = await runHirelyImportFromText(ocrText, {
        source: fixture.id,
        extractionMethod: 'pdf-ocr',
        file: {
          name: `${fixture.id}.txt`,
          type: 'text/plain',
          size: ocrText.length,
        },
      });

      const parserOk =
        !importResult?.errors?.includes('OCR_PARSER_GATE_BLOCKED') &&
        (importResult?.resumeData?.identity?.name || importResult?.structuredResume);
      row.stages.parser = {
        ok: !!parserOk,
        importStatus: importResult?.importStatus || null,
        errors: importResult?.errors || [],
      };

      const rd = sanitizeResumeForDisplay(importResult?.resumeData || {});
      const cv = resumeDataToCvData(rd);
      const normalizerOk = !!(rd?.identity?.name || cv?.name);
      row.stages.normalizer = { ok: normalizerOk };

      const extraction = evaluateExtractionSuccess(fixture.text, rd, cv);
      row.extraction = extraction;

      const inner = T.render(cv, fixture.templateId);
      const renderOk = !!(inner && inner.length >= 80);
      row.stages.renderer = { ok: renderOk, htmlLen: inner?.length || 0 };

      let pdfOk = false;
      let pdfMeta = null;
      if (renderOk) {
        const pdfPath = path.join(OUT_DIR, 'pdfs', `${fixture.id}.pdf`);
        try {
          await exportCvPdfPlaywright(page, inner, fixture.templateId, pdfPath);
          const bytes = fs.readFileSync(pdfPath);
          pdfMeta = await analyzePdfBytes(bytes);
          pdfOk = (pdfMeta?.pageCount || 0) >= 1 && (pdfMeta?.bytes || 0) > 1500;
          if (!writePdfs) fs.unlinkSync(pdfPath);
        } catch (e) {
          row.stages.pdf = { ok: false, error: String(e.message || e) };
        }
      }
      if (!row.stages.pdf) {
        row.stages.pdf = { ok: pdfOk, ...(pdfMeta || {}) };
      }

      row.pipeline = evaluatePipelineStages({
        ocrOk: row.stages.ocr?.ok,
        parserOk: row.stages.parser?.ok,
        normalizerOk: row.stages.normalizer?.ok,
        renderOk,
        pdfOk,
      });
    } catch (e) {
      row.error = String(e.message || e);
      row.extraction = { success: false, failures: ['pipeline_error'] };
      row.pipeline = evaluatePipelineStages({});
    }

    rows.push(row);
  }

  await browser.close();

  const summary = aggregateH8Stress(rows);
  const report = {
    generatedAt: new Date().toISOString(),
    engine: H8_ENGINE,
    count: fixtures.length,
    archetypes: fixtures.reduce((acc, f) => {
      acc[f.archetype] = (acc[f.archetype] || 0) + 1;
      return acc;
    }, {}),
    pipeline: ['OCR (simulated)', 'Parser', 'Normalizer', 'Renderer', 'PDF'],
    goal: { extractionSuccessPct: H8_EXTRACTION_GOAL_PCT },
    results: rows,
    summary,
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), 'utf8');
  return report;
}

export function buildH8StressMarkdown(report) {
  const s = report.summary;
  const lines = [];
  lines.push('# GENERALIZATION STRESS REPORT');
  lines.push('');
  lines.push(`Generated: ${report.generatedAt}`);
  lines.push(`Engine: \`${report.engine}\``);
  lines.push('');
  lines.push('## Verdict');
  lines.push('');
  lines.push(s.pass ? '# **PASS**' : '# **FAIL**');
  lines.push('');
  lines.push(
    `**${s.extracted}/${s.count}** successful extractions (${s.extractionRate}%). Goal: **≥ ${s.goal}%**.`
  );
  lines.push(
    `Full pipeline (OCR → PDF): **${s.pipelinePass}/${s.count}** (${s.pipelineRate}%).`
  );
  lines.push('');
  lines.push('## Acceptance');
  lines.push('');
  lines.push('| Criterion | Result |');
  lines.push('|-----------|--------|');
  lines.push(`| Extraction success | ${s.extractionRate}% (≥ ${s.goal}%) |`);
  lines.push(`| Corpus size | ${s.count} resumes |`);
  lines.push(`| Archetypes | ${Object.keys(report.archetypes || {}).length} |`);
  lines.push('');
  lines.push('## Pipeline');
  lines.push('');
  lines.push('```');
  lines.push('Synthetic CV text');
  lines.push('  → simulateOcrScan() + postProcessOcrText');
  lines.push('  → runHirelyImportFromText (Parser)');
  lines.push('  → sanitizeResumeForDisplay (Normalizer)');
  lines.push('  → HirelyTemplates.render (Renderer)');
  lines.push('  → Playwright A4 PDF (PDF)');
  lines.push('```');
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Metric | Value |');
  lines.push('|--------|------:|');
  lines.push(`| Total | ${s.count} |`);
  lines.push(`| Extracted | ${s.extracted} |`);
  lines.push(`| Extraction rate | ${s.extractionRate}% |`);
  lines.push(`| Full pipeline pass | ${s.pipelinePass} |`);
  lines.push(`| Pipeline rate | ${s.pipelineRate}% |`);
  lines.push('');
  lines.push('## By archetype');
  lines.push('');
  lines.push('| Archetype | Extracted | Pipeline | Total |');
  lines.push('|-----------|----------:|---------:|------:|');
  for (const [arch, stats] of Object.entries(s.byArchetype || {}).sort()) {
    lines.push(`| ${arch} | ${stats.extracted} | ${stats.pipeline} | ${stats.total} |`);
  }
  lines.push('');

  if (s.failureCauses?.length) {
    lines.push('## Top failure causes');
    lines.push('');
    lines.push('| Cause | Count |');
    lines.push('|-------|------:|');
    for (const f of s.failureCauses.slice(0, 12)) {
      lines.push(`| ${f.cause} | ${f.count} |`);
    }
    lines.push('');
  }

  const fails = report.results.filter((r) => !r.extraction?.success);
  if (fails.length) {
    lines.push('## Extraction failures');
    lines.push('');
    lines.push('| ID | Archetype | Issues |');
    lines.push('|----|-----------|--------|');
    for (const f of fails.slice(0, 20)) {
      lines.push(
        `| ${f.id} | ${f.archetype} | ${(f.extraction?.failures || []).join(', ') || f.error || '—'} |`
      );
    }
    if (fails.length > 20) lines.push(`| … | … | +${fails.length - 20} more |`);
    lines.push('');
  }

  lines.push('## Module map');
  lines.push('');
  lines.push('| File | Role |');
  lines.push('|------|------|');
  lines.push('| `tests/lib/h8-generalization-catalog.mjs` | 100 synthetic CV corpus |');
  lines.push('| `tests/lib/h8-ocr-simulate.mjs` | OCR noise + postProcessOcrText |');
  lines.push('| `src/core/pipeline/hirely-import.js` | Parser import |');
  lines.push('| `src/core/validation/sanitize-resume-display.js` | Normalizer |');
  lines.push('| `src/ui/templates/cv-templates.js` | Renderer |');
  lines.push('| `src/tests/lib/pdf-export-playwright.mjs` | PDF export QA |');
  lines.push('| `src/tests/lib/h8-stress-suite.mjs` | H8 runner |');
  lines.push('');
  lines.push('## Verification');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run qa:generalization-stress');
  lines.push('npm run generalization:stress-report');
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}
