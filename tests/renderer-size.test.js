import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { fitRenderer } from '../public/renderer-size.js';

test('fractional DPR viewport never exceeds the drawing buffer',()=>{
  for(const ratio of [1,1.25,1.5,2,4])for(const size of [[391,843],[797,389],[0,0]]){
    const gl={},renderer={
      getPixelRatio:()=>ratio,getContext:()=>gl,
      setSize(w,h){gl.drawingBufferWidth=Math.floor(w*ratio);gl.drawingBufferHeight=Math.floor(h*ratio);},
      setViewport(x,y,w,h){assert.equal(Math.round(w*ratio),gl.drawingBufferWidth);assert.equal(Math.round(h*ratio),gl.drawingBufferHeight);}
    };
    fitRenderer(renderer,...size);
  }
});

test('dialog sky reuses its context and stops rendering while closed',async()=>{
  const [sky,info,globe]=await Promise.all(['dialog-sky.js','site-info.js','globe.js'].map(name=>readFile(new URL('../public/'+name,import.meta.url),'utf8')));
  assert.doesNotMatch(sky,/forceContextLoss/);
  assert.ok(sky.includes('if(disposed||!dialog.open){frame=0;return;}'));
  assert.ok(info.includes("dialog.addEventListener('close',()=>sky?.pause())"));
  assert.ok(info.includes('if(sky){sky.resume();return;}'));
  assert.ok(sky.includes('fitRenderer(renderer, width, height, false)'));
  assert.ok(globe.includes('fitRenderer(renderer,w,h)'));
});