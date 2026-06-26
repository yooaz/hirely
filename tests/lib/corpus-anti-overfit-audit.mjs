/**
 * Corpus anti-overfitting audit — production code must not branch on fixture identity.
 */
import fs from 'fs';
import path from 'path';
import { nameFromFileName } from '../../src/core/parsing/cv-parse-confidence.js';

export const ANTI_OVERFIT_AUDIT_V1 = 'ANTI_OVERFIT_AUDIT_V1';

/** Patterns forbidden in production parsing/extraction code (non-comment lines). */
export const FORBIDDEN_PRODUCTION_PATTERNS = Object.freeze([
  { id: 'yoaz_identity_branch', re: /\byohann\s+azancot\b/i, scope: 'hardcoded_identity' },
  { id: 'yoaz_filename_branch', re: /['"`][^'"`]*yoaz[^'"`]*['"`]\s*\.(?:includes|match|test)/i, scope: 'filename_branch' },
  { id: 'cv2022_filename_branch', re: /cv2022/i, scope: 'filename_branch' },
  { id: 'lisaa_date_rewrite', re: /dates\s*=\s*['"][^'"]*['"].*lisaa/i, scope: 'school_hardcode' },
  { id: 'creapole_date_rewrite', re: /dates\s*=\s*['"][^'"]*['"].*cr[ée]apole/i, scope: 'school_hardcode' },
  { id: 'mccann_agency_rewrite', re: /McCann G\. Agency/, scope: 'employer_hardcode' },
  { id: 'nike_projects_default', re: /['"]Nike projects['"]/, scope: 'client_hardcode' },
  { id: 'project_anchor_injection', re: /PROJECT_ANCHOR_TARGETS\.find/, scope: 'layout_hack' },
]);

/** Allowed in validation guard modules only (prevents demo leak, not parser tuning). */
export const GUARD_MODULE_ALLOWLIST = new Set([
  'src/core/validation/yoaz-bias-guard.js',
  'src/core/display/undetected-label.js',
]);

const PRODUCTION_SCAN_DIRS = ['src/core/parsing', 'src/core/pipeline', 'src/core/extraction', 'src/core/import'];

function isCommentOnlyLine(line) {
  const t = String(line || '').trim();
  return !t || t.startsWith('//') || t.startsWith('*') || t.startsWith('/*');
}

function walk(dir, fn) {
  if (!fs.existsSync(dir)) return;
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const p = path.join(dir, entry.name);
    if (entry.isDirectory()) walk(p, fn);
    else fn(p);
  }
}

/**
 * Generic filename → name recovery must work without person-specific branches.
 */
export function auditFilenameNameRecovery() {
  const cases = [
    { fileName: 'cv2022 yohann azancot copie.pdf', expectContains: ['Yohann', 'Azancot'] },
    { fileName: 'marie-dupont-cv-final.pdf', expectContains: ['Marie', 'Dupont'] },
    { fileName: 'alex_chen_resume_2024.pdf', expectContains: ['Alex', 'Chen'] },
    { fileName: 'sophie-martin-consultant.pdf', expectContains: ['Sophie', 'Martin'] },
    { fileName: 'developer-cv.pdf', expectContains: [] },
  ];

  const results = cases.map(({ fileName, expectContains }) => {
    const name = nameFromFileName(fileName);
    const pass = expectContains.every((part) =>
      String(name || '').toLowerCase().includes(part.toLowerCase())
    );
    return { fileName, name, expectContains, pass };
  });

  return {
    pass: results.every((r) => r.pass),
    results,
  };
}

/**
 * @param {string} rootDir
 */
export function auditProductionOverfitMarkers(rootDir) {
  const hits = [];

  for (const rule of FORBIDDEN_PRODUCTION_PATTERNS) {
    const files = [];
    for (const relDir of PRODUCTION_SCAN_DIRS) {
      walk(path.join(rootDir, relDir), (file) => {
        if (!file.endsWith('.js')) return;
        const rel = path.relative(rootDir, file).replace(/\\/g, '/');
        if (GUARD_MODULE_ALLOWLIST.has(rel)) return;
        const lines = fs.readFileSync(file, 'utf8').split(/\r?\n/);
        const matchingLines = lines.filter((line) => !isCommentOnlyLine(line) && rule.re.test(line));
        if (matchingLines.length) files.push({ file: rel, matches: matchingLines.length });
      });
    }
    if (files.length) hits.push({ marker: rule.id, scope: rule.scope, files });
  }

  return {
    pass: hits.length === 0,
    hits,
  };
}

/**
 * @param {string} rootDir
 */
export function runAntiOverfitAudit(rootDir) {
  const production = auditProductionOverfitMarkers(rootDir);
  const filenameRecovery = auditFilenameNameRecovery();

  return {
    version: ANTI_OVERFIT_AUDIT_V1,
    pass: production.pass && filenameRecovery.pass,
    production,
    filenameRecovery,
  };
}
