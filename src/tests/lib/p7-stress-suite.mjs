/**
 * P7 — 20 CV stress suite (import → parser → review → ATS → PDF).
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
  P7_CV_FIXTURES,
  P7_STRESS_ENGINE,
  P7_FIXTURE_COUNT,
} from '../../../tests/lib/p7-stress-catalog.mjs';
import { computeH6Metrics } from '../../../tests/lib/h6-stress-metrics.mjs';
import {
  evaluateP7Gates,
  buildP7ReviewAndAts,
  aggregateP7Stress,
  rankP7Blockers,
  h6FixtureKey,
} from '../../../tests/lib/p7-stress-metrics.mjs';
import { loadHirelyTemplates } from './pdf-hardening-suite.mjs';
import {
  exportCvPdfPlaywright,
  validatePdfHardening,
  auditExportDom,
} from './pdf-export-playwright.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../../..');
const OUT_DIR = path.join(ROOT, 'tests/output/p7-stress');
const REPORT_JSON = path.join(OUT_DIR, 'p7-stress-report.json');

/**
 * @param {{ writePdfs?: boolean, fixtures?: typeof P7_CV_FIXTURES }} [opts]
 */
export async function runP7StressSuite(opts = {}) {
  const fixtures = opts.fixtures || P7_CV_FIXTURES;
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
      archetype: fixture.archetype,
      templateId: fixture.templateId,
      extractionMethod: fixture.extractionMethod,
      fileName: null,
      importResult: null,
      error: null,
      gates: {},
      blockers: [],
      fullPass: false,
      parserRecall: 0,
      atsTotal: 0,
      reviewCompletionPct: 0,
    };

    try {
      const { rawText: canonical, fileName } = resolveFixtureText(ROOT, fixture);
      const rawText = fixture.simulateOcr
        ? simulateOcrScan(canonical, fixture.ocrSeed ?? idx)
        : canonical;
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
      };

      const rd = sanitizeResumeForDisplay(importResult?.resumeData || {});
      const cv = resumeDataToCvData(rd);
      const h6 = computeH6Metrics(h6FixtureKey(fixture), rawText, rd, cv);
      const { finalPack, reviewReport, atsScore } = buildP7ReviewAndAts(importResult, rd, cv);

      const inner = T.render(finalPack.cvData || cv, fixture.templateId);
      const renderOk = !!(inner && inner.length >= 80);

      let pdfHardening = null;
      let domAudit = null;
      if (renderOk) {
        const pdfPath = path.join(OUT_DIR, 'pdfs', `${fixture.id}.pdf`);
        const layout = await exportCvPdfPlaywright(page, inner, fixture.templateId, pdfPath);
        domAudit = await auditExportDom(page);
        const bytes = fs.readFileSync(pdfPath);
        pdfHardening = await validatePdfHardening(bytes, layout);
        if (!writePdfs) fs.unlinkSync(pdfPath);
        row.pdfMeta = {
          bytes: bytes.length,
          pageCount: pdfHardening?.pageCount,
          issues: pdfHardening?.issues || [],
        };
      }

      const evaluation = evaluateP7Gates({
        fixture,
        importResult,
        rawText,
        rd,
        cv,
        h6,
        finalPack,
        reviewReport,
        atsScore,
        renderOk,
        pdfHardening,
        domAudit,
      });

      Object.assign(row, {
        gates: evaluation.gates,
        blockers: evaluation.blockers,
        fullPass: evaluation.fullPass,
        parserRecall: evaluation.parserRecall,
        atsTotal: evaluation.atsTotal,
        reviewCompletionPct: evaluation.reviewCompletionPct,
        h6: {
          identity: h6.identity,
          experience: h6.experience,
          overall: h6.overall,
        },
      });
    } catch (e) {
      row.error = String(e.message || e);
      row.blockers = ['pipeline_error'];
      row.gates = { import: false, parser: false, review: false, ats: false, pdf: false };
    }

    rows.push(row);
  }

  await browser.close();

  const summary = aggregateP7Stress(rows);
  const blockers = rankP7Blockers(rows);
  const report = {
    generatedAt: new Date().toISOString(),
    engine: P7_STRESS_ENGINE,
    count: fixtures.length,
    expectedCount: P7_FIXTURE_COUNT,
    pipeline: ['Import', 'Parser', 'Review', 'ATS', 'PDF'],
    archetypes: fixtures.reduce((acc, f) => {
      acc[f.archetype] = (acc[f.archetype] || 0) + 1;
      return acc;
    }, {}),
    results: rows,
    summary,
    blockers,
  };

  fs.writeFileSync(REPORT_JSON, JSON.stringify(report, null, 2), 'utf8');
  return report;
}

export function buildP7StressMarkdown(report) {
  const s = report.summary;
  const lines = [];
  lines.push('# HIRELY P7 — 20 CV Stress Test');
  lines.push('');
  lines.push(`**Engine:** ${report.engine}`);
  lines.push(`**Generated:** ${report.generatedAt.slice(0, 19).replace('T', ' ')} UTC`);
  lines.push(`**Fixtures:** ${report.count} CV types`);
  lines.push('');
  lines.push('## Success summary');
  lines.push('');
  lines.push(`| Metric | Rate | Pass |`);
  lines.push(`|--------|------|------|`);
  for (const gate of ['import', 'parser', 'review', 'ats', 'pdf']) {
    const pass = s.gateCounts[gate];
    lines.push(`| ${gate.charAt(0).toUpperCase() + gate.slice(1)} success | ${s.rates[gate]}% | ${pass}/${s.count} |`);
  }
  lines.push(`| **Full pipeline** | **${s.fullPassRate}%** | **${s.fullPass}/${s.count}** |`);
  lines.push(`| Failure rate | ${s.failureRate}% | ${s.count - s.fullPass}/${s.count} |`);
  lines.push('');
  lines.push('## Per-CV results');
  lines.push('');
  lines.push('| CV | Archetype | Import | Parser | Review | ATS | PDF | Status |');
  lines.push('|----|-----------|--------|--------|--------|-----|-----|--------|');
  for (const r of report.results) {
    const g = r.gates;
    const mark = (ok) => (ok ? '✓' : '✗');
    lines.push(
      `| ${r.label} | ${r.archetype} | ${mark(g.import)} | ${mark(g.parser)} | ${mark(g.review)} | ${mark(g.ats)} | ${mark(g.pdf)} | ${r.fullPass ? 'PASS' : 'FAIL'} |`
    );
  }
  lines.push('');
  const lowAts = report.results.filter((r) => r.gates?.ats && r.atsTotal > 0 && r.atsTotal < 55);
  if (lowAts.length) {
    lines.push('## ATS quality gaps (engine OK, score < 55)');
    lines.push('');
    for (const r of lowAts) {
      lines.push(`- ${r.label}: score ${r.atsTotal}`);
    }
    lines.push('');
  }
  lines.push('## Remaining blockers');
  lines.push('');
  if (!report.blockers.length) {
    lines.push('_No blockers — all 20 CVs passed the full pipeline._');
  } else {
    for (const b of report.blockers) {
      lines.push(`- **${b.issue}** — ${b.count} CV(s): ${b.fixtures.join(', ')}`);
    }
  }
  lines.push('');
  lines.push('## Priority order');
  lines.push('');
  lines.push('Remediation order (highest impact first):');
  lines.push('');
  if (!report.blockers.length) {
    lines.push('1. _None — ship ready._');
  } else {
    report.blockers.forEach((b, i) => {
      lines.push(`${i + 1}. **${b.issue}** (${b.count} failures, priority ${b.priority})`);
    });
  }
  lines.push('');
  lines.push('## Detail');
  lines.push('');
  for (const r of report.results) {
    lines.push(`### ${r.label} (\`${r.id}\`)`);
    lines.push('');
    lines.push(`- Source: \`${r.fileName || '—'}\``);
    lines.push(`- Template: \`${r.templateId}\``);
    lines.push(
      `- Parser recall: ${r.parserRecall}% · ATS score: ${r.atsTotal} · Review: ${r.reviewCompletionPct}%`
    );
    if (r.atsTotal > 0 && r.atsTotal < 55) {
      lines.push('- ATS quality note: score below 55 (engine OK, content gap)');
    }
    if (r.blockers?.length) {
      lines.push(`- Blockers: ${r.blockers.join('; ')}`);
    }
    if (r.error) lines.push(`- Error: ${r.error}`);
    lines.push('');
  }
  return `${lines.join('\n')}\n`;
}
