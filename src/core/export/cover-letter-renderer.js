/**
 * Cover letter renderer — Professional, Creative, Executive (P4).
 */

import {
  COVER_LETTER_MODES,
  LETTER_TONE_IDS,
  buildCoverLetterDraft,
} from './cover-letter-engine.js';

/** Production tones for UI and QA. */
export const LETTER_TONES = LETTER_TONE_IDS;

export const LETTER_MODES = LETTER_TONES;

/** @deprecated use LETTER_TONES */
export const LETTER_STYLES = LETTER_TONES;

/** Legacy internal copy modes (formal, startup, corporate, …). */
export const LEGACY_LETTER_MODES = Object.freeze(Object.keys(COVER_LETTER_MODES));

/**
 * @param {object|null} cvData
 * @param {{ jobTitle?: string, companyName?: string, mode?: string, style?: string, lang?: string, targetRole?: string, targetCompany?: string }} [opts]
 */
export function renderCoverLetter(cvData, opts = {}) {
  const draft = buildCoverLetterDraft(cvData, opts);
  if (!draft) return null;

  const mode = draft.meta.mode;
  let text = draft.text;

  if (mode === 'corporate' || mode === 'executive') {
    text = text
      .replace(/[“”«»]/g, '"')
      .replace(/[’]/g, "'")
      .replace(/[–—]/g, '-')
      .replace(/→/g, '-')
      .replace(/•/g, '-');
  }

  if (mode === 'creative') {
    text = text.replace(/\n• /g, '\n→ ');
  }

  return {
    text,
    html: textToPreviewHtml(text, mode),
    meta: draft.meta,
  };
}

function escHtml(s) {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

function textToPreviewHtml(text, mode) {
  const paras = String(text || '')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);
  const cls = `coverLetterPreviewBody coverLetterPreviewBody--${mode}`;
  return `<div class="${cls}">${paras
    .map((p) => {
      if (p.startsWith('• ') || p.startsWith('→ ') || p.startsWith('- ')) {
        const items = p.split('\n').filter(Boolean);
        return `<ul>${items.map((i) => `<li>${escHtml(i.replace(/^[•→-]\s*/, ''))}</li>`).join('')}</ul>`;
      }
      return `<p>${escHtml(p).replace(/\n/g, '<br>')}</p>`;
    })
    .join('')}</div>`;
}
