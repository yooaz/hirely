/**
 * CV Pipeline — barrel export.
 */
export { createCvPipeline, CV_PIPELINE_VERSION, parseExperiencesAlgorithmReference } from './pipeline/parse-cv.js';
export type { CvPipeline, CvPipelineServices, ParseCvResult } from './pipeline/stages.js';
export type * from './types/index.js';
