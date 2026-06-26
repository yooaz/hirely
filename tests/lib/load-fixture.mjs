import fs from 'fs';
import path from 'path';

/**
 * Resolve fixture input: binary if present (metadata only in Node) else fixture.txt
 */
export function loadFixtureEntry(root, entry) {
  const dir = path.join(root, 'tests/fixtures', entry.id);
  const fallbackPath = path.join(dir, entry.fallback || 'fixture.txt');

  let binaryName = null;
  let binaryPath = null;
  for (const name of entry.binary || []) {
    const p = path.join(dir, name);
    if (fs.existsSync(p)) {
      binaryName = name;
      binaryPath = p;
      break;
    }
  }

  if (!fs.existsSync(fallbackPath)) {
    throw new Error(`Missing ${entry.id}/${entry.fallback || 'fixture.txt'}`);
  }

  const rawText = fs.readFileSync(fallbackPath, 'utf8');
  const fileName = binaryName || `${entry.id}/${entry.fallback || 'fixture.txt'}`;
  const mode = binaryName ? 'binary-present-fallback-text' : 'text-fallback';

  return {
    id: entry.id,
    dir,
    fileName,
    binaryPath,
    binaryName,
    mode,
    rawText,
    documentType: entry.documentType,
    expectedMethod: entry.expectedMethod,
  };
}
