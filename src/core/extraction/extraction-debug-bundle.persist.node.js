/**
 * Node-only disk persistence for extraction debug bundles.
 * QA / CLI only — never import from browser-reachable modules.
 */

import fs from 'node:fs';
import path from 'node:path';

/**
 * @param {object} bundle
 * @param {string} outDir
 * @param {string} [slug]
 */
export async function persistExtractionDebugBundle(bundle, outDir, slug = 'extraction') {
  if (!outDir) return null;
  try {
    fs.mkdirSync(outDir, { recursive: true });
    const file = path.join(outDir, `${slug}-extraction-debug.json`);
    fs.writeFileSync(file, JSON.stringify(bundle, null, 2));
    return file;
  } catch {
    return null;
  }
}
