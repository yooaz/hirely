/**
 * Hirely Test Lab — 50 CV unified test suite runner.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { runHirelyImportFromText } from '../../core/pipeline/hirely-import.js';
import { resolveFixtureText } from '../../../tests/lib/stress-catalog.mjs';
import { simulateOcrScan } from '../../../tests/lib/h8-ocr-simulate.mjs';
import { applyHellLayout } from '../../../tests/lib/p5-cv-hell-layouts.mjs';
import { applyLocaleHeaders } from '../../../tests/lib/hirely-test-lab-locale.mjs';
import {
  HIRELY_TEST_LAB_CATALOG,
  HIRELY_TEST_LAB_COUNT,
  HIRELY_TEST_LAB_ENGINE,
  TEST_LAB_GOALS,
} from '../../../tests/lib/hirely-test-lab-catalog.mjs';
import {
  computeTestLabMetrics,
  aggregateTestLabResults,
} from '../../../tests/lib/hirely-test-lab-metrics.mjs';
import { runLinkedInImportMerge } from '../../core/import/linkedin-import-engine.js';
import {
  parseLinkedInExportText,
  resumeDataFromLinkedInExport,
} from '../../core/import/linkedin-export-parser.js';
import { buildFinalResumeData } from '../../core/validation/final-resume-contract.js';
import { resumeDataToCvData } from '../../core/resume-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../../..');
const OUT_DIR = path.join(ROOT, 'tests/output/hirely-test-lab');
export const TEST_LAB_REPORT_JSON = path.join(OUT_DIR, 'report.json');

/**
 * @param {import('../../../tests/lib/hirely-test-lab-catalog.mjs').TestLabFixture} entry
 */
async function resolveImportForEntry(entry, canonical) {
  if (entry.sourceType === 'linkedin-merge') {
    const resumeImport = await runHirelyImportFromText(canonical, {
      source: entry.id,
      extractionMethod: 'paste',
      trusted: true,
    });
    const linkedinPdf = await runHirelyImportFromText(
      applyHellLayout(canonical, 'linkedin'),
      { source: `${entry.id}-li`, extractionMethod: 'linkedin-pdf', trusted: true }
    );
    const merged = runLinkedInImportMerge([
      { fileName: 'resume.pdf', resumeData: resumeImport.resumeData, rawText: canonical },
      { fileName: 'linkedin.pdf', resumeData: linkedinPdf.resumeData, rawText: linkedinPdf.cleanedText },
    ]);
    const built = buildFinalResumeData(merged.resumeData, { silent: true });
    return {
      rawText: canonical,
      cleanedText: canonical,
      structuredResume: resumeImport.structuredResume,
      resumeData: merged.resumeData,
      finalResumeData: built.finalResumeData,
      templateData: resumeDataToCvData(merged.resumeData),
      errors: [],
      warnings: ['LINKEDIN_MERGE'],
      reviewQueue: resumeImport.reviewQueue || [],
      linkedinMerge: merged.report,
    };
  }

  if (entry.sourceType === 'linkedin-export' && entry.linkedinExport) {
    const profileParsed = parseLinkedInExportText(entry.linkedinExport.profile);
    const positionsParsed = parseLinkedInExportText(entry.linkedinExport.positions);
    const skillsParsed = parseLinkedInExportText(entry.linkedinExport.skills);
    const rd = resumeDataFromLinkedInExport({
      profile: profileParsed?.profile,
      positions: positionsParsed?.positions || [],
      skills: skillsParsed?.skills || [],
      education: [],
      languages: [],
    });
    const built = buildFinalResumeData(rd, { silent: true });
    return {
      rawText: entry.linkedinExport.profile,
      cleanedText: entry.linkedinExport.profile,
      resumeData: rd,
      finalResumeData: built.finalResumeData,
      templateData: resumeDataToCvData(rd),
      errors: [],
      warnings: [],
      reviewQueue: [],
    };
  }

  let importText = canonical;
  if (entry.language && entry.language !== 'en') {
    importText = applyLocaleHeaders(importText, entry.language);
  }
  if (entry.linkedinText) {
    importText = entry.linkedinText;
  } else if (entry.layout && entry.layout !== 'word') {
    importText = applyHellLayout(importText, entry.layout);
  }
  if (entry.simulateOcr) {
    importText = simulateOcrScan(importText, entry.ocrSeed ?? 1);
  }

  return runHirelyImportFromText(importText, {
    source: entry.id,
    extractionMethod: entry.extractionMethod || 'paste',
    file: {
      name: `${entry.id}.${entry.format === 'DOCX' ? 'docx' : 'txt'}`,
      type: 'text/plain',
      size: importText.length,
    },
    trusted: true,
  });
}

/**
 * @param {{ fixtures?: typeof HIRELY_TEST_LAB_CATALOG, onProgress?: (i: number, total: number, id: string) => void }} [opts]
 */
export async function runHirelyTestLab(opts = {}) {
  const fixtures = opts.fixtures || HIRELY_TEST_LAB_CATALOG;
  fs.mkdirSync(OUT_DIR, { recursive: true });

  /** @type {ReturnType<typeof computeTestLabMetrics>[]} */
  const rows = [];

  for (let i = 0; i < fixtures.length; i++) {
    const entry = fixtures[i];
    opts.onProgress?.(i + 1, fixtures.length, entry.id);

    const resolveEntry = {
      ...entry,
      manifestId: entry.manifestId || entry.fixtureKey || entry.id,
    };

    let canonical = '';
    try {
      if (entry.linkedinText) {
        canonical = entry.linkedinText;
      } else {
        const resolved = resolveFixtureText(ROOT, resolveEntry);
        canonical = resolved.rawText;
      }
    } catch (err) {
      rows.push({
        id: entry.id,
        label: entry.label,
        role: entry.role,
        country: entry.country,
        language: entry.language,
        category: entry.category,
        layout: entry.layout,
        format: entry.format,
        sourceType: entry.sourceType,
        templateId: entry.templateId,
        extractionMethod: entry.extractionMethod,
        importSuccess: false,
        extractionAccuracy: 0,
        templateQuality: 0,
        atsScoreAccuracy: 0,
        pdfQuality: 0,
        errors: [String(err?.message || 'FIXTURE_RESOLVE_FAILED')],
        warnings: 0,
      });
      continue;
    }

    try {
      const importResult = await resolveImportForEntry(entry, canonical);
      rows.push(computeTestLabMetrics(entry, canonical, importResult));
    } catch (err) {
      rows.push({
        id: entry.id,
        label: entry.label,
        role: entry.role,
        country: entry.country,
        language: entry.language,
        category: entry.category,
        layout: entry.layout,
        format: entry.format,
        sourceType: entry.sourceType,
        templateId: entry.templateId,
        extractionMethod: entry.extractionMethod,
        importSuccess: false,
        extractionAccuracy: 0,
        templateQuality: 0,
        atsScoreAccuracy: 0,
        pdfQuality: 0,
        errors: [String(err?.message || 'IMPORT_FAILED')],
        warnings: 0,
      });
    }
  }

  const summary = aggregateTestLabResults(rows);
  const goalsMet = {
    extractionAccuracy: summary.extractionAccuracy >= TEST_LAB_GOALS.extractionAccuracy,
    templateQuality: summary.templateQuality >= TEST_LAB_GOALS.templateQuality,
    atsScoreAccuracy: summary.atsScoreAccuracy >= TEST_LAB_GOALS.atsScoreAccuracy,
    pdfQuality: summary.pdfQuality >= TEST_LAB_GOALS.pdfQuality,
    importSuccess: summary.importSuccessRate >= TEST_LAB_GOALS.importSuccess,
  };

  const report = {
    engine: HIRELY_TEST_LAB_ENGINE,
    generatedAt: new Date().toISOString(),
    count: fixtures.length,
    goals: TEST_LAB_GOALS,
    goalsMet,
    pass: Object.values(goalsMet).every(Boolean),
    summary,
    results: rows,
  };

  fs.writeFileSync(TEST_LAB_REPORT_JSON, JSON.stringify(report, null, 2));
  return report;
}

export { HIRELY_TEST_LAB_COUNT, TEST_LAB_GOALS };
