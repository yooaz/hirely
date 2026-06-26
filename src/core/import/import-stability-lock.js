/**
 * IMPORT_STABILITY_LOCK — template work blocked until import gates pass.
 */

import fs from 'fs';
import path from 'path';

export const IMPORT_STABILITY_LOCK_VERSION = 'IMPORT_STABILITY_LOCK_V1';

/** @type {{ id: string, reportFile: string, qaScript: string }[]} */
export const REQUIRED_IMPORT_STABILITY_REPORTS = [
  {
    id: 'format_support',
    reportFile: 'FORMAT_SUPPORT_AUDIT_REPORT.md',
    qaScript: 'src/tests/qa-format-support-audit.mjs',
  },
  {
    id: 'docx_full_extraction',
    reportFile: 'DOCX_FULL_EXTRACTION_REPORT.md',
    qaScript: 'src/tests/qa-docx-full-extraction.mjs',
  },
  {
    id: 'text_reconstruction_engine',
    reportFile: 'TEXT_RECONSTRUCTION_ENGINE_REPORT.md',
    qaScript: 'src/tests/qa-text-reconstruction-engine.mjs',
  },
  {
    id: 'real_format_qa',
    reportFile: 'REAL_FORMAT_QA_REPORT.md',
    qaScript: 'src/tests/qa-real-format-qa.mjs',
  },
];

/**
 * @param {string} content
 */
export function parseReportPassStatus(content) {
  const m = String(content || '').match(/\*\*Status:\*\*\s*(PASS|FAIL)/i);
  if (!m) return { pass: false, status: 'UNKNOWN' };
  const status = m[1].toUpperCase();
  return { pass: status === 'PASS', status };
}

/**
 * @param {string} root
 * @param {{ id: string, reportFile: string, qaScript: string }} entry
 */
export function assessImportReport(root, entry) {
  const reportPath = path.join(root, entry.reportFile);
  if (!fs.existsSync(reportPath)) {
    return {
      id: entry.id,
      reportFile: entry.reportFile,
      qaScript: entry.qaScript,
      pass: false,
      status: 'MISSING',
      reportPath,
    };
  }
  const content = fs.readFileSync(reportPath, 'utf8');
  const parsed = parseReportPassStatus(content);
  return {
    id: entry.id,
    reportFile: entry.reportFile,
    qaScript: entry.qaScript,
    pass: parsed.pass,
    status: parsed.status,
    reportPath,
  };
}

/**
 * @param {string} [root]
 */
export function assessImportStabilityLock(root = process.cwd()) {
  const reports = REQUIRED_IMPORT_STABILITY_REPORTS.map((entry) =>
    assessImportReport(root, entry)
  );
  const pass = reports.every((r) => r.pass);
  const failed = reports.filter((r) => !r.pass);
  return {
    version: IMPORT_STABILITY_LOCK_VERSION,
    pass,
    templateWorkAllowed: pass,
    reports,
    failed,
    message: pass
      ? 'Import stability proven — template work allowed.'
      : `Template work blocked until import stability reports pass (${failed.map((f) => f.reportFile).join(', ')}).`,
  };
}

/**
 * @param {string} [root]
 */
export function assertImportStabilityForTemplateWork(root = process.cwd()) {
  const lock = assessImportStabilityLock(root);
  if (lock.pass) return lock;
  const detail = lock.failed
    .map((f) => `${f.reportFile}=${f.status}`)
    .join('; ');
  throw new Error(
    `IMPORT_STABILITY_LOCK: template work blocked. Fix import gates first (${detail}). Run: npm run qa:import-stability-lock`
  );
}
