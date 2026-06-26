/**
 * UI flow state machine — canonical owner for blocked_recovery vs preview_ready.
 */

export const UI_FLOW_V1 = 'UI_FLOW_V1';

export const UI_FLOW_STATES = Object.freeze({
  EXTRACTING: 'extracting',
  PARSED_READY: 'parsed_ready',
  BLOCKED_RECOVERY: 'blocked_recovery',
  PREVIEW_READY: 'preview_ready',
});

/** Reasons that may clear sticky blocked_recovery when preview gate passes. */
export const UI_FLOW_GATE_EXIT_REASONS = Object.freeze([
  'after_commit',
  'gate_pass_user_fix',
  'reextract_success',
  'new_import',
]);

/** Explicit user events that may exit blocked_recovery to parsed_ready. */
export const UI_FLOW_EXPLICIT_BLOCKED_EXITS = Object.freeze([
  'continue_partial',
  'user_action',
  'user_override',
]);

/** Allowed state transitions (from -> to[]). */
export const UI_FLOW_ALLOWED_TRANSITIONS = Object.freeze({
  [UI_FLOW_STATES.EXTRACTING]: [
    UI_FLOW_STATES.EXTRACTING,
    UI_FLOW_STATES.PARSED_READY,
    UI_FLOW_STATES.BLOCKED_RECOVERY,
  ],
  [UI_FLOW_STATES.PARSED_READY]: [
    UI_FLOW_STATES.PARSED_READY,
    UI_FLOW_STATES.BLOCKED_RECOVERY,
    UI_FLOW_STATES.PREVIEW_READY,
    UI_FLOW_STATES.EXTRACTING,
  ],
  [UI_FLOW_STATES.BLOCKED_RECOVERY]: [
    UI_FLOW_STATES.BLOCKED_RECOVERY,
    UI_FLOW_STATES.PREVIEW_READY,
    UI_FLOW_STATES.PARSED_READY,
  ],
  [UI_FLOW_STATES.PREVIEW_READY]: [
    UI_FLOW_STATES.PREVIEW_READY,
    UI_FLOW_STATES.BLOCKED_RECOVERY,
    UI_FLOW_STATES.PARSED_READY,
    UI_FLOW_STATES.EXTRACTING,
  ],
});

/**
 * @param {object[]} issues
 */
export function hashRecoveryIssues(issues = []) {
  const parts = (issues || [])
    .map((i) => `${i.code || ''}|${i.field || ''}|${String(i.detail || '').slice(0, 40)}`)
    .sort();
  return parts.join(';;') || 'none';
}

/**
 * @param {object|null} report
 */
export function recoveryIssueHashFromReport(report) {
  if (!report) return 'none';
  const gate = report.previewGate?.issues || [];
  const detected = (report.detectedIssues || []).map((i) => ({
    code: i.code,
    field: i.field,
    detail: i.detail || i.message,
  }));
  const seen = new Set();
  const merged = [...gate, ...detected].filter((i) => {
    const key = `${i.code || ''}|${i.field || ''}|${String(i.detail || '').slice(0, 40)}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  return hashRecoveryIssues(merged);
}

/**
 * @param {string} [resumeKey]
 */
export function hashResumeRevision(resumeKey = '') {
  return String(resumeKey || '').slice(0, 512);
}

/**
 * @param {object} [seed]
 */
export function createUiFlowState(seed = {}) {
  return {
    version: UI_FLOW_V1,
    current: seed.current || UI_FLOW_STATES.PARSED_READY,
    previous: seed.previous || null,
    issueHash: seed.issueHash || null,
    resumeRevisionHash: seed.resumeRevisionHash || null,
    lastCommitHash: seed.lastCommitHash || null,
    recoveryPanelHash: seed.recoveryPanelHash || null,
    recoveryPanelVisible: !!seed.recoveryPanelVisible,
    previewAllowed: seed.previewAllowed !== false,
    templateRenderSkipped: !!seed.templateRenderSkipped,
    blockedAt: seed.blockedAt || null,
    lastTransitionAt: seed.lastTransitionAt || null,
    lastTransitionReason: seed.lastTransitionReason || null,
    renderGeneration: seed.renderGeneration || 0,
    importRevision: seed.importRevision || 0,
    extractionRevision: seed.extractionRevision || 0,
    parsingRevision: seed.parsingRevision || 0,
    blockedAtRevision: seed.blockedAtRevision ?? null,
    blockedIssueHash: seed.blockedIssueHash || null,
    finalCommitRevision: seed.finalCommitRevision || 0,
    templateRenderSuppressedCount: seed.templateRenderSuppressedCount || 0,
    illegalTransitionCount: seed.illegalTransitionCount || 0,
    lastIllegalTransition: seed.lastIllegalTransition || null,
    log: Array.isArray(seed.log) ? seed.log.slice(-48) : [],
  };
}

/**
 * @param {object} flow
 * @param {string} kind — import | extraction | parsing | finalCommit
 */
export function bumpRevision(flow, kind) {
  if (!flow) return 0;
  const map = {
    import: 'importRevision',
    extraction: 'extractionRevision',
    parsing: 'parsingRevision',
    finalCommit: 'finalCommitRevision',
  };
  const key = map[kind];
  if (!key) return 0;
  flow[key] = (flow[key] || 0) + 1;
  appendUiFlowLog(flow, 'REVISION_BUMP', { kind, value: flow[key] });
  return flow[key];
}

/**
 * @param {object} flow
 * @param {string} from
 * @param {string} to
 * @param {string} reason
 * @param {string} [code]
 */
export function logIllegalTransition(flow, from, to, reason, code = 'illegal_transition') {
  if (!flow) return;
  flow.illegalTransitionCount = (flow.illegalTransitionCount || 0) + 1;
  flow.lastIllegalTransition = {
    at: new Date().toISOString(),
    from,
    to,
    reason,
    code,
  };
  appendUiFlowLog(flow, 'ILLEGAL_TRANSITION', { from, to, reason, code });
  try {
    if (typeof globalThis !== 'undefined') {
      const hook = globalThis.__HIRELY_UI_FLOW_ILLEGAL_HOOK__;
      if (typeof hook === 'function') hook(flow.lastIllegalTransition);
    }
  } catch {
    /* ignore */
  }
}

/**
 * @param {object} flow
 * @param {string} from
 * @param {string} to
 * @param {string} reason
 * @param {object} [meta]
 */
export function isTransitionAllowed(flow, from, to, reason, meta = {}) {
  if (!from || !to || from === to) return true;
  const allowed = UI_FLOW_ALLOWED_TRANSITIONS[from];
  if (!allowed || !allowed.includes(to)) {
    logIllegalTransition(flow, from, to, reason, 'transition_not_in_graph');
    return false;
  }
  if (
    from === UI_FLOW_STATES.BLOCKED_RECOVERY &&
    to === UI_FLOW_STATES.PREVIEW_READY &&
    !meta.allowGateExit &&
    !isGateExitReason(reason)
  ) {
    logIllegalTransition(flow, from, to, reason, 'implicit_preview_exit');
    return false;
  }
  if (
    from === UI_FLOW_STATES.BLOCKED_RECOVERY &&
    to === UI_FLOW_STATES.PARSED_READY &&
    !meta.explicitExit &&
    !UI_FLOW_EXPLICIT_BLOCKED_EXITS.includes(reason)
  ) {
    logIllegalTransition(flow, from, to, reason, 'implicit_parsed_ready_exit');
    return false;
  }
  return true;
}

/**
 * @param {object} flow
 * @param {string} next
 * @param {string} reason
 * @param {object} [meta]
 */
export function transitionUiFlow(flow, next, reason, meta = {}) {
  if (!flow || !next || flow.current === next) return flow;
  const from = flow.current;
  if (!isTransitionAllowed(flow, from, next, reason, meta)) {
    return flow;
  }
  flow.previous = from;
  flow.current = next;
  flow.lastTransitionAt = new Date().toISOString();
  flow.lastTransitionReason = reason;
  if (next === UI_FLOW_STATES.BLOCKED_RECOVERY) {
    flow.blockedAt = flow.lastTransitionAt;
    if (flow.blockedAtRevision == null) {
      flow.blockedAtRevision = flow.importRevision || 0;
    }
    if (meta.issueHash) flow.blockedIssueHash = meta.issueHash;
  }
  if (next === UI_FLOW_STATES.PREVIEW_READY) {
    flow.previewAllowed = true;
    flow.templateRenderSkipped = false;
    flow.blockedAt = null;
    flow.blockedAtRevision = null;
    flow.blockedIssueHash = null;
  }
  if (next === UI_FLOW_STATES.BLOCKED_RECOVERY) {
    flow.previewAllowed = false;
    flow.templateRenderSkipped = true;
  }
  appendUiFlowLog(flow, 'TRANSITION', {
    from,
    to: next,
    reason,
    ...meta,
  });
  return flow;
}

/**
 * @param {object} flow
 * @param {string} event
 * @param {object} [meta]
 */
export function appendUiFlowLog(flow, event, meta = {}) {
  if (!flow) return;
  const entry = {
    at: new Date().toISOString(),
    event,
    current: flow.current,
    previous: flow.previous,
    issueHash: flow.issueHash,
    previewAllowed: flow.previewAllowed,
    recoveryPanelVisible: flow.recoveryPanelVisible,
    importRevision: flow.importRevision,
    ...meta,
  };
  flow.log.push(entry);
  if (flow.log.length > 64) flow.log.shift();
}

/**
 * @param {string} reason
 */
export function isGateExitReason(reason) {
  return UI_FLOW_GATE_EXIT_REASONS.includes(String(reason || ''));
}

/**
 * @param {object} flow
 */
export function validateBlockedRecoveryInvariants(flow) {
  const violations = [];
  if (!isBlockedRecoveryFlow(flow)) return violations;
  if (flow.previewAllowed !== false) violations.push('previewAllowed_must_be_false');
  if (flow.templateRenderSkipped !== true) violations.push('templateRenderSkipped_must_be_true');
  return violations;
}

/**
 * @param {object} flow
 */
export function enforceBlockedRecoveryInvariants(flow) {
  const violations = validateBlockedRecoveryInvariants(flow);
  if (!violations.length) return { flow, violations: [] };
  flow.previewAllowed = false;
  flow.templateRenderSkipped = true;
  appendUiFlowLog(flow, 'INVARIANT_REPAIR', { violations });
  return { flow, violations };
}

/**
 * Enter preview_ready after an explicit gate-pass exit from blocked_recovery.
 * @param {object} flow
 * @param {string} reason
 * @param {object} [meta]
 */
export function enterPreviewReadyFromGate(flow, reason, meta = {}) {
  if (!flow) return flow;
  if (
    isBlockedRecoveryFlow(flow) &&
    !isGateExitReason(reason) &&
    !meta.allowGateExit
  ) {
    logIllegalTransition(
      flow,
      flow.current,
      UI_FLOW_STATES.PREVIEW_READY,
      reason,
      'gate_exit_without_reason'
    );
    return holdStickyBlockedRecovery(flow, { reason: 'gate_exit_rejected', issueHash: meta.issueHash });
  }
  flow.recoveryPanelHash = null;
  flow.recoveryPanelVisible = false;
  flow.renderGeneration = 0;
  flow.previewAllowed = true;
  flow.templateRenderSkipped = false;
  appendUiFlowLog(flow, 'GATE_EXIT', { reason, ...meta });
  return transitionUiFlow(flow, UI_FLOW_STATES.PREVIEW_READY, reason, {
    ...meta,
    allowGateExit: true,
  });
}

/**
 * Keep blocked_recovery terminal — passive render/sync must not clear it.
 * @param {object} flow
 * @param {object} input
 */
export function holdStickyBlockedRecovery(flow, input = {}) {
  flow.previewAllowed = false;
  flow.templateRenderSkipped = true;
  if (flow.current !== UI_FLOW_STATES.BLOCKED_RECOVERY) {
    transitionUiFlow(flow, UI_FLOW_STATES.BLOCKED_RECOVERY, input.reason || 'sticky_blocked_hold', {
      issueHash: input.issueHash || flow.issueHash,
    });
  } else {
    appendUiFlowLog(flow, 'STICKY_BLOCKED_HELD', {
      reason: input.reason || 'sync',
      issueHash: input.issueHash || flow.issueHash,
      gateBlocked: input.gateBlocked,
    });
  }
  enforceBlockedRecoveryInvariants(flow);
  return flow;
}

/**
 * Sync flow from recovery / gate evaluation (internal — use dispatchUiFlowSync).
 * @param {object} flow
 * @param {object} input
 */
export function syncUiFlowFromRecovery(flow, input = {}) {
  const report = input.report || null;
  const gate = input.previewGate || report?.previewGate || null;
  const blocked = !!(report?.blockRender || gate?.blockPremiumRender);
  const issueHash = input.issueHash || recoveryIssueHashFromReport(report);
  const resumeHash = input.resumeRevisionHash || flow.resumeRevisionHash || null;
  const allowGateExit = !!input.allowGateExit || isGateExitReason(input.reason);

  flow.issueHash = issueHash;
  if (resumeHash) flow.resumeRevisionHash = resumeHash;

  if (blocked) {
    flow.previewAllowed = false;
    flow.templateRenderSkipped = true;
    if (flow.current !== UI_FLOW_STATES.BLOCKED_RECOVERY) {
      transitionUiFlow(flow, UI_FLOW_STATES.BLOCKED_RECOVERY, input.reason || 'preview_gate_blocked', {
        issueHash,
      });
    }
    if (flow.blockedAtRevision == null) {
      flow.blockedAtRevision = flow.importRevision || 0;
    }
    flow.blockedIssueHash = issueHash;
    enforceBlockedRecoveryInvariants(flow);
    return flow;
  }

  if (isBlockedRecoveryFlow(flow) && !allowGateExit) {
    return holdStickyBlockedRecovery(flow, {
      reason: input.reason || 'sticky_blocked_sync',
      issueHash,
      gateBlocked: false,
    });
  }

  if (allowGateExit) {
    const out = enterPreviewReadyFromGate(flow, input.reason || 'preview_gate_pass', { issueHash });
    enforceBlockedRecoveryInvariants(out);
    return out;
  }

  flow.previewAllowed = true;
  flow.templateRenderSkipped = false;
  if (flow.current !== UI_FLOW_STATES.PREVIEW_READY) {
    transitionUiFlow(flow, UI_FLOW_STATES.PREVIEW_READY, input.reason || 'preview_gate_pass', {
      issueHash,
    });
  }
  return flow;
}

/**
 * Canonical dispatch — all UI flow transitions should go through this.
 * @param {object} flow
 * @param {object} input
 */
export function dispatchUiFlowSync(flow, input = {}) {
  if (!flow) return flow;
  if (input.importRevision != null && input.importRevision < (flow.importRevision || 0)) {
    logIllegalTransition(
      flow,
      flow.current,
      flow.current,
      input.reason || 'stale_import_revision',
      'stale_import_revision'
    );
    return flow;
  }
  syncUiFlowFromRecovery(flow, input);
  if (input.finalCommitRevision != null) {
    flow.finalCommitRevision = Math.max(flow.finalCommitRevision || 0, input.finalCommitRevision);
  }
  const { violations } = enforceBlockedRecoveryInvariants(flow);
  if (violations.length && typeof globalThis !== 'undefined') {
    try {
      globalThis.__HIRELY_UI_FLOW_INVARIANT_VIOLATIONS__ = violations;
    } catch {
      /* ignore */
    }
  }
  return flow;
}

/**
 * @param {object} flow
 */
export function isBlockedRecoveryFlow(flow) {
  return !!(flow && flow.current === UI_FLOW_STATES.BLOCKED_RECOVERY);
}

/**
 * @param {object} flow
 */
export function isPreviewRenderAllowed(flow) {
  return !!(flow && flow.previewAllowed && flow.current === UI_FLOW_STATES.PREVIEW_READY);
}

/**
 * @param {object} flow
 * @param {object} input
 */
export function shouldSkipCommit(flow, input = {}) {
  if (!isBlockedRecoveryFlow(flow)) return false;
  const commitHash = input.commitHash || null;
  if (!commitHash || !flow.lastCommitHash) return false;
  return commitHash === flow.lastCommitHash && !input.force && !input.forceCommit;
}

/**
 * Reject commits from an older import revision while blocked.
 * @param {object} flow
 * @param {object} input
 */
export function shouldRejectStaleCommit(flow, input = {}) {
  if (!isBlockedRecoveryFlow(flow)) return false;
  if (input.force || input.forceCommit) return false;
  const rev = input.importRevision;
  if (
    rev != null &&
    flow.blockedAtRevision != null &&
    rev < flow.blockedAtRevision
  ) {
    return true;
  }
  return shouldSkipCommit(flow, input);
}

/**
 * @param {object} flow
 * @param {object} input
 */
export function shouldSkipRecoveryPanelRender(flow, input = {}) {
  const hash = input.issueHash || flow.issueHash;
  if (!hash) return false;
  if (input.force) return false;
  return (
    flow.recoveryPanelHash === hash &&
    flow.recoveryPanelVisible === true &&
    isBlockedRecoveryFlow(flow)
  );
}

/**
 * @param {object} flow
 * @param {object} input
 */
export function shouldSkipBlockedPreviewRender(flow, input = {}) {
  if (!isBlockedRecoveryFlow(flow)) return false;
  const hash = input.issueHash || flow.issueHash;
  if (input.force) return false;
  return flow.issueHash === hash && flow.renderGeneration > 0;
}

/**
 * @param {object} flow
 * @param {string} [reason]
 */
export function recordTemplateRenderSuppressed(flow, reason = 'blocked_recovery') {
  if (!flow) return 0;
  flow.templateRenderSuppressedCount = (flow.templateRenderSuppressedCount || 0) + 1;
  flow.templateRenderSkipped = true;
  appendUiFlowLog(flow, 'TEMPLATE_RENDER_SUPPRESSED', { reason, count: flow.templateRenderSuppressedCount });
  return flow.templateRenderSuppressedCount;
}

/**
 * @param {object} flow
 */
export function markRecoveryPanelRendered(flow, issueHash, visible = true) {
  flow.recoveryPanelHash = issueHash;
  flow.recoveryPanelVisible = visible;
  if (visible && isBlockedRecoveryFlow(flow)) {
    enforceBlockedRecoveryInvariants(flow);
  }
  appendUiFlowLog(flow, 'RECOVERY_PANEL', { issueHash, visible });
}

/**
 * @param {object} flow
 */
export function markBlockedPreviewRendered(flow, issueHash) {
  flow.issueHash = issueHash || flow.issueHash;
  flow.renderGeneration = (flow.renderGeneration || 0) + 1;
  appendUiFlowLog(flow, 'BLOCKED_PREVIEW', { issueHash: flow.issueHash, generation: flow.renderGeneration });
}

/**
 * @param {object} flow
 */
export function markCommitCompleted(flow, commitHash, meta = {}) {
  flow.lastCommitHash = commitHash;
  bumpRevision(flow, 'finalCommit');
  appendUiFlowLog(flow, 'COMMIT', { commitHash, ...meta });
}

/**
 * @param {object} flow
 */
export function resetUiFlowForImport(flow, reason = 'new_import') {
  const prev = flow.current;
  bumpRevision(flow, 'import');
  flow.previous = prev;
  flow.current = UI_FLOW_STATES.EXTRACTING;
  flow.issueHash = null;
  flow.resumeRevisionHash = null;
  flow.lastCommitHash = null;
  flow.recoveryPanelHash = null;
  flow.recoveryPanelVisible = false;
  flow.previewAllowed = false;
  flow.templateRenderSkipped = false;
  flow.blockedAt = null;
  flow.blockedAtRevision = null;
  flow.blockedIssueHash = null;
  flow.renderGeneration = 0;
  flow.lastTransitionAt = new Date().toISOString();
  flow.lastTransitionReason = reason;
  appendUiFlowLog(flow, 'RESET', { reason, importRevision: flow.importRevision });
  return flow;
}

/**
 * @param {object} flow
 */
export function exitBlockedRecovery(flow, reason = 'user_action') {
  if (!UI_FLOW_EXPLICIT_BLOCKED_EXITS.includes(reason)) {
    logIllegalTransition(
      flow,
      flow.current,
      UI_FLOW_STATES.PARSED_READY,
      reason,
      'exit_without_explicit_reason'
    );
    return holdStickyBlockedRecovery(flow, { reason: 'exit_rejected' });
  }
  flow.recoveryPanelVisible = false;
  flow.recoveryPanelHash = null;
  flow.renderGeneration = 0;
  flow.blockedAt = null;
  flow.blockedAtRevision = null;
  flow.blockedIssueHash = null;
  appendUiFlowLog(flow, 'EXIT_BLOCKED', { reason });
  return transitionUiFlow(flow, UI_FLOW_STATES.PARSED_READY, reason, { explicitExit: true });
}

/**
 * @param {object} flow
 */
export function getUiFlowSnapshot(flow) {
  if (!flow) return null;
  const invariantViolations = validateBlockedRecoveryInvariants(flow);
  return {
    version: flow.version,
    current: flow.current,
    previous: flow.previous,
    issueHash: flow.issueHash,
    resumeRevisionHash: flow.resumeRevisionHash,
    lastCommitHash: flow.lastCommitHash,
    recoveryPanelVisible: flow.recoveryPanelVisible,
    previewAllowed: flow.previewAllowed,
    templateRenderSkipped: flow.templateRenderSkipped,
    templateRenderSuppressedCount: flow.templateRenderSuppressedCount || 0,
    renderGeneration: flow.renderGeneration,
    blockedAt: flow.blockedAt,
    blockedAtRevision: flow.blockedAtRevision,
    blockedIssueHash: flow.blockedIssueHash,
    importRevision: flow.importRevision,
    extractionRevision: flow.extractionRevision,
    parsingRevision: flow.parsingRevision,
    finalCommitRevision: flow.finalCommitRevision,
    illegalTransitionCount: flow.illegalTransitionCount || 0,
    lastIllegalTransition: flow.lastIllegalTransition || null,
    lastTransitionReason: flow.lastTransitionReason,
    stickyBlocked: isBlockedRecoveryFlow(flow),
    invariantViolations,
  };
}
