import test from 'node:test';
import assert from 'node:assert/strict';
import {createEffectScenes,scenesForStyle} from '../public/effect-scenes.js';
import {STYLE_PATTERNS} from '../public/visual-styles.js';
import {readFile} from 'node:fs/promises';

test('sphere designs are removed while loading tiles and country colors remain',async()=>{
  const globe=await readFile(new URL('../public/globe.js',import.meta.url),'utf8');
  assert.doesNotMatch(globe,/surfaceMode|loadingTiles|effectState.surface/);
  assert.match(globe,/if\(\(loadingWorld\|\|discoMode\)\|\|globeEntrance.completion<1\)earth.material=entranceEarthMaterial/);
  const regions=await readFile(new URL('../public/region-colors.js',import.meta.url),'utf8');
  assert.match(regions,/region.r\+time\*\.006/);
  assert.match(regions,/mix\(theme,palette,diversity\*\.85\)/);
});

test('every style has several bounded shader scenes and quiet styles exclude helixes',()=>{
  for(const style of Object.keys(STYLE_PATTERNS)){
    const scenes=scenesForStyle(style);assert.ok(scenes.length>=3);
    for(const [ray,surface,map] of scenes){assert.ok(ray>=0&&ray<=12);assert.ok(surface>=0&&surface<=5);assert.ok(map>=0&&map<=2);}
  }
  assert.ok(scenesForStyle('classical').every(scene=>scene[0]!==3));
});

test('energetic scenes retain corona and ray designs but never change sphere coverage',()=>{
  const scenes=scenesForStyle('techno');
  for(const mode of [4,5,6,7,8,9,10,11,12])assert.ok(scenes.some(scene=>scene[0]===mode));
  for(const style of Object.keys(STYLE_PATTERNS))assert.ok(scenesForStyle(style).every(scene=>scene[1]===0));
  assert.ok(scenesForStyle('classical').every(scene=>scene[0]!==6));
});
test('scenes have long normal intervals, smooth fades and disable on pause',()=>{
  const controller=createEffectScenes();controller.reset('techno');
  for(let i=0;i<880;i++)assert.equal(controller.update(.1,true).mix,0);
  let peak=0,previous=0;
  for(let i=0;i<280;i++){
    const value=controller.update(.1,true).mix;
    assert.ok(Math.abs(value-previous)<.08);previous=value;peak=Math.max(peak,value);
  }
  assert.equal(peak,1);
  assert.equal(controller.update(.1,false).mix,0);
  controller.reset('ambient');
  for(let i=0;i<1700;i++)assert.equal(controller.update(.1,true).mix,0);
});