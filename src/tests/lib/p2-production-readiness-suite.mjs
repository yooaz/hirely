/**
 * P2 — Production readiness suite (80 CVs).
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { chromium } from 'playwright';
import { runHirelyImportFromText } from '../../core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../../core/validation/sanitize-resume-display.js';
import { resumeDataToCvData } from '../../core/resume-data.js';
import { resolveFixtureText } from '../../../tests/lib/stress-catalog.mjs';
import { simulateOcrScan } from '../../../tests/lib/h8-ocr-simulate.mjs';
import {
  P2_READINESS_FIXTURES,
  P2_READINESS_ENGINE,
  P2_FIXTURE_COUNT,
  P2_CATEGORIES,
} from '../../../tests/lib/p2-production-readiness-catalog.mjs';
import { computeH6Metrics } from '../../../tests/lib/h6-stress-metrics.mjs';
import {
  evaluateP2Gates,
  aggregateP2Readiness,
  h6FixtureKey,
} from '../../../tests/lib/p2-production-readiness-metrics.mjs';
import { loadHirelyTemplates } from './pdf-hardening-suite.mjs';
import {
  exportCvPdfPlaywright,
  validatePdfHardening,
  auditExportDom,
} from './pdf-export-playwright.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../../..');
const OUT_DIR = path.join(ROOT, 'tests/output/p2-production-readiness');
const REPORT_JSON = path.join(OUT_DIR, 'report.json');

/**
 * @param {{ writePdfs?: boolean, fixtures?: typeof P2_READINESS_FIXTURES }} [opts]
 */
export async function runP2ProductionReadinessSuite(opts = {}) {
  const fixtures = opts.fixtures || P2_READINESS_FIXTURES;
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
      label: fixture.label,
      category: fixture.category,
      templateId: fixture.templateId,
      extractionMethod: fixture.extractionMethod,
      fileName: null,
      importResult: null,
      error: null,
      crashed: false,
      gates: {},
      blockers: [],
      fullPass: false,
      preservation: null,
      blankTemplate: false,
      blankExport: false,
      reviewQueueSize: 0,
      renderLen: 0,
      pdfBytes: 0,
    };

    try {
      const { rawText: canonical, fileName } = resolveFixtureText(ROOT, fixture);
      const rawText = fixture.simulateOcr ? simulateOcrScan(canonical, fixture.ocrSeed ?? idx) : canonical;
      row.fileName = fileName;

      const importResult = await runHirelyImportFromText(rawText, {
        source: fixture.id,
        extractionMethod: fixture.extractionMethod || 'paste',
        file: {
          name: fileName,
          type: 'text/plain',
          size: rawText.length,
        },
      });
      row.importResult = {
        importStatus: importResult?.importStatus,
        errors: importResult?.errors || [],
        warnings: (importResult?.warnings || []).slice(0, 5),
        reviewQueueSize: importResult?.reviewQueue?.length || 0,
      };

      const cleanedText = importResult?.cleanedText || rawText;
      const rd = sanitizeResumeForDisplay(importResult?.resumeData || {});
      const cv = resumeDataToCvData(rd);
      const h6 = computeH6Metrics(h6FixtureKey(fixture), rawText, rd, cv);

      const inner = T.render(cv, fixture.templateId);
      const renderHtml = String(inner || '');
      const renderOk = renderHtml.length >= 80 && !/<main[^>]*>\s*<\/main>/i.test(renderHtml);

      let pdfHardening = null;
      let domAudit = null;
      let pdfBytes = 0;
      if (renderOk) {
        const pdfPath = path.join(OUT_DIR, 'pdfs', `${fixture.id}.pdf`);
        const layout = await exportCvPdfPlaywright(page, inner, fixture.templateId, pdfPath);
        domAudit = await auditExportDom(page);
        const bytes = fs.readFileSync(pdfPath);
        pdfBytes = bytes.length;
        pdfHardening = await validatePdfHardening(bytes, layout);
        if (!writePdfs) fs.unlinkSync(pdfPath);
      }

      const evaluation = evaluateP2Gates({
        fixture,
        importResult,
        rawText,
        cleanedText,
        rd,
        cv,
        h6,
        renderOk,
        renderHtml,
        pdfHardening,
        domAudit,
        pdfBytes,
        crashed: false,
      });

      row.reviewQueueSize = evaluation.reviewQueueSize;

      Object.assign(row, {
        gates: evaluation.gates,
        blockers: evaluation.blockers,
        fullPass: evaluation.fullPass,
        preservation: evaluation.preservation,
        blankTemplate: evaluation.blankTemplate,
        blankExport: evaluation.blankExport,
        reviewQueueSize: evaluation.reviewQueueSize,
        renderLen: renderHtml.length,
        pdfBytes,
        h6: { overall: h6.overall, identity: h6.identity },
        pdfPages: pdfHardening?.pageCount || 0,
      });
    } catch (e) {
      row.crashed = true;
      row.error = String(e.message || e);
      row.blockers = ['parser_crash'];
      row.gates = {
        import: false,
        parser: false,
        content: false,
        template: false,
        pdf: false,
        review: false,
        stable: false,
      };
    }

    rows.push(row);
  }

  await browser.close();

  const summary = aggregateP2Readiness(rows);
  const report = {
    generatedAt: new Date().toISOString(),
    engine: P2_READINESS_ENGINE,
    count: fixtures.length,
    expectedCount: P2_FIXTURE_COUNT,
    categories: P2_CATEGORIES,
    pipeline: ['Import', 'Parser', 'Content preservation', 'Template', 'PDF', 'Review queue'],
    results: rows,
    summary,
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), 'utf8');
  return report;
}
