/**
 * PDF root cause — RAW text → blocks → classified blocks → final JSON.
 * Lists every lost experience line with rule, confidence, and rejection reason.
 */

import { diffLineSets } from './extraction-trace.js';
import { collectSectionsOrderAgnostic } from '../core/parsing/section-mapper.js';
import { fuzzySectionKey } from '../core/parsing/section-fuzzy.js';
import { enrichBlocksFromTop } from '../core/parsing/rich-parser.js';
import { classifyLineWithConfidence } from '../core/parsing/section-sanity.js';
import {
  buildExperienceEntries,
  buildUnknownExperienceBlocks,
  diagnoseExperienceBucketLine,
  experienceEntryToLegacyString,
  EXPERIENCE_DROP_RULES,
  lineMayBeUnknownExperience,
  PARSER_ENTERPRISE_THRESHOLD,
} from '../core/parsing/parser-enterprise.js';
import { getParserClassificationLog } from '../core/parsing/parser-classification-debug.js';
import { isValidExperienceLine } from '../core/parsing/field-sanitize.js';
import { applyReviewQueueToCvData } from '../core/parsing/review-queue.js';

function escapeHtml(s) {
  return String(s || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function normKey(line) {
  return String(line || '')
    .trim()
    .toLowerCase()
    .replace(/\s+/g, ' ');
}

function lineInBlob(line, blobs) {
  const k = normKey(line);
  if (!k || k.length < 4) return false;
  return blobs.some((b) => {
    const blob = String(b || '').toLowerCase();
    return blob.includes(k) || k.split(/\s+/).filter((w) => w.length > 4).every((w) => blob.includes(w));
  });
}

function formatSectionBlocks(blocks) {
  const lines = [];
  for (const [key, arr] of Object.entries(blocks || {})) {
    if (!Array.isArray(arr) || !arr.length) continue;
    if (key.startsWith('_')) continue;
    lines.push(`[${key.toUpperCase()}] (${arr.length})`);
    arr.forEach((l) => lines.push(`  ${String(l).trim()}`));
    lines.push('');
  }
  return lines.join('\n').trim();
}

function formatClassifiedBlocks(documentBlocks) {
  return (documentBlocks || [])
    .map((b) => {
      const rev = b.needsReview ? ' · REVIEW' : '';
      const acc = b.accepted === false ? ' · REJECTED' : '';
      return `[${b.type || 'unknown'}] ${b.confidence ?? '—'}%${rev}${acc} · p${b.page ?? 1}\n  ${String(b.text || '').trim()}`;
    })
    .join('\n\n');
}

function collectFinalExperienceTexts(cvData, structured, enterprise) {
  const texts = [];
  for (const x of cvData?.experience || []) texts.push(String(x));
  for (const x of cvData?.unknownExperience || []) texts.push(String(x));
  for (const e of enterprise?.experiences || []) texts.push(experienceEntryToLegacyString(e));
  for (const u of enterprise?.unknownExperience || []) {
    texts.push(typeof u === 'string' ? u : u.text || (u.lines || []).join(' — '));
  }
  for (const e of structured?.experiences || []) {
    const head = [e.role || e.title, e.company, [e.startDate, e.endDate].filter(Boolean).join('–')]
      .filter(Boolean)
      .join(' — ');
    if (head) texts.push(head);
    (e.bullets || []).forEach((b) => texts.push(String(b)));
  }
  return texts.filter(Boolean);
}

function lineText(line) {
  if (line == null) return '';
  if (typeof line === 'string') return line.trim();
  if (typeof line === 'object') return String(line.text || line.value || line.line || '').trim();
  return String(line).trim();
}

function collectCareerCandidateLines(raw, cleaned, blocks, documentBlocks) {
  const seen = new Set();
  const add = (line) => {
    const t = lineText(line);
    if (t.length < 8 || seen.has(normKey(t))) return;
    seen.add(normKey(t));
    out.push(t);
  };
  const out = [];

  for (const l of String(raw || '').split('\n')) add(l);
  for (const l of String(cleaned || '').split('\n')) add(l);
  for (const l of blocks?.experience || []) add(l);
  for (const l of blocks?.achievements || []) add(l);
  for (const b of documentBlocks || []) {
    if (b.type === 'experience' || b.type === 'achievements') {
      (b.lines || [b.text]).forEach((l) => add(lineText(l) || l));
    }
  }

  let activeSection = null;
  for (const l of String(cleaned || raw || '').split('\n')) {
    const t = String(l || '').trim();
    if (!t) continue;
    const sk = fuzzySectionKey(t);
    if (sk) activeSection = sk;
    if (activeSection === 'experience' || activeSection === 'achievements') add(t);
  }

  return out.filter(
    (l) =>
      lineMayBeUnknownExperience(l) ||
      (blocks?.experience || []).some((x) => normKey(x) === normKey(l)) ||
      (documentBlocks || []).some(
        (b) =>
          (b.type === 'experience' || b.type === 'achievements') &&
          (b.lines || [b.text]).some((x) => normKey(x) === normKey(l))
      )
  );
}

/**
 * @param {string} line
 * @param {object} ctx
 */
function diagnoseLostExperience(line, ctx) {
  const l = String(line || '').trim();
  const finalBlobs = ctx.finalTexts;

  if (lineInBlob(l, finalBlobs)) return null;

  const { removed: cleanRemoved } = diffLineSets(ctx.raw, ctx.cleaned);
  if (cleanRemoved.some((r) => normKey(r) === normKey(l) || normKey(l).includes(normKey(r)))) {
    return {
      originalText: l,
      reasonRejected: 'Line removed during safe clean / line-cleaner',
      confidence: null,
      rule: 'cleanTextWithRejected',
      stage: 'clean',
    };
  }

  const bucketDiag = diagnoseExperienceBucketLine(l);
  if (bucketDiag) {
    return {
      originalText: l,
      reasonRejected: bucketDiag.reason,
      confidence: bucketDiag.confidence ?? null,
      rule: bucketDiag.rule,
      stage: 'applyParserEnterprisePass',
    };
  }

  const cls = classifyLineWithConfidence(l);
  if (cls.bucket !== 'experience' && cls.confidence >= PARSER_ENTERPRISE_THRESHOLD) {
    return {
      originalText: l,
      reasonRejected: `Line classifier assigned bucket "${cls.bucket}"`,
      confidence: cls.confidence,
      rule: `classifyLineWithConfidence → ${cls.bucket}`,
      stage: 'classify',
    };
  }

  const logRow = (ctx.classificationLog || []).find((r) => normKey(r.line) === normKey(l));
  if (logRow && logRow.bucket !== 'experience') {
    return {
      originalText: l,
      reasonRejected: logRow.classificationReason || `Dictionary/heuristic → ${logRow.bucket}`,
      confidence: logRow.confidenceScore ?? null,
      rule: logRow.matchedDictionary
        ? `dictionary.${logRow.matchedDictionary}`
        : `parser.${logRow.classificationReason || 'heuristic'}`,
      stage: 'parser_log',
    };
  }

  const drop = (ctx.dropped || []).find((d) =>
    (d.sourceLines || []).some((sl) => normKey(sl) === normKey(l) || normKey(l).includes(normKey(sl)))
  );
  if (drop) {
    return {
      originalText: l,
      reasonRejected: drop.detail || drop.reason || 'Dropped while building experience entries',
      confidence: drop.confidence ?? null,
      rule: drop.rule || EXPERIENCE_DROP_RULES[drop.reason] || drop.reason,
      stage: 'buildExperienceEntries',
    };
  }

  const docBlock = (ctx.documentBlocks || []).find((b) =>
    (b.lines || [b.text]).some((t) => normKey(t) === normKey(l))
  );
  if (docBlock && docBlock.type !== 'experience') {
    return {
      originalText: l,
      reasonRejected: `Document block typed as "${docBlock.type}"${docBlock.needsReview ? ' (review)' : ''}`,
      confidence: docBlock.confidence ?? null,
      rule: `blockClassifier.type=${docBlock.type}`,
      stage: 'document_blocks',
    };
  }
  if (docBlock?.needsReview || docBlock?.accepted === false) {
    return {
      originalText: l,
      reasonRejected: 'Classified block below confidence gate or flagged for review',
      confidence: docBlock.confidence ?? null,
      rule: `blockClassifier.threshold < ${docBlock.threshold ?? PARSER_ENTERPRISE_THRESHOLD}`,
      stage: 'document_blocks',
    };
  }

  if (!isValidExperienceLine(l)) {
    return {
      originalText: l,
      reasonRejected: 'Failed isValidExperienceLine sanitizer',
      confidence: cls.confidence ?? null,
      rule: 'normalizeCvData.isValidExperienceLine',
      stage: 'sanitize',
    };
  }

  const held = (ctx.cvData?._heldSections || []).includes('experience');
  if (held) {
    return {
      originalText: l,
      reasonRejected: 'Experience section held for review — hidden from preview',
      confidence: null,
      rule: 'applyReviewQueueToCvData._heldSections',
      stage: 'review_gate',
    };
  }

  return {
    originalText: l,
    reasonRejected: 'Not present in final experience / unknownExperience arrays',
    confidence: cls.confidence ?? null,
    rule: 'unknown — trace pipeline manually',
    stage: 'final_json',
  };
}

/**
 * @param {object} pipe — production pipeline result
 * @param {object} [opts]
 */
export function buildPdfRootCauseReport(pipe, opts = {}) {
  const raw = String(
    opts.rawText ||
      pipe?.rawText ||
      pipe?.enterprise?.rawExtraction ||
      pipe?.structuredResume?.rawExtraction ||
      ''
  ).trim();
  const cleaned = String(pipe?.cleanedText || pipe?.structuredResume?.metadata?.cleanedText || raw).trim();
  const cvData = pipe?.validatedCVData || opts.cvData || {};
  const structured = pipe?.structuredResume || {};
  const enterprise = structured?._enterprise || cvData?._enterprise || pipe?.enterprise || {};

  const sectionBlocks = collectSectionsOrderAgnostic(cleaned, enrichBlocksFromTop);
  const documentBlocks =
    pipe?.stages?.documentBlocks?.documentBlocks ||
    structured?.metadata?.documentBlocks?.documentBlocks ||
    opts.documentBlocks ||
    [];

  const expBuilt = buildExperienceEntries(sectionBlocks);
  const isApproved = (e) =>
    String(e.title || '').trim().length > 2 &&
    (e.confidence ?? 0) >= PARSER_ENTERPRISE_THRESHOLD &&
    !e.needsReview;
  const approved = expBuilt.entries.filter(isApproved);
  const held = expBuilt.entries.filter((e) => !isApproved(e));

  const unknownExperience = buildUnknownExperienceBlocks({
    droppedFromBuild: expBuilt.dropped,
    experiencesHeld: held,
    approvedExperienceTexts: approved.map(experienceEntryToLegacyString),
    careerUnsortedLines: (sectionBlocks.unsorted || []).filter((l) => lineMayBeUnknownExperience(l)),
  });

  const preGate = { ...cvData };
  const postGate = applyReviewQueueToCvData(cvData, cvData.reviewQueue || pipe?.reviewQueue || []);

  const ctx = {
    raw,
    cleaned,
    finalTexts: collectFinalExperienceTexts(postGate, structured, {
      ...enterprise,
      experiences: approved,
      unknownExperience,
    }),
    dropped: expBuilt.dropped,
    documentBlocks,
    classificationLog: getParserClassificationLog(),
    cvData: postGate,
  };

  const candidates = collectCareerCandidateLines(raw, cleaned, sectionBlocks, documentBlocks);
  const lost = [];
  const seenLost = new Set();
  for (const line of candidates) {
    const row = diagnoseLostExperience(line, ctx);
    if (!row) continue;
    const key = normKey(row.originalText);
    if (seenLost.has(key)) continue;
    seenLost.add(key);
    lost.push(row);
  }

  for (const d of expBuilt.dropped) {
    const text = (d.sourceLines || []).join(' — ');
    if (!text || seenLost.has(normKey(text))) continue;
    const row = diagnoseLostExperience(text, ctx) || {
      originalText: text,
      reasonRejected: d.detail || d.reason,
      confidence: d.confidence ?? null,
      rule: d.rule || EXPERIENCE_DROP_RULES[d.reason] || d.reason,
      stage: 'buildExperienceEntries',
    };
    seenLost.add(normKey(text));
    lost.push(row);
  }

  const finalJson = {
    cvData: postGate,
    structuredResume: structured,
    enterprise: {
      experiences: approved,
      experiencesHeld: held,
      unknownExperience,
      experienceDropped: expBuilt.dropped,
    },
    reviewGate: {
      experienceBefore: preGate.experience?.length ?? 0,
      experienceAfter: postGate.experience?.length ?? 0,
      heldSections: postGate._heldSections || [],
    },
  };

  return {
    rawPdfText: raw,
    blocksText: formatSectionBlocks(sectionBlocks),
    sectionBlocks,
    classifiedBlocksText: formatClassifiedBlocks(documentBlocks),
    documentBlocks,
    finalJson,
    finalJsonText: JSON.stringify(finalJson, null, 2),
    lostExperience: lost,
    summary: {
      rawChars: raw.length,
      cleanedChars: cleaned.length,
      blockExperienceLines: (sectionBlocks.experience || []).length,
      classifiedExperienceBlocks: documentBlocks.filter((b) => b.type === 'experience').length,
      finalExperienceCount: (postGate.experience || []).length,
      finalUnknownCount: (postGate.unknownExperience || []).length,
      lostCount: lost.length,
      threshold: PARSER_ENTERPRISE_THRESHOLD,
    },
  };
}

export function formatPdfRootCauseConsole(report) {
  const r = report || {};
  const lines = [
    'PDF ROOT CAUSE — EXPERIENCE',
    `lost: ${r.summary?.lostCount ?? 0} · final exp: ${r.summary?.finalExperienceCount ?? 0} · unknown: ${r.summary?.finalUnknownCount ?? 0}`,
    '',
  ];
  for (const row of r.lostExperience || []) {
    lines.push(`— ${row.originalText.slice(0, 100)}`);
    lines.push(`  rule: ${row.rule}`);
    lines.push(`  reason: ${row.reasonRejected}`);
    lines.push(`  confidence: ${row.confidence ?? '—'}`);
    lines.push('');
  }
  return lines.join('\n');
}

/**
 * @param {ReturnType<typeof buildPdfRootCauseReport>} report
 */
export function renderPdfRootCauseSection(report) {
  const r = report || {};
  const sum = r.summary || {};

  const lostRows = (r.lostExperience || [])
    .map(
      (row) => `<tr class="forensic-row forensic-row--experience">
      <td>${escapeHtml(row.originalText)}</td>
      <td>${escapeHtml(row.reasonRejected)}</td>
      <td>${row.confidence != null ? `${row.confidence}%` : '—'}</td>
      <td><code>${escapeHtml(row.rule)}</code></td>
      <td><code>${escapeHtml(row.stage || '—')}</code></td>
    </tr>`
    )
    .join('');

  const lostTable = lostRows
    ? `<table class="forensic-table forensic-table--loss"><thead><tr><th>Original text</th><th>Reason rejected</th><th>Confidence</th><th>Rule</th><th>Stage</th></tr></thead><tbody>${lostRows}</tbody></table>`
    : '<p class="forensic-muted">No lost experience lines detected (all career candidates appear in final JSON).</p>';

  return `<section class="forensic-diff forensic-rca">
  <h3>PDF ROOT CAUSE — EXPERIENCE LOSS</h3>
  <p class="forensic-muted">Threshold ${sum.threshold ?? 70}% · block experience lines: ${sum.blockExperienceLines ?? 0} · classified exp blocks: ${sum.classifiedExperienceBlocks ?? 0} · final experience: ${sum.finalExperienceCount ?? 0} · unknown preserved: ${sum.finalUnknownCount ?? 0} · <strong class="forensic-warn">lost: ${sum.lostCount ?? 0}</strong></p>
  ${lostTable}
  <details class="forensic-details" open><summary>RAW PDF TEXT (${sum.rawChars ?? 0} chars)</summary><pre class="forensic-pre">${escapeHtml(r.rawPdfText || '')}</pre></details>
  <details class="forensic-details"><summary>BLOCKS (section mapper)</summary><pre class="forensic-pre">${escapeHtml(r.blocksText || '')}</pre></details>
  <details class="forensic-details"><summary>CLASSIFIED BLOCKS (document_blocks)</summary><pre class="forensic-pre">${escapeHtml(r.classifiedBlocksText || '')}</pre></details>
  <details class="forensic-details"><summary>FINAL JSON</summary><pre class="forensic-pre">${escapeHtml(r.finalJsonText || '')}</pre></details>
</section>`;
}

export function logPdfRootCauseReport(report) {
  console.group('PDF ROOT CAUSE — EXPERIENCE');
  console.log(formatPdfRootCauseConsole(report));
  console.groupEnd();
}
