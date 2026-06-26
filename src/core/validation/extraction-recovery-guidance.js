/**
 * User-facing recovery guidance — translate gate/recovery codes into actionable copy.
 */

export const RECOVERY_GUIDANCE_V1 = 'RECOVERY_GUIDANCE_V1';

/** @type {Record<string, { title: string, message: string, hint?: string, severity: 'critical'|'warning'|'info', actions: string[] }>} */
export const ISSUE_CODE_GUIDANCE = Object.freeze({
  unsafe_name: {
    title: 'Name not confirmed',
    message: 'We could not confidently detect your name from this file.',
    hint: 'Confirm the correct name or paste your CV text so we can read the header clearly.',
    severity: 'critical',
    actions: ['accept_name', 'confirm_name', 'paste_text'],
  },
  low_confidence_name: {
    title: 'Name looks uncertain',
    message: 'The detected name may be wrong or mixed with other header text.',
    hint: 'Pick a suggested name or type the correct one.',
    severity: 'critical',
    actions: ['accept_name', 'confirm_name'],
  },
  thin_structure_rich_raw: {
    title: 'Work experience structure is too weak',
    message: 'We found plenty of text, but experience sections did not separate cleanly.',
    hint: 'Move lines into Experience, mark page 2 as portfolio if needed, or paste a cleaner export.',
    severity: 'critical',
    actions: ['confirm_experience', 'mark_portfolio', 'paste_text', 'retry_extraction'],
  },
  raw_blob_experience: {
    title: 'Experience looks like one merged block',
    message: 'Multiple sections may have been merged into a single experience entry.',
    hint: 'Split roles and companies in the editor or paste structured text.',
    severity: 'critical',
    actions: ['confirm_experience', 'paste_text'],
  },
  merged_blob_summary: {
    title: 'Summary contains merged content',
    message: 'The profile/summary line mixes contact info with section headings.',
    hint: 'Edit the summary or remove the noisy line.',
    severity: 'warning',
    actions: ['confirm_summary', 'paste_text'],
  },
  merged_sections_in_experience: {
    title: 'Experience row mixes multiple sections',
    message: 'Education, skills, or contact lines may be inside an experience entry.',
    hint: 'Reassign lines to the right section in recovery or the editor.',
    severity: 'critical',
    actions: ['confirm_experience', 'reassign_block'],
  },
  unstructured_extraction: {
    title: 'Document structure was not reliable',
    message: 'Text was extracted but layout blocks were too weak for a safe auto-build.',
    hint: 'Retry OCR, upload a text-based PDF, or paste your CV.',
    severity: 'critical',
    actions: ['retry_ocr', 'upload_cleaner', 'paste_text'],
  },
});

/** @type {Record<string, { label: string, description: string, primary?: boolean }>} */
export const RECOVERY_ACTION_CATALOG = Object.freeze({
  accept_name: { label: 'Use suggested name', description: 'Apply the best name candidate from extraction.', primary: true },
  confirm_name: { label: 'Confirm name', description: 'Open identity fields to type or verify your name.' },
  confirm_title: { label: 'Confirm title', description: 'Set your job title or headline.' },
  confirm_experience: { label: 'Fix experience', description: 'Open experience to split or add roles.' },
  confirm_summary: { label: 'Edit summary', description: 'Clean up the profile/summary line.' },
  reassign_block: { label: 'Reassign lines', description: 'Move noisy lines into the right section.' },
  mark_portfolio: { label: 'Mark page as portfolio', description: 'Exclude a visual page from resume parsing.' },
  retry_ocr: { label: 'Retry OCR', description: 'Re-run text recognition on scanned pages.' },
  retry_extraction: { label: 'Retry extraction', description: 'Re-process the uploaded file.' },
  upload_cleaner: { label: 'Upload cleaner file', description: 'Try a text-based PDF or DOCX export.' },
  paste_text: { label: 'Paste text manually', description: 'Paste CV text when OCR or PDF text is unreliable.' },
  continue_partial: { label: 'Continue with partial data', description: 'Preview with confirmed fields only — you accept incomplete structure.' },
});

/**
 * @param {{ field?: string, code?: string, detail?: string }} issue
 * @param {object} [ctx]
 */
export function mapIssueToUserFacing(issue, ctx = {}) {
  const code = String(issue?.code || issue?.field || 'unknown');
  const guide = ISSUE_CODE_GUIDANCE[code] || {
    title: code.replace(/_/g, ' '),
    message: 'This field needs your review before we can show a polished CV.',
    severity: 'warning',
    actions: ['confirm_name'],
  };
  const detail = String(issue?.detail || '').trim();
  return {
    id: `gate-${code}-${issue?.field || 'x'}`,
    code,
    field: issue?.field || code,
    title: guide.title,
    message: guide.message,
    hint: guide.hint || '',
    detail,
    severity: guide.severity,
    actions: [...guide.actions],
    userFacing: true,
    source: 'preview_gate',
    value: ctx.nameCandidates?.[0] || detail || '',
  };
}

/**
 * @param {object[]} gateIssues
 * @param {object} [ctx]
 */
export function mapGateIssuesToUserFacing(gateIssues = [], ctx = {}) {
  const seen = new Set();
  return (gateIssues || [])
    .map((i) => mapIssueToUserFacing(i, ctx))
    .filter((i) => {
      const k = `${i.code}::${i.field}`;
      if (seen.has(k)) return false;
      seen.add(k);
      return true;
    });
}

/**
 * @param {string[]} actionIds
 */
export function buildRecoveryActionButtons(actionIds = []) {
  const seen = new Set();
  const out = [];
  for (const id of actionIds) {
    if (!id || seen.has(id)) continue;
    seen.add(id);
    const def = RECOVERY_ACTION_CATALOG[id];
    if (def) out.push({ id, ...def });
  }
  return out;
}

/**
 * @param {object} input
 */
export function buildRecoverySuggestions(input = {}) {
  const suggestions = [];
  const gate = input.previewGate || {};
  const diag = input.diagnostics || {};
  const codes = new Set((gate.issues || []).map((i) => i.code));

  if (codes.has('unsafe_name') || codes.has('low_confidence_name')) {
    const cands = diag.nameCandidates || [];
    if (cands.length) {
      suggestions.push({
        id: 'suggest-name',
        type: 'name_candidate',
        label: 'Suggested name',
        value: cands[0],
        action: 'accept_name',
      });
    }
    if (diag.fileNameNameHint) {
      suggestions.push({
        id: 'suggest-name-file',
        type: 'name_candidate',
        label: 'From file name',
        value: diag.fileNameNameHint,
        action: 'accept_name',
      });
    }
  }

  if (codes.has('thin_structure_rich_raw') || codes.has('raw_blob_experience')) {
    suggestions.push({
      id: 'suggest-exp-fix',
      type: 'workflow',
      label: 'Split experience',
      message: 'Open Experience and add one row per role instead of one merged block.',
      action: 'confirm_experience',
    });
  }

  const portfolioPages = diag.portfolioPages || [];
  if (portfolioPages.length && codes.has('thin_structure_rich_raw')) {
    suggestions.push({
      id: 'suggest-portfolio',
      type: 'page_type',
      label: `Page ${portfolioPages.join(', ')} may be portfolio`,
      message: 'Mark non-resume pages as portfolio so they do not weaken structure scoring.',
      action: 'mark_portfolio',
      page: portfolioPages[0],
    });
  }

  const suspicious = (diag.suspiciousLines || []).slice(0, 3);
  for (const line of suspicious) {
    suggestions.push({
      id: `suspicious-${suggestions.length}`,
      type: 'suspicious_line',
      label: 'Suspicious line',
      value: line.text,
      page: line.page,
      action: 'reassign_block',
    });
  }

  return suggestions;
}

/**
 * @param {object} input
 */
export function buildRecoveryGuidanceSummary(input = {}) {
  const gate = input.previewGate || {};
  const issues = mapGateIssuesToUserFacing(gate.issues || [], input.diagnostics || {});
  const actionSet = new Set();
  for (const i of issues) for (const a of i.actions || []) actionSet.add(a);
  if (gate.blockPremiumRender) {
    actionSet.add('paste_text');
    actionSet.add('retry_ocr');
  }
  const primaryActions = buildRecoveryActionButtons([...actionSet]);
  const suggestions = buildRecoverySuggestions(input);
  return {
    version: RECOVERY_GUIDANCE_V1,
    issues,
    primaryActions,
    suggestions,
    lead:
      gate.blockPremiumRender
        ? 'Your file was read, but we need a few confirmations before showing a polished CV preview.'
        : 'Review the items below before export.',
  };
}
