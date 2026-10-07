import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../public/vendor/three.module.js';

test('worms keep instancing and straighten smoothly on planet hover or reduced motion',async()=>{
  const source=await readFile(new URL('../public/station-gpu.js',import.meta.url),'utf8');
  assert.match(source,/ray\?6:1/);
  assert.match(source,/playing&&!planetHovered&&!reduced/);
  assert.match(source,/wormTarget-uniforms.worm.value/);
  assert.match(source,/bend\*along\*\.12/);
  assert.match(source,/side\*shape\*height\*worm/);
  const geometry=new THREE.PlaneGeometry(.0036,1,1,6);
  assert.equal(geometry.index.count/3,12);
  geometry.dispose();
});

test('region mask preserves holes and uses a single static texture with GPU wave color',async()=>{
  const source=await readFile(new URL('../public/region-colors.js',import.meta.url),'utf8');
  assert.match(source,/countries.geojson/);
  assert.match(source,/ctx.fill\('evenodd'\)/);
  assert.match(source,/\[-1024,0,1024\]/);
  assert.equal((source.match(/texture.needsUpdate=true/g)||[]).length,1);
  assert.match(source,/abort.abort\(\)/);
  assert.match(source,/texture.dispose\(\)/);
  assert.doesNotMatch(source,/requestAnimationFrame|setInterval/);
  const globe=await readFile(new URL('../public/globe.js',import.meta.url),'utf8');
  assert.match(globe,/regionColors.dispose\(\)/);
  assert.match(globe,/audioReaction.available,globeHovered/);
});