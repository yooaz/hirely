#!/usr/bin/env node
/**
 * HIRELY DATA CONTRACT AUDIT
 * node scripts/data-contract-audit.mjs
 * Output: DATA_CONTRACT_AUDIT.md + stdout PASS/FAIL
 */
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { extractPlainTextEnterprise } from '../src/core/extraction/enterprise-engine.js';
import { runProductionExtractionPipeline } from '../src/core/pipeline/production-pipeline.js';
import { productionToHirelyImportResult } from '../src/core/pipeline/hirely-import.js';
import {
  emptyResumeData,
  normalizeResumeData,
  resumeDataToCvData,
} from '../src/core/resume-data.js';
import { assertTemplateCvFlowLock } from '../src/core/pipeline/hirely-flow-lock.js';
import {
  validateResumeDataContract,
  validateConsumerDataSource,
  REQUIRED_RESUME_DATA_SECTIONS,
  HIRELY_DATA_CONTRACT_VERSION,
} from '../src/core/validation/resume-data-contract.js';
import { computeProductScore } from '../src/core/validation/product-score.js';
import { resolveChecklistProfile } from '../src/core/validation/recruiter-checklist-source.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(__dirname, '..');
const OUT = path.join(ROOT, 'DATA_CONTRACT_AUDIT.md');
const TRACE_PATH = path.join(ROOT, 'TRACE_YOAZ_PIPELINE.json');
const OCR_CACHE = path.join(ROOT, 'tests/output/ocr-quality-yoaz/report.json');
const TEMPLATES_PATH = path.join(ROOT, 'src/ui/templates/cv-templates.js');
const INDEX_PATH = path.join(ROOT, 'index.html');
const ATS_PATH = path.join(ROOT, 'src/core/validation/ats-engine.js');

const checks = [];

function add(name, ok, detail = '') {
  checks.push({ name, ok, detail });
}

function loadHirelyTemplates() {
  const code = fs.readFileSync(TEMPLATES_PATH, 'utf8');
  const sandbox = { global: {}, window: {}, document: undefined, console };
  sandbox.global = sandbox;
  sandbox.window = sandbox;
  vm.runInNewContext(code, sandbox, { filename: 'cv-templates.js' });
  const esc = (s) =>
    String(s || '').replace(/[&<>"']/g, (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
    );
  const sectionLabel = (k) =>
    ({
      experience: 'Expérience',
      education: 'Formation',
      skills: 'Compétences',
      tools: 'Outils',
      languages: 'Langues',
      clients: 'Clients',
    })[k] || k;
  sandbox.initHirelyTemplates({
    esc,
    sectionLabel,
    cvBlock: (t, h) => h || '',
    cvSkillsHtml: (s) => s.join(' · '),
    getPhotoHtml: () => '',
  });
  return sandbox.HirelyTemplates;
}

function staticScanNoRawOcrReads() {
  const index = fs.readFileSync(INDEX_PATH, 'utf8');
  const templates = fs.readFileSync(TEMPLATES_PATH, 'utf8');
  const ats = fs.readFileSync(ATS_PATH, 'utf8');

  const templateRawRead = /state\.(rawText|text|cleanText)|getRawOcr|rawOcrText/.test(templates);
  add('Template file does not reference raw OCR state', !templateRawRead, templateRawRead ? 'cv-templates.js reads raw state' : '');

  const atsRawRead = /\b(state\.rawText|state\.text|rawText\s*[,)]|cleanText\s*[,)])\b/.test(ats);
  add('ATS engine does not read raw OCR state', !atsRawRead, atsRawRead ? 'ats-engine.js references raw state' : '');

  const renderUsesResumeData = /resumeDataToCvData|state\.resumeData/.test(index);
  add('Renderer uses resumeData path', renderUsesResumeData, 'index.html renderCV / commitResumeData');

  const productRawGate = /if\s*\(\s*!DEBUG_MODE\s*\)/.test(index) && /hasRenderableImportTextUi/.test(index);
  add(
    'Product render gated away from DEBUG raw fallback',
    productRawGate,
    productRawGate ? 'DEBUG-only raw path present' : 'Missing DEBUG guard on raw render path'
  );
}

async function yoazResumeDataCheck() {
  let ocrText = '';
  if (fs.existsSync(TRACE_PATH)) {
    ocrText = JSON.parse(fs.readFileSync(TRACE_PATH, 'utf8')).checkpoints?.OCR_OUTPUT?.object?.text || '';
  }
  if (!ocrText && fs.existsSync(OCR_CACHE)) {
    ocrText = JSON.parse(fs.readFileSync(OCR_CACHE, 'utf8')).ocrText || '';
  }
  if (!ocrText) {
    add('Yoaz OCR fixture available', false, 'No TRACE or OCR cache');
    return null;
  }

  const enterprise = extractPlainTextEnterprise(ocrText, 'ocr');
  const pipe = await runProductionExtractionPipeline(ocrText, {
    rawText: ocrText,
    extractionMethod: 'ocr',
    enterpriseExtraction: enterprise,
    canonicalImport: true,
  });
  const imp = productionToHirelyImportResult(pipe, { name: 'yoaz.pdf' });
  return normalizeResumeData(imp.resumeData || emptyResumeData());
}

async function main() {
  add('Contract version defined', HIRELY_DATA_CONTRACT_VERSION === 'data-contract-v1', HIRELY_DATA_CONTRACT_VERSION);
  add(
    'Required sections list complete',
    REQUIRED_RESUME_DATA_SECTIONS.length === 10,
    REQUIRED_RESUME_DATA_SECTIONS.join(', ')
  );

  const empty = emptyResumeData();
  const emptyCheck = validateResumeDataContract(empty, { silent: true });
  add('emptyResumeData has all sections', emptyCheck.missing.length === 0, emptyCheck.missing.join(', ') || 'ok');
  add('emptyResumeData emits empty warnings', emptyCheck.empty.length > 0, `${emptyCheck.empty.length} empty sections`);

  const norm = normalizeResumeData({});
  const normCheck = validateResumeDataContract(norm, { silent: true });
  add('normalizeResumeData guarantees sections', normCheck.missing.length === 0, normCheck.missing.join(', ') || 'ok');

  const yoaz = await yoazResumeDataCheck();
  if (yoaz) {
    const yoazCheck = validateResumeDataContract(yoaz, { silent: true });
    add('Yoaz import: all sections present', yoazCheck.missing.length === 0, JSON.stringify(yoazCheck.sections));
    add('Yoaz import: no raw OCR on resumeData', yoazCheck.forbidden.length === 0, yoazCheck.forbidden.join(', ') || 'ok');
    add('Yoaz import: warnings surfaced', yoazCheck.warnings.length > 0, `${yoazCheck.warnings.length} warnings`);

    const cv = resumeDataToCvData(yoaz);
    const tmplLock = assertTemplateCvFlowLock(cv);
    add('cvData stripped of raw OCR keys', tmplLock.ok, tmplLock.forbidden.join(', ') || 'ok');

    const consumerCheck = validateConsumerDataSource(cv, 'TEMPLATE', { silent: true });
    add('Template consumer guard passes', consumerCheck.ok, consumerCheck.violations.join(', ') || 'ok');

    const profile = resolveChecklistProfile({ resumeData: yoaz, cvData: cv });
    const score = computeProductScore(profile, { resumeData: yoaz });
    const atsInputCheck = validateConsumerDataSource(profile, 'ATS', { silent: true });
    add('ATS reads resumeData-derived profile only', atsInputCheck.ok, atsInputCheck.violations.join(', ') || 'ok');
    add('ATS score computable from contract data', !!score && Number.isFinite(score.total), `score=${score?.total}`);

    const polluted = { ...cv, rawText: 'OCR LEAK' };
    const leakCheck = validateConsumerDataSource(polluted, 'TEMPLATE_TEST', { silent: true });
    add('Consumer guard detects raw OCR leak', !leakCheck.ok, leakCheck.violations.join(', '));

    try {
      const HirelyTemplates = loadHirelyTemplates();
      const html = HirelyTemplates?.render?.(cv, 'ats');
      add('Template render from cvData only', typeof html === 'string' && html.length > 100, `${html?.length || 0} chars`);
    } catch (e) {
      add('Template render from cvData only', false, String(e.message || e));
    }
  }

  staticScanNoRawOcrReads();

  const pass = checks.every((c) => c.ok);
  const md = [
    '# HIRELY DATA CONTRACT AUDIT',
    '',
    `Generated: ${new Date().toISOString()}`,
    `Contract: \`${HIRELY_DATA_CONTRACT_VERSION}\``,
    '',
    `## Result: **${pass ? 'PASS' : 'FAIL'}**`,
    '',
    '| Check | Result | Detail |',
    '|-------|--------|--------|',
    ...checks.map((c) => `| ${c.name} | ${c.ok ? 'PASS' : 'FAIL'} | ${c.detail || '—'} |`),
    '',
    '## Required sections',
    '',
    ...REQUIRED_RESUME_DATA_SECTIONS.map((s) => `- \`${s}\``),
    '',
    '## Rules',
    '',
    '- No renderer may read raw OCR',
    '- No template may read raw OCR',
    '- No ATS may read raw OCR',
    '- Everything must read resumeData (or resumeData-derived cvData)',
    '- Missing/empty sections → warning (never silent)',
    '',
  ].join('\n');

  fs.writeFileSync(OUT, md);
  console.log(pass ? 'PASS' : 'FAIL');
  console.log('Written', OUT);
  if (!pass) {
    console.log('Failed:');
    for (const c of checks.filter((x) => !x.ok)) console.log(' -', c.name, c.detail ? `(${c.detail})` : '');
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  fs.writeFileSync(OUT, `# DATA CONTRACT AUDIT\n\nFAIL\n\n${err.stack || err}\n`);
  process.exit(1);
});
