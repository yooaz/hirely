#!/usr/bin/env node
/**
 * Block parser bridge — production path uses spatial V2 parsers on Yoaz fixture.
 */
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { parseBenchmarkFixture } from '../../tests/lib/yoaz-pdf-benchmark-gate.mjs';

const root = join(dirname(fileURLToPath(import.meta.url)), '../..');

const parsed = await parseBenchmarkFixture(root);
const meta = parsed.pipeline?.structuredResume?.metadata || {};
const bridge =
  meta.blockParserBridgeApplied ||
  meta.blockParserApplied ||
  parsed.pipeline?.audit?.blockParserBridgeApplied ||
  parsed.resumeData?.meta?.blockParserBridgeApplied;

const failures = [];
if (!bridge) {
  failures.push('block parser bridge not applied in production pipeline');
}
const exp = parsed.resumeData?.experiences?.length || 0;
if (exp < 2) failures.push(`experiences: expected >= 2, got ${exp}`);
const edu = parsed.resumeData?.education?.length || 0;
if (edu < 3) failures.push(`education: expected >= 3, got ${edu}`);
const skills = [...(parsed.resumeData?.skills || []), ...(parsed.resumeData?.tools || [])];
if (skills.length < 4) failures.push(`skills/tools: expected >= 4, got ${skills.length}`);
const name = parsed.resumeData?.identity?.name || '';
if (!/yohann/i.test(name)) failures.push(`identity.name: expected Yohann, got "${name}"`);
const polluted = skills.some((s) => /nike|converse|pantone|adobe/i.test(s));
if (polluted) failures.push('client brands leaked into skills/tools');
const interestLines = [
  ...(parsed.resumeData?.unsorted || []),
  ...(parsed.importResult?.parseResponse?.interests || []),
];
const interestCount = interestLines.length;
if (interestCount < 5) failures.push(`interests/unsorted: expected >= 5, got ${interestCount}`);

console.log('\n=== BLOCK PARSER BRIDGE YOAZ (production) ===\n');
if (failures.length) {
  for (const f of failures) console.error(`✗ ${f}`);
  console.error('\nBLOCK_PARSER_BRIDGE_YOAZ_FAIL\n');
  process.exit(1);
}
console.log(`✓ bridge applied | exp ${exp} edu ${edu} skills ${skills.length}`);
console.log(`✓ identity: ${name}`);
console.log('\nBLOCK_PARSER_BRIDGE_YOAZ OK\n');
