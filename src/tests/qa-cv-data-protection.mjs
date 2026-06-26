#!/usr/bin/env node
/**
 * Unit checks for validateCvData() — VALID | PARTIAL | INVALID
 */
import {
  CV_DATA_STATUS,
  validateCvData,
} from '../core/validation/cv-data-protection.js';

const checks = [];

function pass(id, detail = '') {
  checks.push({ id, ok: true, detail });
  console.log(`PASS ${id}${detail ? ` — ${detail}` : ''}`);
}

function fail(id, detail = '') {
  checks.push({ id, ok: false, detail });
  console.log(`FAIL ${id}${detail ? ` — ${detail}` : ''}`);
}

const richCv = {
  name: 'Alex Brand',
  summary: 'Designer with ten years of experience across brand and product.',
  experience: [{ role: 'Lead Designer', company: 'Studio', bullets: ['Shipped design system'] }],
  skills: ['Figma', 'Illustrator'],
};

const emptyCv = {
  name: '',
  experience: [],
  skills: [],
};

const nameOnlyCv = {
  name: 'Alex Brand',
  experience: [],
  skills: ['Figma'],
};

// INVALID — name missing
{
  const r = validateCvData({
    cvData: emptyCv,
    sectionCounts: { experiences: 0, skills: 0 },
    previewLive: false,
    previewText: '',
    finalResumeValid: false,
    cvRenderable: false,
  });
  r.status === CV_DATA_STATUS.INVALID && r.reasons.includes('name_missing')
    ? pass('invalid_name_missing')
    : fail('invalid_name_missing', JSON.stringify(r));
}

// INVALID — experience missing
{
  const r = validateCvData({
    cvData: nameOnlyCv,
    sectionCounts: { experiences: 0, skills: 1 },
    previewLive: false,
    previewText: 'Alex Brand',
    finalResumeValid: true,
    cvRenderable: true,
  });
  r.status === CV_DATA_STATUS.INVALID && r.reasons.includes('experience_missing')
    ? pass('invalid_experience_missing')
    : fail('invalid_experience_missing', JSON.stringify(r));
}

// INVALID — all sections empty
{
  const r = validateCvData({
    cvData: { name: 'Alex Brand', experience: [], skills: [], summary: '' },
    sectionCounts: { experiences: 0, education: 0, skills: 0, tools: 0 },
    previewLive: false,
    previewText: 'x',
    finalResumeValid: true,
    cvRenderable: false,
  });
  r.status === CV_DATA_STATUS.INVALID &&
  r.reasons.includes('all_sections_empty') &&
  r.reasons.includes('experience_missing')
    ? pass('invalid_all_sections_empty')
    : fail('invalid_all_sections_empty', JSON.stringify(r));
}

// INVALID — preview empty
{
  const r = validateCvData({
    cvData: richCv,
    sectionCounts: { experiences: 1, skills: 2 },
    previewLive: false,
    previewText: '',
    finalResumeValid: true,
    cvRenderable: true,
  });
  r.status === CV_DATA_STATUS.INVALID && r.reasons.includes('preview_empty')
    ? pass('invalid_preview_empty')
    : fail('invalid_preview_empty', JSON.stringify(r));
}

// PARTIAL
{
  const r = validateCvData({
    cvData: richCv,
    sectionCounts: { experiences: 1, skills: 2 },
    previewLive: true,
    previewText: 'Alex Brand Lead Designer',
    finalResumeValid: false,
    cvRenderable: true,
  });
  r.status === CV_DATA_STATUS.PARTIAL && r.blockStyle && !r.blockReview
    ? pass('partial_blocks_style_export')
    : fail('partial_blocks_style_export', JSON.stringify(r));
}

// VALID
{
  const r = validateCvData({
    cvData: richCv,
    sectionCounts: { experiences: 1, skills: 2 },
    previewLive: true,
    previewText: 'Alex Brand Lead Designer Studio Figma',
    finalResumeValid: true,
    cvRenderable: true,
  });
  r.status === CV_DATA_STATUS.VALID && !r.blockExport
    ? pass('valid_full_pass')
    : fail('valid_full_pass', JSON.stringify(r));
}

const ok = checks.every((c) => c.ok);
process.exit(ok ? 0 : 1);
