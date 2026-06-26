#!/usr/bin/env node
/**
 * UI flow state — blocked_recovery stability guards.
 */
import { readFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import {
  UI_FLOW_STATES,
  createUiFlowState,
  syncUiFlowFromRecovery,
  isBlockedRecoveryFlow,
  isPreviewRenderAllowed,
  shouldSkipCommit,
  shouldSkipRecoveryPanelRender,
  shouldSkipBlockedPreviewRender,
  markRecoveryPanelRendered,
  markBlockedPreviewRendered,
  markCommitCompleted,
  resetUiFlowForImport,
  exitBlockedRecovery,
  recoveryIssueHashFromReport,
  dispatchUiFlowSync,
  bumpRevision,
  recordTemplateRenderSuppressed,
  shouldRejectStaleCommit,
  validateBlockedRecoveryInvariants,
} from '../core/validation/ui-flow-state.js';
import { assessPreviewRenderGate } from '../core/validation/preview-render-gate.js';
import { fallbackRawTextCvData } from '../core/import/simple-import-mode.js';

const __dirname = dirname(fileURLToPath(import.meta.url));
const ROOT = join(__dirname, '../..');
const indexHtml = readFileSync(join(ROOT, 'index.html'), 'utf8');

let failed = 0;
function ok(c, m) {
  if (!c) {
    console.error('FAIL', m);
    failed++;
  } else console.log('OK', m);
}

const merged =
  'Yohann Azancot yoaz@hotmail.fr +33649434839 Experience Freelance Illustrator Education LISAA';
const blobCv = fallbackRawTextCvData(merged, merged);
const gate = assessPreviewRenderGate(blobCv, { rawTextLength: merged.length });
const report = {
  blockRender: true,
  showRecovery: true,
  silentFailurePrevented: true,
  previewGate: gate,
  detectedIssues: gate.issues.map((i) => ({ code: i.code, field: i.field })),
};

let flow = createUiFlowState();
syncUiFlowFromRecovery(flow, { report, reason: 'test_block' });
ok(flow.current === UI_FLOW_STATES.BLOCKED_RECOVERY, 'enters blocked_recovery once');
ok(!isPreviewRenderAllowed(flow), 'preview not allowed while blocked');
ok(isBlockedRecoveryFlow(flow), 'isBlockedRecoveryFlow true');

const hash = recoveryIssueHashFromReport(report);
markBlockedPreviewRendered(flow, hash);
markRecoveryPanelRendered(flow, hash, true);
ok(shouldSkipBlockedPreviewRender(flow, { issueHash: hash }), 'skips repeat blocked preview');
ok(shouldSkipRecoveryPanelRender(flow, { issueHash: hash }), 'skips repeat recovery panel');

// Sticky terminal: passive sync must not clear blocked_recovery when gate momentarily passes.
let stickyFlow = createUiFlowState();
bumpRevision(stickyFlow, 'import');
dispatchUiFlowSync(stickyFlow, { report, reason: 'test_block' });
dispatchUiFlowSync(stickyFlow, {
  report: { blockRender: false, previewGate: { blockPremiumRender: false, issues: [] } },
  reason: 'workspace_ready',
});
ok(stickyFlow.current === UI_FLOW_STATES.BLOCKED_RECOVERY, 'sticky holds blocked_recovery on passive sync');
ok(!stickyFlow.previewAllowed, 'sticky keeps preview disallowed');
ok(stickyFlow.templateRenderSkipped, 'sticky keeps template skipped');
ok(recordTemplateRenderSuppressed(stickyFlow, 'unit') >= 1, 'template suppression counter');

const staleFlow = createUiFlowState({ current: UI_FLOW_STATES.BLOCKED_RECOVERY, blockedAtRevision: 2, importRevision: 2 });
ok(shouldRejectStaleCommit(staleFlow, { importRevision: 1, commitHash: 'x' }), 'rejects stale import revision commit');
ok(validateBlockedRecoveryInvariants(stickyFlow).length === 0, 'blocked invariants valid');

markCommitCompleted(flow, 'rev-a');
ok(shouldSkipCommit(flow, { commitHash: 'rev-a' }), 'skips repeat commit same revision');
ok(!shouldSkipCommit(flow, { commitHash: 'rev-b' }), 'commit runs when revision changes');
ok(!shouldSkipCommit(flow, { commitHash: 'rev-a', force: true }), 'force commit bypasses skip');

resetUiFlowForImport(flow, 'new_import');
ok(flow.current === UI_FLOW_STATES.EXTRACTING, 'import resets to extracting');
ok(flow.renderGeneration === 0, 'render generation reset');

flow = createUiFlowState({ current: UI_FLOW_STATES.BLOCKED_RECOVERY });
const cleanGate = assessPreviewRenderGate(
  {
    name: 'Yohann Azancot',
    title: 'Designer',
    experience: [
      { role: 'A', company: 'B', dates: '2020', bullets: [] },
      { role: 'C', company: 'D', dates: '2018', bullets: [] },
    ],
    education: ['School'],
    skills: ['Design'],
  },
  { rawTextLength: 400, bridgeLocked: true }
);
syncUiFlowFromRecovery(flow, {
  report: { blockRender: false, previewGate: cleanGate },
  reason: 'after_commit',
  allowGateExit: true,
});
ok(flow.current === UI_FLOW_STATES.PREVIEW_READY, 'exits to preview_ready when gate passes with allowGateExit');
ok(isPreviewRenderAllowed(flow), 'preview allowed after gate pass');

exitBlockedRecovery(flow, 'user_action');
ok(flow.current === UI_FLOW_STATES.PARSED_READY, 'exitBlockedRecovery to parsed_ready');

ok(indexHtml.includes('renderBlockedRecoveryStable'), 'index blocked stable renderer');
ok(indexHtml.includes('isUiFlowBlockedRecovery'), 'index blocked recovery guard');
ok(indexHtml.includes('isPreviewRenderAllowed'), 'index preview allowed guard');
ok(indexHtml.includes('__HIRELY_UI_FLOW__'), 'index publishes ui flow debug');
ok(indexHtml.includes('COMMIT_SKIPPED'), 'index commit skip log');
ok(indexHtml.includes('RENDER_BLOCKED_STABLE'), 'index stable render log');
ok(indexHtml.includes('dispatchUiFlowSync'), 'index uses canonical dispatch');
ok(indexHtml.includes('TEMPLATE_RENDER_SUPPRESSED'), 'index template suppression instrumentation');
ok(indexHtml.includes('simulateGateExitUserFix'), 'index gate exit test helper');

if (failed) {
  console.error(`\n${failed} check(s) failed`);
  process.exit(1);
}
console.log('\nAll UI flow blocked recovery checks passed.');
