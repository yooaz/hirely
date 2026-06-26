/**
 * Letter AI generation — optional API path with deterministic local fallback.
 */

import { renderCoverLetter } from './cover-letter-renderer.js';

/**
 * @param {object|null} cvData
 * @param {string} cvText
 * @param {{ jobTitle?: string, companyName?: string, targetRole?: string, targetCompany?: string, lang?: string, mode?: string, style?: string, jobDescription?: string, apiUrl?: string }} [opts]
 */
export async function generateCoverLetter(cvData, cvText = '', opts = {}) {
  const local = renderCoverLetter(cvData, {
    ...opts,
    jobTitle: opts.jobTitle || opts.targetRole,
    companyName: opts.companyName || opts.targetCompany,
    mode: opts.mode || opts.style,
  });
  if (!local) return null;

  const apiUrl = opts.apiUrl || '/api/analyze';
  const text = String(cvText || '').trim();
  if (!text || text.length < 40 || typeof fetch !== 'function') {
    return { ...local, source: 'local' };
  }

  try {
    const res = await fetch(apiUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        cv: text,
        job: opts.targetRole || cvData?.title || '',
        jobDescription: opts.jobDescription || '',
        mode: 'coverLetter',
      }),
    });
    if (!res.ok) return { ...local, source: 'local-fallback' };
    const data = await res.json();
    const aiLetter = String(data?.coverLetter || data?.letter || '').trim();
    if (aiLetter.length < 80) return { ...local, source: 'local-fallback' };
    const html = `<div class="coverLetterPreviewBody">${aiLetter
      .split(/\n{2,}/)
      .map((p) => `<p>${String(p).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/\n/g, '<br>')}</p>`)
      .join('')}</div>`;
    return {
      text: aiLetter,
      html,
      meta: { ...local.meta, source: 'ai' },
      source: 'ai',
    };
  } catch {
    return { ...local, source: 'local-fallback' };
  }
}
