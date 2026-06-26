
import { readFileSync } from 'node:fs';
import { runSectionEngineV2 } from './src/core/parsing/section-engine-v2.js';
const raw = readFileSync('./tests/fixtures/yoaz-cv/fixture.txt','utf8');
const res = runSectionEngineV2(raw,{rawText:raw, extractionMethod:'paste'});
console.log(JSON.stringify({
  identity: res.structured?.identity,
  bridgeApplied: res.structured?.metadata?.blockParserBridgeApplied,
  parseSource: res.structured?.metadata?.parseSource,
  nameCandidates: res.structured?.nameCandidates,
  titleCandidates: res.structured?.titleCandidates,
  selectedName: res.structured?.selectedName,
  identitySources: res.structured?.identitySources,
},null,2));
