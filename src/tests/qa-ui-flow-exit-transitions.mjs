#!/usr/bin/env node
/**
 * blocked_recovery exit transitions — unit proof.
 */
import {
  UI_FLOW_STATES,
  createUiFlowState,
  syncUiFlowFromRecovery,
  dispatchUiFlowSync,
  exitBlockedRecovery,
  enterPreviewReadyFromGate,
  holdStickyBlockedRecovery,
  isBlockedRecoveryFlow,
  isPreviewRenderAllowed,
  recordTemplateRenderSuppressed,
  shouldRejectStaleCommit,
  validateBlockedRecoveryInvariants,
  bumpRevision,
} from '../core/validation/ui-flow-state.js';
import { assessPreviewRenderGate } from '../core/validation/preview-render-gate.js';

let failed = 0;
const ok = (c, m) => {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
};

const blockedReport = {
  blockRender: true,
  showRecovery: true,
  previewGate: assessPreviewRenderGate(
    { name: '', experience: [{ role: 'A', company: 'B', dates: '2020', bullets: [] }], skills: ['X'] },
    { rawTextLength: 400 }
  ),
  detectedIssues: [{ code: 'unsafe_name', field: 'name' }],
};

const cleanCv = {
  name: 'Yohann Azancot',
  title: 'Designer',
  experience: [
    { role: 'A', company: 'B', dates: '2020', bullets: [] },
    { role: 'C', company: 'D', dates: '2018', bullets: [] },
  ],
  education: ['School'],
  skills: ['Design'],
};
const cleanGate = assessPreviewRenderGate(cleanCv, { rawTextLength: 400, bridgeLocked: true });

// Enter blocked
let flow = createUiFlowState();
bumpRevision(flow, 'import');
dispatchUiFlowSync(flow, { report: blockedReport, reason: 'gate_blocked' });
ok(flow.current === UI_FLOW_STATES.BLOCKED_RECOVERY, 'enters blocked_recovery');

// Passive render — stay blocked
dispatchUiFlowSync(flow, {
  report: { blockRender: false, previewGate: cleanGate },
  reason: 'workspace_ready',
});
ok(flow.current === UI_FLOW_STATES.BLOCKED_RECOVERY, 'passive workspace_ready stays blocked');
ok(!isPreviewRenderAllowed(flow), 'preview disallowed while blocked');

// Identical issue hash rerender — stay blocked
const hash = flow.issueHash;
holdStickyBlockedRecovery(flow, { reason: 'rerender', issueHash: hash });
ok(flow.current === UI_FLOW_STATES.BLOCKED_RECOVERY, 'identical issue hash stays blocked');

// Template suppression invariant
const sup = recordTemplateRenderSuppressed(flow, 'test');
ok(sup >= 1, 'template suppression recorded');
ok(flow.templateRenderSkipped === true, 'templateRenderSkipped invariant');

// Stale commit rejected
ok(
  shouldRejectStaleCommit(flow, { commitHash: flow.lastCommitHash, importRevision: 0 }),
  'stale import revision commit rejected'
);

// Illegal implicit exit to parsed_ready rejected
const beforeIllegal = flow.illegalTransitionCount || 0;
exitBlockedRecovery(flow, 'workspace_ready');
ok(flow.current === UI_FLOW_STATES.BLOCKED_RECOVERY, 'implicit parsed_ready exit rejected');
ok((flow.illegalTransitionCount || 0) > beforeIllegal, 'illegal transition logged');

// Explicit partial continue exits to parsed_ready
exitBlockedRecovery(flow, 'continue_partial');
ok(flow.current === UI_FLOW_STATES.PARSED_READY, 'continue_partial exits to parsed_ready');

// Gate pass exit to preview_ready
flow = createUiFlowState();
bumpRevision(flow, 'import');
dispatchUiFlowSync(flow, { report: blockedReport, reason: 'gate_blocked' });
dispatchUiFlowSync(flow, {
  report: { blockRender: false, previewGate: cleanGate },
  reason: 'gate_pass_user_fix',
  allowGateExit: true,
});
ok(flow.current === UI_FLOW_STATES.PREVIEW_READY, 'gate exit -> preview_ready');
ok(isPreviewRenderAllowed(flow), 'preview allowed after gate exit');
ok(validateBlockedRecoveryInvariants(flow).length === 0, 'no blocked invariants after exit');

// Reextract success path
flow = createUiFlowState();
bumpRevision(flow, 'import');
dispatchUiFlowSync(flow, { report: blockedReport, reason: 'gate_blocked' });
enterPreviewReadyFromGate(flow, 'reextract_success', { allowGateExit: true });
ok(flow.current === UI_FLOW_STATES.PREVIEW_READY, 'reextract_success -> preview_ready');

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll UI flow exit transition checks passed.');
