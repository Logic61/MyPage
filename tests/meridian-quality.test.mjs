import {test} from 'node:test';
import assert from 'node:assert/strict';
import {initialQuality,pixelRatio,renderPreset} from '../src/scripts/meridian/quality.js';

test('an explicit preference takes precedence over the first-visit hardware default',()=>{
  assert.equal(initialQuality('high',2,2),'high');
  assert.equal(initialQuality('low',16,16),'low');
  assert.equal(initialQuality('obsolete',4,8),'low');
  assert.equal(initialQuality(null,undefined,2),'low');
  assert.equal(initialQuality(null,undefined,undefined),'medium');
  assert.equal(initialQuality('constructor',16,16),'medium');
});

test('each level has a distinct drawing buffer and respects its normal and optical budgets',()=>{
  for(const [width,height,dpr] of [[1000,650,1],[1920,1080,1],[390,844,3],[3840,2160,2]]){
    for(const lens of [false,true]){
      let previous=0;
      for(const level of ['low','medium','high']){
        const p=renderPreset(level),ratio=pixelRatio(p,width,height,dpr,lens);
        assert.ok(ratio>previous,level+' should increase resolution');
        assert.ok(Math.floor(width*ratio)*Math.floor(height*ratio)<=(lens?p.opticPixels:p.pixels));
        previous=ratio;
      }
    }
  }
});
