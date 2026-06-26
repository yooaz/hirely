// Minimal shims for importing existing JavaScript modules from TypeScript.
// This repo is primarily JS runtime; we only want contract-level typechecking.
declare module '*.js' {
  const _default: any;
  export default _default;

  // Common named exports used in the backend pipeline.
  export const extractNativePdfLines: any;
  export const extractDocxTextFromBuffer: any;
  export const ocrPdfDocument: any;
}

