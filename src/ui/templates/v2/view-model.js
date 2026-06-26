/**
 * Template V2 view-model — single adapter from resumeData to render DTO.
 * Never invokes parsers, OCR, or import pipelines.
 */

import { resumeDataToCvData } from '../../../core/resume-data.js';
import { buildFinalResumeData } from '../../../core/validation/final-resume-contract.js';
import { assertTemplateViewContract, TEMPLATE_V2_RULES } from './contract.js';

/**
 * Normalize resumeData for template rendering (lossless path).
 * @param {object} resumeData
 * @param {object} [opts]
 */
export function resumeDataToTemplateView(resumeData, opts = {}) {
  const rd = resumeData || {};
  let final = rd;
  if (!opts.skipFinalGate) {
    const gated = buildFinalResumeData(rd);
    final = gated?.finalResumeData || gated?.cvData ? gated.finalResumeData || rd : rd;
  }
  // Match getFinalCvData() in index.html — finalResumeData must not re-run display sanitize.
  const cvData = resumeDataToCvData(final, { skipNormalize: true });
  if ((final.experiences || []).length) {
    cvData.experiences = final.experiences;
    cvData.experience = final.experiences
      .map((e) => {
        if (typeof e === 'string') return e;
        const head = [e.role, e.company, e.dates].filter(Boolean).join(' — ');
        const bullets = (e.bullets || []).join(' · ');
        return bullets ? `${head}: ${bullets}` : head;
      })
      .filter(Boolean);
  }

  const view = {
    ...cvData,
    experiences: final.experiences || cvData.experiences || [],
    clientLogos: final.clientLogos || cvData.clientLogos || [],
    achievements: final.achievements || cvData.achievements || [],
    awards: final.awards || cvData.awards || [],
    publications: final.publications || cvData.publications || [],
    press: final.press || cvData.press || [],
    _fromFinalResumeData: true,
    _templateMeta: {
      engine: TEMPLATE_V2_RULES.singleDataSource,
      source: 'resumeData',
      parserInvoked: false,
      identity: { ...(final.identity || {}) },
      sectionCounts: {
        experiences: (final.experiences || []).length,
        education: (final.education || []).length,
        skills: (final.skills || []).length,
        tools: (final.tools || []).length,
        languages: (final.languages || []).length,
        clients: (final.clients || []).length,
        projects: (final.projects || []).length,
      },
    },
  };

  const contract = assertTemplateViewContract(view);
  if (!contract.ok && !opts.silent) {
    console.warn('TEMPLATE_V2_VIEW_CONTRACT', contract.forbidden);
  }

  return view;
}
