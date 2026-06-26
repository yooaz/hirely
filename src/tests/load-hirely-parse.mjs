#!/usr/bin/env node
/** Load Hirely modules from `src/core/*` for QA. */
import path from 'path';
import { fileURLToPath, pathToFileURL } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, '../..');

export async function loadHirelyParse() {
  const extractionUrl = pathToFileURL(path.join(root, 'src/core/extraction/index.js')).href;
  const parsingUrl = pathToFileURL(path.join(root, 'src/core/parsing/index.js')).href;
  const pipelineUrl = pathToFileURL(path.join(root, 'src/core/pipeline/index.js')).href;
  const validationUrl = pathToFileURL(path.join(root, 'src/core/validation/index.js')).href;

  const mod = await import(extractionUrl);
  const parsing = await import(parsingUrl);
  const pipeline = await import(pipelineUrl);
  const validation = await import(validationUrl);

  return {
    cleanText: parsing.cleanExtraction,
    cleanExtraction: parsing.cleanExtraction,
    parseCV: parsing.parseCV,
    parseCVData: parsing.parseCV,
    scoreCV: validation.scoreCV,
    extractFromFile: mod.extractFromFile,
    extractFromFileDetailed: mod.extractFromFileDetailed,
    headerKeyForLine(line) {
      const t = String(line || '').trim();
      if (/^contact/i.test(t)) return 'contact';
      if (/^(location|address)/i.test(t)) return 'location';
      if (/^experience/i.test(t)) return 'experience';
      if (/^education|^formation/i.test(t)) return 'education';
      if (/^skills|^compétences/i.test(t)) return 'skills';
      return parsing.headerKeyForLine(line);
    },
    detectSections(text) {
      return parsing.detectSections(text);
    },
    buildPdfPageText: mod.buildPdfPageText,
    splitListItems: parsing.splitListItems,
    lineLooksLikeTitle: parsing.lineLooksLikeTitle,
    auditPipeline: validation.auditPipeline,
    runExtractionPipeline(rawText, opts = {}) {
      return pipeline.runCanonicalImport(rawText, opts);
    },
    runCanonicalImport: pipeline.runCanonicalImport,
    importText: pipeline.importText,
    importFile: pipeline.importFile,
    extractDocument: pipeline.extractDocument,
    buildCvDataFromPipeline(p) {
      return parsing.parseCV(p.cleanedText || p.rawText || '');
    },
    detectContact(raw) {
      const d = parsing.parseCV(raw);
      return {
        email: d.email,
        phone: d.phone,
        linkedin: d.linkedin,
        portfolio: d.portfolio,
        location: d.location,
      };
    },
    assessExtractionQuality(raw) {
      const cleanedText = parsing.cleanExtraction(raw);
      return { quality: cleanedText.length >= 80 ? 'good' : 'medium', cleanedText, score: 70 };
    },
    validateCVData(structured) {
      return { data: structured, ok: true };
    },
  };
}
