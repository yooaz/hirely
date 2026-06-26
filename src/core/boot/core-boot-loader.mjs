/**
 * P0 — Browser core boot loader with per-step trace and emergency fallback.
 */

import { assessCoreModule, featureUnavailableMessage } from './boot-contract.mjs';
import { buildMinimalImportCore } from './minimal-import-core.mjs';

/**
 * @param {{ onStep?: (step: object) => void }} [opts]
 */
function isBootDebugUrl() {
  try {
    const q = new URLSearchParams(globalThis.location?.search || '').get('debug');
    return q === 'true' || q === '1' || q === 'forensic';
  } catch {
    return false;
  }
}

export async function loadHirelyCoreForBrowser(opts = {}) {
  const trace = { steps: [], startedAt: new Date().toISOString() };
  const log = (step) => {
    const entry = { ...step, at: new Date().toISOString() };
    trace.steps.push(entry);
    opts.onStep?.(entry);
    if (isBootDebugUrl() && typeof console !== 'undefined') {
      const tag = step.status === 'failed' ? 'error' : 'log';
      const fn = console[tag] || console.log;
      fn.call(console, `[CORE_BOOT] ${step.phase || 'step'}`, step.module || step.status || '', step.error || '');
      if (step.status === 'failed' && step.stack) console.error(step.stack);
    }
  };

  log({ phase: 'BOOT_START', status: 'ok' });

  let rootError = null;

  try {
    log({ phase: 'CORE_BOOT', module: 'src/core/index.js', status: 'loading' });
    const bust =
      typeof globalThis.__HIRELY_CORE_BOOT_BUST__ === 'string'
        ? globalThis.__HIRELY_CORE_BOOT_BUST__
        : '20260618-pdf-ocr-cache-facade-full';
    const full = await import(`../index.js?v=${bust}`);
    const assessment = assessCoreModule(full);
    trace.assessment = assessment;
    log({
      phase: 'CORE_BOOT',
      module: 'src/core/index.js',
      status: assessment.importOk ? 'loaded' : 'incomplete',
      tier: assessment.tier,
      missingRequired: assessment.missingRequired,
      missingOptional: assessment.missingOptional,
    });
    if (assessment.importOk) {
      if (typeof full.bootCore === 'function') {
        try {
          await full.bootCore();
        } catch (bootErr) {
          rootError = bootErr;
          log({
            phase: 'CORE_BOOT',
            module: 'src/core/index.js:bootCore',
            status: 'failed',
            error: bootErr?.message || String(bootErr),
            stack: bootErr?.stack || null,
          });
          throw bootErr;
        }
      }
      return { module: full, trace, assessment, tier: assessment.tier, degraded: assessment.degraded };
    }
    rootError = new Error(
      assessment.missingRequired.length
        ? `missing_required:${assessment.missingRequired.join(',')}`
        : 'core_modules_incomplete'
    );
  } catch (err) {
    rootError = err;
    log({
      phase: 'CORE_BOOT',
      module: 'src/core/index.js',
      status: 'failed',
      error: err?.message || String(err),
      stack: err?.stack || null,
    });
  }

  try {
    log({ phase: 'CORE_BOOT', module: 'src/core/boot/minimal-import-core.mjs', status: 'loading' });
    const minimal = await buildMinimalImportCore();
    const assessment = assessCoreModule(minimal);
    trace.assessment = assessment;
    trace.rootError = rootError
      ? { message: rootError?.message || String(rootError), stack: rootError?.stack || null }
      : null;
    log({
      phase: 'CORE_BOOT',
      module: 'src/core/boot/minimal-import-core.mjs',
      status: assessment.importOk ? 'loaded' : 'failed',
      tier: 'minimal',
    });
    if (!assessment.importOk) {
      throw rootError || new Error('minimal_import_core_failed');
    }
    return {
      module: minimal,
      trace,
      assessment,
      tier: 'minimal',
      degraded: true,
      rootError,
    };
  } catch (err) {
    log({
      phase: 'CORE_BOOT',
      module: 'src/core/boot/minimal-import-core.mjs',
      status: 'failed',
      error: err?.message || String(err),
      stack: err?.stack || null,
    });
    throw rootError || err;
  }
}

export { assessCoreModule, featureUnavailableMessage };
