/**
 * Hirely Test Matrix — import · review · template · export per fixture.
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { bootstrapNodeExtractors } from './node-extractor-bootstrap.mjs';
import { rewriteImportFromFile } from '../../src/core/import/file-import-rewrite.js';
import { createResumeFromText } from '../../src/core/import/text-first-engine.js';
import { resumeDataToCvData } from '../../src/core/resume-data.js';
import { IMPORT_STATE } from '../../src/core/import/import-state.js';
import { resumeObjectExists } from '../../src/core/validation/review-screen-guarantee.js';
import { applyReviewGuaranteeToValidation } from '../../src/core/validation/review-screen-guarantee.js';
import { validateCvData } from '../../src/core/validation/cv-data-protection.js';
import { buildTemplateInputFromResume } from '../../src/ui/templates/template-isolation.js';
import { canExportWithResume, validateExportResumeOnly } from '../../src/core/export/export-rewrite.js';
import { PRODUCTION_TEMPLATE_IDS } from '../../src/ui/templates/production-template-ids.mjs';
import { fileFromPath } from './format-support-fixtures.mjs';
import {
  HIRELY_TEST_MATRIX_FIXTURES,
  HIRELY_TEST_MATRIX_DIR,
  ensureHirelyTestMatrixFixtures,
} from './hirely-test-matrix-fixtures.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '../..');
export const TEST_MATRIX_REPORT_JSON = path.join(ROOT, 'tests/output/hirely-test-matrix/report.json');

function esc(s) {
  return String(s || '').replace(/[&<>"']/g, (m) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
  );
}

function loadTemplateRenderer() {
  const code = fs.readFileSync(path.join(ROOT, 'src/ui/templates/cv-templates.js'), 'utf8');
  const sandbox = { console, globalThis: {} };
  sandbox.window = sandbox;
  sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  sandbox.initHirelyTemplates({
    esc,
    sectionLabel: (k) => k,
    cvBlock: (title, html) =>
      html ? `<section class="cvSection"><h3>${title}</h3>${html}</section>` : '',
    cvSkillsHtml: (skills) => `<p>${skills.map(esc).join(' · ')}</p>`,
    getPhotoHtml: () => '',
  });
  return sandbox.HirelyTemplates;
}

/**
 * @param {import('./hirely-test-matrix-fixtures.mjs').TestMatrixFixture} entry
 * @param {string} fixturePath
 * @param {string} pastePath
 */
async function runImportStage(entry, fixturePath, pastePath) {
  const t0 = Date.now();
  try {
    if (entry.mode === 'paste') {
      const text = fs.readFileSync(fixturePath, 'utf8');
      const resumeData = createResumeFromText(text);
      return {
        ms: Date.now() - t0,
        importState: IMPORT_STATE.IMPORT_READY,
        resumeData,
        cvData: resumeDataToCvData(resumeData, { skipNormalize: true }),
        errors: [],
        pasteChained: false,
      };
    }

    const file = fileFromPath(fixturePath);
    const ext = path.extname(fixturePath).toLowerCase();
    const timeoutMs = ext === '.docx' || ext === '.doc' ? 15000 : 5000;
    const result = await rewriteImportFromFile(file, { timeoutMs });
    const state = result.importState || result.importStatus || '';
    const needsPaste =
      state === IMPORT_STATE.IMPORT_NEEDS_PASTE ||
      state === 'PASTE_FALLBACK_REQUIRED' ||
      !result.resumeData;

    let resumeData = result.resumeData || null;
    let pasteChained = false;

    if (needsPaste && entry.chainPasteForDownstream) {
      const pasteText = fs.readFileSync(pastePath, 'utf8');
      resumeData = createResumeFromText(pasteText);
      pasteChained = true;
    }

    return {
      ms: Date.now() - t0,
      importState: state,
      resumeData,
      cvData: resumeData ? resumeDataToCvData(resumeData, { skipNormalize: true }) : result.templateData,
      errors: result.errors || [],
      needsPaste,
      pasteChained,
      rawImportSuccess: !needsPaste && !!result.resumeData,
    };
  } catch (err) {
    return {
      ms: Date.now() - t0,
      importState: 'IMPORT_FAILED',
      resumeData: null,
      cvData: null,
      errors: [String(err?.message || err)],
      needsPaste: false,
      pasteChained: false,
    };
  }
}

function runReviewStage(resumeData, cvData) {
  const guarantee = resumeObjectExists(resumeData);
  const validation = applyReviewGuaranteeToValidation(
    validateCvData({
      cvData,
      finalResumeData: resumeData,
      resumeData,
      previewLive: true,
      cvRenderable: true,
    }),
    resumeData
  );
  return {
    pass: guarantee && validation.blockReview === false,
    guarantee,
    blockReview: validation.blockReview,
  };
}

function runTemplateStage(resumeData, tpl) {
  if (!resumeObjectExists(resumeData)) {
    return { pass: false, templateId: null, htmlLength: 0 };
  }
  const input = buildTemplateInputFromResume(resumeData);
  const templateId = PRODUCTION_TEMPLATE_IDS[0] || 'apple-style';
  const html = tpl.render(input, templateId);
  const pass =
    !!html &&
    html.length > 120 &&
    !/cvEmptyState/.test(html) &&
    input._templateIsolation === true;
  return { pass, templateId, htmlLength: html?.length || 0 };
}

function runExportStage(resumeData, cvData) {
  if (!canExportWithResume(resumeData)) {
    return { pass: false, errors: ['NO_RESUME_OBJECT'] };
  }
  const name = String(cvData?.name || resumeData?.identity?.name || 'CV').trim();
  const metrics = {
    className: 'cv cv--live template-apple-style',
    hasEmptyState: false,
    textLength: Math.max(80, name.length * 8),
    widthPx: 794,
    sectionCount: 3,
  };
  const lock = validateExportResumeOnly({ resumeData, cvMetrics: metrics });
  return { pass: lock.ok, errors: lock.errors || [] };
}

function evaluateImportPass(entry, importResult) {
  if (entry.mode === 'paste') {
    return resumeObjectExists(importResult.resumeData);
  }
  if (entry.importExpect === 'needs_paste') {
    return (
      importResult.needsPaste === true &&
      (importResult.importState === IMPORT_STATE.IMPORT_NEEDS_PASTE ||
        importResult.importState === 'PASTE_FALLBACK_REQUIRED' ||
        importResult.errors?.length > 0)
    );
  }
  return importResult.rawImportSuccess === true && resumeObjectExists(importResult.resumeData);
}

/**
 * @param {{ fixtures?: typeof HIRELY_TEST_MATRIX_FIXTURES }} [opts]
 */
export async function runHirelyTestMatrix(opts = {}) {
  await bootstrapNodeExtractors();
  const { dir, paths, pastePath } = await ensureHirelyTestMatrixFixtures(ROOT);
  const fixtures = opts.fixtures || HIRELY_TEST_MATRIX_FIXTURES;
  const tpl = loadTemplateRenderer();
  fs.mkdirSync(path.dirname(TEST_MATRIX_REPORT_JSON), { recursive: true });

  /** @type {object[]} */
  const rows = [];

  for (const entry of fixtures) {
    const fixturePath = paths[entry.id] || path.join(dir, entry.file);
    const importResult = await runImportStage(entry, fixturePath, pastePath);

    const effectiveResume = importResult.resumeData;
    const effectiveCv = importResult.cvData;

    const importPass = evaluateImportPass(entry, importResult);
    const review = runReviewStage(effectiveResume, effectiveCv);
    const template = runTemplateStage(effectiveResume, tpl);
    const exportStage = runExportStage(effectiveResume, effectiveCv);

    const downstreamUsesPaste = importResult.pasteChained === true;

    rows.push({
      id: entry.id,
      file: entry.file,
      label: entry.label,
      notes: entry.notes || '',
      import: {
        pass: importPass,
        ms: importResult.ms,
        state: importResult.importState,
        needsPaste: importResult.needsPaste,
        pasteChained: downstreamUsesPaste,
        errors: importResult.errors,
      },
      review: {
        pass: review.pass,
        guarantee: review.guarantee,
      },
      template: {
        pass: template.pass,
        templateId: template.templateId,
        htmlLength: template.htmlLength,
      },
      export: {
        pass: exportStage.pass,
        errors: exportStage.errors,
      },
      pass: importPass && review.pass && template.pass && exportStage.pass,
    });
  }

  const passCount = rows.filter((r) => r.pass).length;
  const report = {
    engine: 'HIRELY_TEST_MATRIX_V1',
    generatedAt: new Date().toISOString(),
    fixtureDir: HIRELY_TEST_MATRIX_DIR,
    count: rows.length,
    pass: passCount === rows.length,
    summary: {
      passCount,
      failCount: rows.length - passCount,
      importPass: rows.filter((r) => r.import.pass).length,
      reviewPass: rows.filter((r) => r.review.pass).length,
      templatePass: rows.filter((r) => r.template.pass).length,
      exportPass: rows.filter((r) => r.export.pass).length,
    },
    results: rows,
  };

  fs.writeFileSync(TEST_MATRIX_REPORT_JSON, JSON.stringify(report, null, 2));
  return report;
}
