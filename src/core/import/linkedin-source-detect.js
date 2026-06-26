/**
 * LinkedIn import — detect source type from file name, mime, and extracted text.
 */

export const LINKEDIN_SOURCE_TYPES = Object.freeze({
  linkedin_pdf: 'linkedin_pdf',
  linkedin_export: 'linkedin_export',
  resume_pdf: 'resume_pdf',
  resume_docx: 'resume_docx',
  resume_other: 'resume_other',
  unknown: 'unknown',
});

const LINKEDIN_PDF_MARKERS = [
  /\blinkedin\.com\/in\//i,
  /\btop skills\b/i,
  /\bprincipales compétences\b/i,
  /\bcompétences principales\b/i,
  /\bprofile\s*(saved|enregistré)\b/i,
  /\bcontact info\b/i,
  /\binformations de contact\b/i,
];

const RESUME_MARKERS = [
  /\b(curriculum vitae|résumé|resume)\b/i,
  /\bprofessional experience\b/i,
  /\bexpérience professionnelle\b/i,
  /\bwork experience\b/i,
];

/**
 * @param {{ fileName?: string, mimeType?: string, text?: string }} input
 */
export function detectLinkedInSource(input = {}) {
  const name = String(input.fileName || '').toLowerCase();
  const mime = String(input.mimeType || '').toLowerCase();
  const text = String(input.text || '').slice(0, 12000);

  if (/\.(json|csv|zip)$/i.test(name) || mime.includes('json') || mime.includes('csv')) {
    if (isLinkedInExportContent(text, name)) {
      return { type: LINKEDIN_SOURCE_TYPES.linkedin_export, confidence: 0.92, reason: 'linkedin_export_file' };
    }
    if (/profile|positions|skills|education/i.test(name) || /"first name"|"company name"|"school name"/i.test(text)) {
      return { type: LINKEDIN_SOURCE_TYPES.linkedin_export, confidence: 0.88, reason: 'linkedin_export_shape' };
    }
  }

  const ext = (name.split('.').pop() || '').toLowerCase();
  const isPdf = ext === 'pdf' || mime.includes('pdf');
  const isDocx = ext === 'docx' || ext === 'doc' || mime.includes('word');

  const linkedinHits = LINKEDIN_PDF_MARKERS.filter((re) => re.test(text)).length;
  const resumeHits = RESUME_MARKERS.filter((re) => re.test(text)).length;

  if (/linkedin|profile.*pdf/i.test(name) && isPdf) {
    return { type: LINKEDIN_SOURCE_TYPES.linkedin_pdf, confidence: 0.9, reason: 'filename_linkedin_pdf' };
  }

  if (isPdf) {
    if (linkedinHits >= 2 && linkedinHits >= resumeHits) {
      return { type: LINKEDIN_SOURCE_TYPES.linkedin_pdf, confidence: 0.85, reason: 'linkedin_pdf_markers' };
    }
    if (resumeHits >= 1 || linkedinHits === 0) {
      return { type: LINKEDIN_SOURCE_TYPES.resume_pdf, confidence: 0.8, reason: 'resume_pdf' };
    }
    if (linkedinHits >= 1) {
      return { type: LINKEDIN_SOURCE_TYPES.linkedin_pdf, confidence: 0.7, reason: 'linkedin_pdf_weak' };
    }
    return { type: LINKEDIN_SOURCE_TYPES.resume_pdf, confidence: 0.55, reason: 'pdf_default_resume' };
  }

  if (isDocx) {
    return { type: LINKEDIN_SOURCE_TYPES.resume_docx, confidence: 0.82, reason: 'resume_docx' };
  }

  if (linkedinHits >= 2) {
    return { type: LINKEDIN_SOURCE_TYPES.linkedin_pdf, confidence: 0.65, reason: 'text_linkedin_profile' };
  }

  if (resumeHits >= 1) {
    return { type: LINKEDIN_SOURCE_TYPES.resume_other, confidence: 0.6, reason: 'resume_text' };
  }

  return { type: LINKEDIN_SOURCE_TYPES.unknown, confidence: 0.3, reason: 'unknown' };
}

function isLinkedInExportContent(text, fileName) {
  const blob = `${fileName}\n${text}`.toLowerCase();
  return (
    /"first name"|"last name"|"company name"|"title"|"school name"|"degree name"/i.test(text) ||
    /profile\.json|positions\.json|skills\.json|education\.json/i.test(blob)
  );
}

/**
 * Source-type quality weight for a resumeData field.
 * @param {string} sourceType
 * @param {string} field
 */
export function sourceFieldWeight(sourceType, field) {
  const weights = {
    linkedin_export: {
      identity: 1,
      linkedin: 1,
      summary: 0.85,
      experiences: 0.95,
      skills: 1,
      tools: 0.7,
      education: 0.9,
      languages: 0.85,
    },
    linkedin_pdf: {
      identity: 0.88,
      linkedin: 1,
      summary: 0.75,
      experiences: 0.8,
      skills: 0.92,
      tools: 0.65,
      education: 0.7,
      languages: 0.7,
    },
    resume_pdf: {
      identity: 0.82,
      linkedin: 0.6,
      summary: 0.95,
      experiences: 1,
      skills: 0.78,
      tools: 0.85,
      education: 0.92,
      languages: 0.8,
    },
    resume_docx: {
      identity: 0.84,
      linkedin: 0.62,
      summary: 0.94,
      experiences: 0.98,
      skills: 0.8,
      tools: 0.86,
      education: 0.9,
      languages: 0.82,
    },
  };
  const map = weights[sourceType] || weights.resume_pdf;
  return map[field] ?? 0.75;
}
