#!/usr/bin/env node
/**
 * H18 — Zero invented content acceptance checks.
 */
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import {
  UNDETECTED_INFORMATION_LABEL,
  auditResumeDataForInventedContent,
  isUncertainIdentityName,
  isUncertainIdentityTitle,
} from '../core/display/undetected-label.js';
import { NAME_UNCERTAIN_LABEL, TITLE_UNCERTAIN_LABEL } from '../core/parsing/parser-recovery.js';
import { buildFinalResumeData } from '../core/validation/final-resume-contract.js';
import { sanitizeIdentity } from '../core/resume-data.js';
import { emptyResumeData } from '../core/resume-data.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');
const outDir = path.join(root, 'tests/output/h18-zero-invented-content');
fs.mkdirSync(outDir, { recursive: true });

const checks = [];
const auditedSymbols = [
  'fallbackTitle',
  'fallbackName',
  'fallbackSummary',
  'demoData',
  'placeholderIdentity',
  'sampleResume',
];

function check(name, ok, detail = '') {
  checks.push({ name, ok, detail });
  console.log(`${ok ? 'PASS' : 'FAIL'} ${name}${detail ? ` — ${detail}` : ''}`);
}

function read(rel) {
  return fs.readFileSync(path.join(root, rel), 'utf8');
}

// Canonical label
check('undetected label is French product copy', UNDETECTED_INFORMATION_LABEL === 'Information non détectée');
check('parser recovery maps uncertain name label', NAME_UNCERTAIN_LABEL === 'Nom à confirmer');
check('title uncertain maps to undetected', TITLE_UNCERTAIN_LABEL === UNDETECTED_INFORMATION_LABEL);

// sanitizeIdentity — store empty, not fabricated identity
{
  const id = sanitizeIdentity({ name: '###', title: 'reading nature music' });
  check('invalid name stored empty', id.name === '');
  check('invalid title stored empty', id.title === '');
  check('empty name is uncertain', isUncertainIdentityName(''));
  check('empty title is uncertain', isUncertainIdentityTitle(''));
}

// ensurePartialExportProfile removed fabrication via buildFinalResumeData
{
  const rd = emptyResumeData();
  rd.identity = { name: '', title: '', email: '', phone: '', location: '', website: '', linkedin: '' };
  rd.skills = ['Figma', 'Branding'];
  rd.clients = ['Acme'];
  const built = buildFinalResumeData(rd, { silent: true });
  const fr = built.finalResumeData;
  check('no fabricated summary', !String(fr?.summary || '').trim());
  check('no fabricated experience', !(fr?.experiences || []).length);
  const violations = auditResumeDataForInventedContent(built.finalResumeData || rd);
  check('no fabricated export profile violations', violations.length === 0, violations.join('; '));
}

// Static audit — forbidden symbol names
{
  const productFiles = [
    'index.html',
    'src/ui/templates/cv-templates.js',
    'src/core/validation/final-resume-contract.js',
    'src/core/resume-data.js',
    'src/core/parsing/safe-fallback.js',
  ];
  const hits = [];
  for (const sym of auditedSymbols) {
    for (const file of productFiles) {
      const src = read(file);
      if (src.includes(sym)) hits.push(`${sym} in ${file}`);
    }
  }
  check('no fallbackTitle/fallbackName/demoData symbols in product layer', hits.length === 0, hits.join(', '));
}

// index.html — OCR failure must not inject identity
{
  const html = read('index.html');
  check('index defines undetected label', html.includes("const UNDETECTED_INFORMATION_LABEL='Information non"));
  check('index removed OCR_FAILURE_NAME constant', !html.includes('OCR_FAILURE_NAME'));
  check('renderOcrFailureCleanPreview clears identity', /rd\.identity\.name=''/.test(html));
}

// cv-templates — gallery mini CV must not use demo identity
{
  const tpl = read('src/ui/templates/cv-templates.js');
  const mini = tpl.match(/const MINI_CV = \{[\s\S]*?\n    \};/)?.[0] || '';
  check('MINI_CV has no Alex Martin', !/Alex Martin/i.test(mini));
  check(
    'MINI_CV uses undetected label',
    mini.includes(UNDETECTED_INFORMATION_LABEL) || /UNDETECTED_LABEL/.test(mini)
  );
  check('template placeholders use undetected label', tpl.includes("const UNDETECTED_LABEL = 'Information non détectée'"));
}

// ensureExportableCv — no name without raw text (safe-fallback)
{
  const { ensureExportableCv } = await import('../core/parsing/safe-fallback.js');
  const empty = ensureExportableCv({ name: '', title: '', experience: [] }, {});
  check('empty exportable cv has no invented name', !empty.name);
  check('empty exportable cv has no toClassify without raw', !(empty.toClassify || []).length);
}

const pass = checks.every((c) => c.ok);
const report = {
  pass,
  verdict: pass ? 'PASS' : 'FAIL',
  auditedSymbols,
  undetectedLabel: UNDETECTED_INFORMATION_LABEL,
  checks,
  auditedAt: new Date().toISOString(),
};

fs.writeFileSync(path.join(outDir, 'report.json'), JSON.stringify(report, null, 2));
console.log(`\nH18 zero invented content: ${pass ? 'PASS' : 'FAIL'} (${checks.filter((c) => c.ok).length}/${checks.length})`);
process.exit(pass ? 0 : 1);
