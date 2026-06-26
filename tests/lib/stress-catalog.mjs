/**
 * Production stress catalog — real CV archetypes × document formats.
 */

import fs from 'fs';
import path from 'path';

export const STRESS_GOAL_IMPORT_SUCCESS_PCT = 95;

export const STRESS_FIXTURES = [
  {
    id: 'creative-cv',
    label: 'Designer CV (creative paste)',
    archetype: 'designer',
    format: 'TXT',
    manifestId: 'creative-cv',
    extractionMethod: 'paste',
  },
  {
    id: 'yoaz-cv',
    label: 'Designer CV (Yoaz clean paste)',
    archetype: 'designer',
    format: 'TXT',
    manifestId: 'yoaz-cv',
    extractionMethod: 'paste',
  },
  {
    id: 'developer-cv',
    label: 'Developer CV',
    archetype: 'developer',
    format: 'TXT',
    manifestId: 'developer-cv',
    extractionMethod: 'paste',
  },
  {
    id: 'marketing-cv',
    label: 'Marketing CV',
    archetype: 'marketing',
    format: 'TXT',
    manifestId: 'marketing-cv',
    extractionMethod: 'paste',
  },
  {
    id: 'recruiter-cv',
    label: 'Recruiter CV',
    archetype: 'recruiter',
    format: 'TXT',
    manifestId: 'recruiter-cv',
    extractionMethod: 'paste',
  },
  {
    id: 'consultant-cv',
    label: 'Consultant CV',
    archetype: 'consultant',
    format: 'TXT',
    manifestId: 'consultant-cv',
    extractionMethod: 'paste',
  },
  {
    id: 'text-pdf',
    label: 'Native PDF (selectable text)',
    archetype: 'product',
    format: 'PDF-native',
    manifestId: 'text-pdf',
    extractionMethod: 'pdf-text',
  },
  {
    id: 'scanned-pdf',
    label: 'Scanned PDF (OCR text)',
    archetype: 'product',
    format: 'PDF-scanned',
    manifestId: 'scanned-pdf',
    extractionMethod: 'pdf-ocr',
  },
  {
    id: 'docx',
    label: 'DOCX export',
    archetype: 'product',
    format: 'DOCX',
    manifestId: 'docx',
    extractionMethod: 'docx',
  },
  {
    id: 'two-column-cv',
    label: 'Two-column PDF layout',
    archetype: 'layout',
    format: 'PDF-native',
    manifestId: 'two-column-cv',
    extractionMethod: 'pdf-text',
  },
  {
    id: 'mvp-sample',
    label: 'Plain TXT (MVP sample)',
    archetype: 'designer',
    format: 'TXT',
    file: 'tests/fixtures/mvp-sample.txt',
    extractionMethod: 'paste',
  },
  {
    id: 'yoaz-pdf-live',
    label: 'Yoaz PDF (live binary)',
    archetype: 'designer',
    format: 'PDF-native',
    optional: true,
    pdfCandidates: [
      process.env.HIRELY_YOAZ_PDF,
      '/Users/yohannazancot/Documents/cv/cv2022 yohann azancot copie.pdf',
      '/Users/yohannazancot/Documents/yohann azancot cv 2024.pdf',
    ],
    extractionMethod: 'pdf',
  },
];

const NAME_PLACEHOLDERS = new Set([
  'nom à confirmer',
  'name to confirm',
  'nom à compléter',
  'poste à compléter',
]);

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/i;

export function arrLen(v) {
  return Array.isArray(v) ? v.filter(Boolean).length : 0;
}

export function hasRealName(name) {
  const n = String(name || '').trim();
  if (!n || NAME_PLACEHOLDERS.has(n.toLowerCase())) return false;
  if (n.includes(' · ')) return false;
  return n.split(/\s+/).filter(Boolean).length >= 2;
}

export function hasEmail(email) {
  return EMAIL_RE.test(String(email || '').trim());
}

export function hasPhone(phone) {
  const digits = String(phone || '').replace(/\D/g, '');
  return digits.length >= 8 && digits.length <= 15;
}

/**
 * @param {object} rd resumeData (sanitized)
 * @param {object} cv cvData
 */
export function extractStressMetrics(rd, cv) {
  const identity = rd?.identity || {};
  return {
    name: String(identity.name || cv?.name || '').trim(),
    nameDetected: hasRealName(identity.name || cv?.name),
    email: String(identity.email || cv?.email || '').trim(),
    emailDetected: hasEmail(identity.email || cv?.email),
    phone: String(identity.phone || cv?.phone || '').trim(),
    phoneDetected: hasPhone(identity.phone || cv?.phone),
    experienceCount: Math.max(arrLen(rd?.experiences), arrLen(cv?.experience)),
    educationCount: Math.max(arrLen(rd?.education), arrLen(cv?.education)),
    skillsCount: Math.max(arrLen(rd?.skills), arrLen(cv?.skills)),
    languagesCount: Math.max(arrLen(rd?.languages), arrLen(cv?.languages)),
  };
}

/**
 * @param {object} importResult
 * @param {ReturnType<typeof extractStressMetrics>} metrics
 */
export function gradeStressFixture(importResult, metrics) {
  const reasons = [];
  const errors = importResult?.errors || [];
  const importStatus = String(importResult?.importStatus || '');
  const hasBody =
    metrics.experienceCount >= 1 ||
    metrics.educationCount >= 1 ||
    metrics.skillsCount >= 1;

  const importBlocked =
    !importResult?.resumeData ||
    errors.includes('RAW_TEXT_EMPTY') ||
    errors.includes('TEXT_EMPTY') ||
    (errors.length > 0 && !hasBody) ||
    importStatus === 'PASTE_FALLBACK_REQUIRED' ||
    importStatus === 'PDF_TEXT_EMPTY';

  if (importBlocked) {
    if (errors.length) reasons.push(...errors.slice(0, 3));
    else reasons.push(`import blocked (${importStatus || 'no status'})`);
    return { status: 'FAIL', reasons, importSuccess: false };
  }

  const signals = [
    metrics.nameDetected,
    metrics.emailDetected,
    metrics.phoneDetected,
    metrics.experienceCount >= 1,
    metrics.educationCount >= 1,
    metrics.skillsCount >= 1,
    metrics.languagesCount >= 1,
  ];
  const signalCount = signals.filter(Boolean).length;

  if (metrics.nameDetected && metrics.experienceCount >= 1 && signalCount >= 5) {
    return { status: 'PASS', reasons: [], importSuccess: true, signalCount };
  }

  if (hasBody && (metrics.nameDetected || metrics.emailDetected) && signalCount >= 3) {
    reasons.push(`${signalCount}/7 detection signals`);
    if (!metrics.nameDetected) reasons.push('name missing or uncertain');
    if (metrics.experienceCount < 1) reasons.push('no experience');
    return { status: 'PARTIAL', reasons, importSuccess: true, signalCount };
  }

  reasons.push('insufficient structured output');
  if (!metrics.nameDetected) reasons.push('name not detected');
  if (metrics.experienceCount < 1) reasons.push('experience not detected');
  return { status: 'FAIL', reasons, importSuccess: false, signalCount };
}

export function resolveFixtureText(root, entry) {
  if (entry.file) {
    const fp = path.join(root, entry.file);
    if (!fs.existsSync(fp)) throw new Error(`Missing fixture file: ${entry.file}`);
    return { rawText: fs.readFileSync(fp, 'utf8'), fileName: path.basename(fp) };
  }
  const dir = path.join(root, 'tests/fixtures', entry.manifestId);
  const fp = path.join(dir, 'fixture.txt');
  if (!fs.existsSync(fp)) throw new Error(`Missing ${entry.manifestId}/fixture.txt`);
  return { rawText: fs.readFileSync(fp, 'utf8'), fileName: `${entry.manifestId}/fixture.txt` };
}

export function resolveOptionalPdf(entry) {
  for (const p of entry.pdfCandidates || []) {
    if (p && fs.existsSync(p)) return p;
  }
  return null;
}

export function makePdfFile(buf, name) {
  if (typeof File !== 'undefined') {
    return new File([buf], name, { type: 'application/pdf' });
  }
  return {
    name,
    type: 'application/pdf',
    size: buf.length,
    arrayBuffer: async () =>
      buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength),
  };
}
