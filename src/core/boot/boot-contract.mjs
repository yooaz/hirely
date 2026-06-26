/**
 * P0 — Core boot contract: required vs optional feature surfaces.
 * Missing optional features degrade gracefully; only import_core is fatal.
 */

export const CORE_BOOT_CONTRACT_V1 = 'CORE_BOOT_CONTRACT_V1';

/** @typedef {{ id: string, label: string, required: boolean, exports: string[], module?: string }} CoreBootFeature */

/** @type {CoreBootFeature[]} */
export const CORE_BOOT_FEATURES = Object.freeze([
  {
    id: 'import_core',
    label: 'Import pipeline',
    required: true,
    exports: ['runHirelyImportFromText', 'resumeDataMeetsImportMinimum'],
    module: 'src/core/pipeline/hirely-import.js',
  },
  {
    id: 'file_import',
    label: 'File import',
    required: false,
    exports: ['canonicalImportFromFile'],
    module: 'src/core/import/canonical-import.js',
  },
  {
    id: 'review_queue',
    label: 'Review queue',
    required: false,
    exports: ['buildReviewQueue'],
    module: 'src/core/parsing/review-queue.js',
  },
  {
    id: 'fact_extraction',
    label: 'Fact extraction',
    required: false,
    exports: ['extractFactsFromSectionBlocks', 'runFactPipeline'],
    module: 'src/core/parsing/fact-pipeline.js',
  },
  {
    id: 'section_engine',
    label: 'Section engine',
    required: false,
    exports: ['runSectionEngineV2'],
    module: 'src/core/parsing/section-engine-v2.js',
  },
  {
    id: 'resume_graph',
    label: 'Resume graph',
    required: false,
    exports: ['runResumeGraphEngine'],
    module: 'src/core/parsing/resume-graph-engine.js',
  },
  {
    id: 'identity_extraction',
    label: 'Identity extraction',
    required: false,
    exports: ['extractLockedIdentity', 'resolveIdentityContact'],
    module: 'src/core/parsing/identity-extraction.js',
  },
  {
    id: 'ocr_pipeline',
    label: 'OCR pipeline',
    required: false,
    exports: ['runOcrOnCanvas', 'canonicalImportFromFile'],
    module: 'src/core/extraction/ocr-pipeline.js',
  },
]);

export const CORE_BOOT_STARTUP_CHAIN = Object.freeze([
  'BOOT_START',
  'CORE_BOOT',
  'TEMPLATE_REGISTRY_READY',
  'IMPORT_UI_READY',
]);

/**
 * @param {Record<string, unknown>} mod
 */
export function assessCoreModule(mod) {
  const features = {};
  const missingRequired = [];
  const missingOptional = [];
  const unavailable = [];

  for (const feat of CORE_BOOT_FEATURES) {
    const present = [];
    const absent = [];
    for (const name of feat.exports) {
      if (mod && typeof mod[name] === 'function') present.push(name);
      else absent.push(name);
    }
    const ok = present.length > 0;
    features[feat.id] = { ok, present, absent, required: feat.required, label: feat.label };
    if (!ok) {
      if (feat.required) missingRequired.push(feat.id);
      else missingOptional.push(feat.id);
      unavailable.push(feat.id);
    } else if (absent.length) {
      missingOptional.push(feat.id);
    }
  }

  const importOk = features.import_core?.ok === true && !mod?.__hirelyFallback;
  const tier = importOk ? (missingOptional.length ? 'degraded' : 'full') : mod?.__hirelyBootTier || 'failed';

  return {
    contract: CORE_BOOT_CONTRACT_V1,
    importOk,
    tier,
    features,
    missingRequired,
    missingOptional,
    unavailable,
    degraded: importOk && unavailable.length > 0,
    fatal: !importOk,
  };
}

/**
 * @param {string} featureId
 */
export function featureUnavailableMessage(featureId) {
  const feat = CORE_BOOT_FEATURES.find((f) => f.id === featureId);
  const label = feat?.label || featureId;
  return `Feature unavailable: ${label} failed`;
}
