#!/usr/bin/env node
/**
 * HIRELY PRODUCTION STRESS — multi-archetype import suite.
 * node scripts/hirely-stress-report.mjs
 * Output: HIRELY_STRESS_REPORT.md
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText, runHirelyImportFromFile } from '../src/core/pipeline/hirely-import.js';
import { sanitizeResumeForDisplay } from '../src/core/validation/sanitize-resume-display.js';
import { resumeDataToCvData } from '../src/core/resume-data.js';
import {
  STRESS_FIXTURES,
  STRESS_GOAL_IMPORT_SUCCESS_PCT,
  extractStressMetrics,
  gradeStressFixture,
  resolveFixtureText,
  resolveOptionalPdf,
  makePdfFile,
} from '../tests/lib/stress-catalog.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT_PATH = path.join(ROOT, 'HIRELY_STRESS_REPORT.md');

function yesNo(v) {
  return v ? '✓' : '—';
}

function statusIcon(status) {
  if (status === 'PASS') return '✓ PASS';
  if (status === 'PARTIAL') return '◐ PARTIAL';
  return '✗ FAIL';
}

async function runTextFixture(entry) {
  const { rawText, fileName } = resolveFixtureText(ROOT, entry);
  const importResult = await runHirelyImportFromText(rawText, {
    source: entry.id,
    extractionMethod: entry.extractionMethod,
    file: { name: fileName, type: 'text/plain', size: rawText.length },
  });
  return { importResult, fileName, mode: 'text' };
}

const OCR_CACHE = path.join(ROOT, 'tests/output/ocr-quality-yoaz/report.json');

function loadOcrCacheText() {
  if (!fs.existsSync(OCR_CACHE)) return '';
  try {
    const t = JSON.parse(fs.readFileSync(OCR_CACHE, 'utf8')).ocrText;
    return t && t.length >= 80 ? t : '';
  } catch {
    return '';
  }
}

async function runPdfFixture(entry, pdfPath) {
  const buf = fs.readFileSync(pdfPath);
  const file = makePdfFile(buf, path.basename(pdfPath));
  let importResult = await runHirelyImportFromFile(file, {
    source: entry.id,
    extractionMethod: entry.extractionMethod,
  });

  const needsFallback =
    !importResult?.resumeData ||
    (importResult.errors || []).some((e) => /PDF\.js|TEXT_EMPTY|OCR/i.test(String(e)));

  if (needsFallback && entry.id === 'yoaz-pdf-live') {
    const cached = loadOcrCacheText();
    if (cached.length >= 80) {
      importResult = await runHirelyImportFromText(cached, {
        source: `${entry.id}-ocr-cache`,
        extractionMethod: 'pdf-ocr',
        file: { name: path.basename(pdfPath), type: 'application/pdf', size: buf.length },
      });
      importResult.warnings = [...(importResult.warnings || []), 'Node PDF.js unavailable — used OCR cache text'];
      return {
        importResult,
        fileName: `${path.basename(pdfPath)} (OCR cache fallback)`,
        mode: 'pdf-binary+ocr-cache',
      };
    }
  }

  return { importResult, fileName: path.basename(pdfPath), mode: 'pdf-binary' };
}

async function runFixture(entry) {
  try {
    if (entry.pdfCandidates) {
      const pdfPath = resolveOptionalPdf(entry);
      if (!pdfPath) {
        return {
          entry,
          skipped: true,
          skipReason: 'PDF not on disk (optional fixture)',
        };
      }
      const ran = await runPdfFixture(entry, pdfPath);
      return { entry, skipped: false, ...ran };
    }
    const ran = await runTextFixture(entry);
    return { entry, skipped: false, ...ran };
  } catch (err) {
    return {
      entry,
      skipped: false,
      error: String(err?.message || err),
      importResult: null,
      fileName: entry.id,
      mode: 'error',
    };
  }
}

function buildRow(result) {
  const { entry, skipped, skipReason, error, importResult, fileName, mode } = result;
  if (skipped) {
    return {
      id: entry.id,
      label: entry.label,
      archetype: entry.archetype,
      format: entry.format,
      fileName: '(skipped)',
      mode: 'skipped',
      status: 'SKIP',
      importSuccess: false,
      metrics: null,
      reasons: [skipReason],
      importStatus: '',
    };
  }

  if (error || !importResult) {
    return {
      id: entry.id,
      label: entry.label,
      archetype: entry.archetype,
      format: entry.format,
      fileName,
      mode,
      status: 'FAIL',
      importSuccess: false,
      metrics: null,
      reasons: [error || 'import threw'],
      importStatus: '',
    };
  }

  const sanitized = sanitizeResumeForDisplay(importResult.resumeData);
  const cv = resumeDataToCvData(sanitized);
  const metrics = extractStressMetrics(sanitized, cv);
  const grade = gradeStressFixture(importResult, metrics);

  return {
    id: entry.id,
    label: entry.label,
    archetype: entry.archetype,
    format: entry.format,
    fileName,
    mode,
    status: grade.status,
    importSuccess: grade.importSuccess,
    signalCount: grade.signalCount,
    metrics,
    reasons: grade.reasons,
    importStatus: importResult.importStatus || '',
    errors: (importResult.errors || []).slice(0, 3),
  };
}

function renderMarkdown(rows, meta) {
  const lines = [];
  lines.push('# HIRELY STRESS REPORT');
  lines.push('');
  lines.push(`Generated: ${meta.generatedAt}`);
  lines.push(`Pipeline: production import (\`runHirelyImportFromText\` / \`runHirelyImportFromFile\`)`);
  lines.push(`Fixtures run: **${meta.ran}** (${meta.skipped} skipped optional)`);
  lines.push('');
  lines.push('## Production goal');
  lines.push('');
  lines.push(`**${STRESS_GOAL_IMPORT_SUCCESS_PCT}% successful imports** — import completes with usable structured output (PASS or PARTIAL).`);
  lines.push('');
  lines.push(
    meta.goalMet
      ? `### Goal status: **MET** (${meta.successPct}% success)`
      : `### Goal status: **NOT MET** (${meta.successPct}% success — need ${STRESS_GOAL_IMPORT_SUCCESS_PCT}%)`
  );
  lines.push('');
  lines.push('## Summary');
  lines.push('');
  lines.push('| Verdict | Count |');
  lines.push('|---------|------:|');
  lines.push(`| PASS | ${meta.pass} |`);
  lines.push(`| PARTIAL | ${meta.partial} |`);
  lines.push(`| FAIL | ${meta.fail} |`);
  lines.push(`| SKIP | ${meta.skipped} |`);
  lines.push('');
  lines.push(
    `**Import success rate:** ${meta.successful}/${meta.graded} = **${meta.successPct}%** (PASS + PARTIAL, excluding SKIP)`
  );
  lines.push('');
  lines.push('## By archetype / format');
  lines.push('');
  lines.push('| ID | Archetype | Format | Verdict | Import | Name | Email | Phone | Exp | Edu | Skills | Lang |');
  lines.push('|----|-----------|--------|---------|--------|------|-------|-------|----:|----:|-------:|-----:|');

  for (const r of rows) {
    if (r.status === 'SKIP') {
      lines.push(
        `| ${r.id} | ${r.archetype} | ${r.format} | SKIP | — | — | — | — | — | — | — | — |`
      );
      continue;
    }
    const m = r.metrics;
    lines.push(
      `| ${r.id} | ${r.archetype} | ${r.format} | **${r.status}** | ${r.importSuccess ? '✓' : '✗'} | ${yesNo(m.nameDetected)} | ${yesNo(m.emailDetected)} | ${yesNo(m.phoneDetected)} | ${m.experienceCount} | ${m.educationCount} | ${m.skillsCount} | ${m.languagesCount} |`
    );
  }

  lines.push('');
  lines.push('## Per-fixture detail');
  lines.push('');

  for (const r of rows) {
    lines.push(`### ${r.label} (\`${r.id}\`)`);
    lines.push('');
    lines.push(`- **Verdict:** ${statusIcon(r.status)}`);
    lines.push(`- **Archetype:** ${r.archetype}`);
    lines.push(`- **Format:** ${r.format}`);
    lines.push(`- **File:** \`${r.fileName}\``);
    if (r.status === 'SKIP') {
      lines.push(`- **Note:** ${r.reasons[0]}`);
      lines.push('');
      continue;
    }
    lines.push(`- **Import status:** \`${r.importStatus || 'n/a'}\``);
    if (r.errors?.length) lines.push(`- **Errors:** ${r.errors.join('; ')}`);
    const m = r.metrics;
    lines.push(`- **Name:** ${m.name || '—'} (${m.nameDetected ? 'detected' : 'missing'})`);
    lines.push(`- **Email:** ${m.email || '—'} (${m.emailDetected ? 'detected' : 'missing'})`);
    lines.push(`- **Phone:** ${m.phone || '—'} (${m.phoneDetected ? 'detected' : 'missing'})`);
    lines.push(`- **Experience count:** ${m.experienceCount}`);
    lines.push(`- **Education count:** ${m.educationCount}`);
    lines.push(`- **Skills count:** ${m.skillsCount}`);
    lines.push(`- **Languages count:** ${m.languagesCount}`);
    if (r.reasons?.length) lines.push(`- **Notes:** ${r.reasons.join('; ')}`);
    lines.push('');
  }

  lines.push('## Coverage matrix');
  lines.push('');
  lines.push('| Requirement | Fixtures |');
  lines.push('|-------------|----------|');
  lines.push('| Designer CV | creative-cv, yoaz-cv, mvp-sample, yoaz-pdf-live |');
  lines.push('| Developer CV | developer-cv |');
  lines.push('| Marketing CV | marketing-cv |');
  lines.push('| Recruiter CV | recruiter-cv |');
  lines.push('| Consultant CV | consultant-cv |');
  lines.push('| Scanned PDF | scanned-pdf |');
  lines.push('| Native PDF | text-pdf, two-column-cv, yoaz-pdf-live |');
  lines.push('| DOCX | docx |');
  lines.push('| TXT | all paste fixtures + mvp-sample |');
  lines.push('');
  lines.push('## Run');
  lines.push('');
  lines.push('```bash');
  lines.push('npm run stress:hirely');
  lines.push('```');
  lines.push('');

  return lines.join('\n');
}

async function main() {
  const results = [];
  for (const entry of STRESS_FIXTURES) {
    process.stderr.write(`[stress] ${entry.id}…\n`);
    const raw = await runFixture(entry);
    results.push(buildRow(raw));
  }

  const graded = results.filter((r) => r.status !== 'SKIP');
  const skipped = results.filter((r) => r.status === 'SKIP').length;
  const pass = graded.filter((r) => r.status === 'PASS').length;
  const partial = graded.filter((r) => r.status === 'PARTIAL').length;
  const fail = graded.filter((r) => r.status === 'FAIL').length;
  const successful = pass + partial;
  const successPct = graded.length ? Math.round((successful / graded.length) * 1000) / 10 : 0;
  const goalMet = successPct >= STRESS_GOAL_IMPORT_SUCCESS_PCT;

  const md = renderMarkdown(results, {
    generatedAt: new Date().toISOString(),
    ran: results.length,
    skipped,
    graded: graded.length,
    pass,
    partial,
    fail,
    successful,
    successPct,
    goalMet,
  });

  fs.writeFileSync(OUT_PATH, md);

  console.log(`\nHIRELY STRESS — ${goalMet ? 'GOAL MET' : 'GOAL MISSED'} (${successPct}% import success)`);
  console.log(`PASS ${pass} · PARTIAL ${partial} · FAIL ${fail} · SKIP ${skipped}`);
  console.log(`Report: ${OUT_PATH}`);

  for (const r of results) {
    if (r.status === 'SKIP') continue;
    const m = r.metrics;
    console.log(
      `  ${statusIcon(r.status).padEnd(12)} ${r.id.padEnd(16)} exp=${m.experienceCount} edu=${m.educationCount} name=${m.nameDetected ? 'Y' : 'N'}`
    );
  }

  process.exit(goalMet ? 0 : 1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
