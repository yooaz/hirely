import test from 'node:test';
import assert from 'node:assert/strict';
import apiOcr, {HIRELY_VISION_REMOTE_DISABLED} from '../../api/ocr.js';
import {
  HIRELY_REMOTE_OCR_DISABLED,cloudOcrConfigured,tryCloudOcr
} from '../core/extraction/cloud-ocr.js';
import {HIRELY_FREE_OCR_ONLY,tryVisionApi} from '../core/extraction/ocr-pipeline.js';

test('server OCR refuses POST with 503 before accessing billable Vision',async()=>{
  assert.equal(HIRELY_VISION_REMOTE_DISABLED,true);
  let status=0,response='';
  const res={
    status(n){status=n;return this},
    setHeader(){},
    end(text){response=String(text)}
  };
  await apiOcr({method:'POST'},res);
  assert.equal(status,503);
  assert.equal(JSON.parse(response).error,'REMOTE_OCR_DISABLED_USE_LOCAL_TESSERACT');
});

test('browser cloud routes reject configured providers without fetch',async()=>{
  assert.equal(HIRELY_REMOTE_OCR_DISABLED,true);
  assert.equal(HIRELY_FREE_OCR_ONLY,true);
  const oldUrl=globalThis.HIRELY_CLOUD_OCR_URL;
  const oldFetch=globalThis.fetch;
  const oldVisionUrl=globalThis.HIRELY_VISION_OCR_URL;
  let calls=0;
  try {
    globalThis.HIRELY_CLOUD_OCR_URL='https://example.test/billable';
    globalThis.HIRELY_VISION_OCR_URL='https://example.test/vision';
    globalThis.fetch=()=>{calls++;throw new Error('Remote transport forbidden in free-only OCR')};
    assert.equal(cloudOcrConfigured(),false);
    assert.equal(await tryCloudOcr({name:'scan.png'}),null);
    assert.equal(await tryVisionApi(null),null);
    assert.equal(calls,0);
  } finally {
    if(oldUrl===undefined)delete globalThis.HIRELY_CLOUD_OCR_URL;
    else globalThis.HIRELY_CLOUD_OCR_URL=oldUrl;
    if(oldVisionUrl===undefined)delete globalThis.HIRELY_VISION_OCR_URL;
    else globalThis.HIRELY_VISION_OCR_URL=oldVisionUrl;
    globalThis.fetch=oldFetch;
  }
});
