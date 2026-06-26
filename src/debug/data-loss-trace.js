/**
 * Trace rawText → blocks → structuredResume → cvData → template render.
 * Pinpoints where experience / skills counts drop.
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import vm from 'vm';
import { runProductionExtractionPipeline } from '../core/pipeline/production-pipeline.js';
import { structuredToCvData } from '../core/parsing/structured-resume.js';
import { applyReviewQueueToCvData } from '../core/parsing/review-queue.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

function loadTemplateRender() {
  const code = fs.readFileSync(path.join(root, 'src/ui/templates/cv-templates.js'), 'utf8');
  const sandbox = { console };
  sandbox.window = sandbox.globalThis = sandbox;
  vm.createContext(sandbox);
  vm.runInContext(code, sandbox);
  const esc = (s) =>
    String(s || '').replace(/[&<>"']/g, (m) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' })[m]
    );
  sandbox.initHirelyTemplates({
    esc,
    sectionLabel: (k) => k,
    cvBlock: (t, h) => (h ? `<section>${t}</section>` : ''),
    cvSkillsHtml: (sk) => `<p>${sk.join(',')}</p>`,
    getPhotoHtml: () => '',
  });
  return sandbox.HirelyTemplates.render.bind(sandbox.HirelyTemplates);
}

function countInHtml(html, phrases = []) {
  let n = 0;
  for (const p of phrases) {
    if (p && html.includes(p)) n += 1;
  }
  return n;
}

function stageRow(label, counts, note = '') {
  return { stage: label, ...counts, note };
}

/**
 * @param {string} rawText
 * @param {object} [opts]
 */
export async function traceDataLoss(rawText, opts = {}) {
  const raw = String(rawText || '').trim();
  const pipe = await runProductionExtractionPipeline(raw, {
    extractionMethod: opts.extractionMethod || 'paste',
    enterpriseExtraction: opts.enterpriseExtraction || null,
  });

  const blocks = pipe.stages?.documentBlocks?.documentBlocks || [];
  const renderBlocks = pipe.stages?.documentBlocks?.renderBlocks || [];
  const structured = pipe.structuredResume || {};
  const cvRaw = structuredToCvData(structured);
  const cvValidated = pipe.validatedCVData || cvRaw;
  const queue = pipe.reviewQueue || cvValidated.reviewQueue || [];
  const cvGated = applyReviewQueueToCvData(cvValidated, queue);

  const render = loadTemplateRender();
  const htmlRaw = render(cvRaw, opts.templateId || 'ats');
  const htmlGated = render(cvGated, opts.templateId || 'ats');

  const expPhrases = (cvRaw.experience || []).map((x) => String(x).slice(0, 24)).filter(Boolean);
  const skillPhrases = (cvRaw.skills || []).map((x) => String(x).slice(0, 16)).filter(Boolean);

  const stages = [
    stageRow('rawText', { experience: 0, skills: 0 }, `${raw.length} chars`),
    stageRow('blocks (all)', {
      experience: blocks.filter((b) => b.type === 'experience').length,
      skills: blocks.filter((b) => b.type === 'skills').length,
    }),
    stageRow('renderBlocks', {
      experience: renderBlocks.filter((b) => b.type === 'experience').length,
      skills: renderBlocks.filter((b) => b.type === 'skills').length,
    }),
    stageRow('structuredResume', {
      experience: structured.experiences?.length ?? 0,
      skills: structured.skills?.length ?? 0,
    }),
    stageRow('cvData (structuredToCvData)', {
      experience: cvRaw.experience?.length ?? 0,
      skills: cvRaw.skills?.length ?? 0,
    }),
    stageRow('cvData (validated)', {
      experience: cvValidated.experience?.length ?? 0,
      skills: cvValidated.skills?.length ?? 0,
    }),
    stageRow('cvData (review gate)', {
      experience: cvGated.experience?.length ?? 0,
      skills: cvGated.skills?.length ?? 0,
      heldSections: cvGated._heldSections || [],
      pendingReview: queue.filter((i) => i.status === 'pending').length,
    }),
    stageRow('template render (validated)', {
      experience: countInHtml(htmlGated, expPhrases),
      skills: countInHtml(htmlGated, skillPhrases),
    }),
    stageRow('template render (pre-gate)', {
      experience: countInHtml(htmlRaw, expPhrases),
      skills: countInHtml(htmlRaw, skillPhrases),
    }),
  ];

  const drops = [];
  for (let i = 1; i < stages.length; i++) {
    const prev = stages[i - 1];
    const cur = stages[i];
    if (prev.experience > 0 && cur.experience === 0) {
      drops.push({ field: 'experience', at: cur.stage, from: prev.stage });
    }
    if (prev.skills > 0 && cur.skills === 0) {
      drops.push({ field: 'skills', at: cur.stage, from: prev.stage });
    }
  }

  return {
    stages,
    drops,
    firstLoss: drops[0] || null,
    reviewQueueSample: queue.slice(0, 5).map((i) => ({
      field: i.field,
      confidence: i.confidence,
      detectedLen: String(i.detected || '').length,
    })),
  };
}

export function formatTraceReport(report) {
  const lines = ['DATA LOSS TRACE', ''];
  for (const s of report.stages) {
    const held = s.heldSections?.length ? ` · held=${s.heldSections.join(',')}` : '';
    const pend = s.pendingReview != null ? ` · review=${s.pendingReview}` : '';
    lines.push(
      `${s.stage}: experience=${s.experience} skills=${s.skills}${held}${pend}${s.note ? ` (${s.note})` : ''}`
    );
  }
  if (report.firstLoss) {
    lines.push('');
    lines.push(
      `FIRST LOSS: ${report.firstLoss.field} dropped at "${report.firstLoss.at}" (after "${report.firstLoss.from}")`
    );
  } else {
    lines.push('');
    lines.push('No experience/skills count drop between stages.');
  }
  return lines.join('\n');
}
