import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
const path=new URL('../core/extraction/ocr-pipeline.js',import.meta.url);
const src=readFileSync(path,'utf8');

test('OCR policy prevents all billable calls from canonical canvas entrypoints',()=>{
  assert.match(src,/export const HIRELY_FREE_OCR_ONLY = true;/);
  assert.match(src,/HIRELY_FREE_OCR_ONLY \? null : await tryVisionApi\(blob, opts\)/);
  assert.match(src,/!HIRELY_FREE_OCR_ONLY && !result\?\.text && cloudOcrConfigured\(\)/);
  assert.match(src,/if \(HIRELY_FREE_OCR_ONLY \|\| shouldSkipRemoteOcr\(\)\) return null;/);
});
test('both local OCR routes avoid expensive PNG serialization',()=>{
  const matches=src.match(/const blob = HIRELY_FREE_OCR_ONLY \? null :/g)||[];
  assert.equal(matches.length,2);
});
test('cloud-first behavior cannot occur when free-only guard is active',async()=>{
  let worker=0,remote=0,blobs=0;
  const script=src.replace(/^import [^\n]+\n/g,'').replace(/\bexport\s+/g,'');
  const factory=Function('ensureTesseract','recognizeCanvas','recognizeCanvasWithLines','tryCloudOcr','cloudOcrConfigured','hirelyDebugLog','logOcrPropagate','shouldSkipRemoteOcr',
    script+';return {runOcrOnCanvas,runOcrOnCanvasWithLines,tryVisionApi}');
  const mod=factory(
    async()=>{worker++;},
    async()=> 'Expérience formation 2022 contact@example.com',
    async()=>({text:'Expérience formation 2022',lines:[{text:'Expérience formation 2022',confidence:92}],words:[]}),
    async()=>{remote++;return 'paid';},
    ()=>{remote++;return true;},
    ()=>{},()=>{},()=>false
  );
  const canvas={toBlob(){blobs++;throw new Error('Must not serialize canvas')}};
  assert.equal((await mod.runOcrOnCanvas(canvas)).includes('Expérience'),true);
  const lines=await mod.runOcrOnCanvasWithLines(canvas);
  assert.equal(lines.provider,'tesseract');
  assert.equal(lines.lines.length,1);
  assert.equal(await mod.tryVisionApi(null),null);
  assert.equal(worker,2);
  assert.equal(remote,0);
  assert.equal(blobs,0);
});
