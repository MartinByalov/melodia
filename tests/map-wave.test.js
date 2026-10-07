import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {installMapWave} from '../public/map-wave.js';
test('spatial map wave patches both line stages without altering endpoint attributes',async()=>{
  const source=await readFile(new URL('../public/vendor/LineMaterial.js',import.meta.url),'utf8');
  const material={color:{clone:()=>({})},uniforms:{},vertexShader:source,fragmentShader:source};
  const uniforms=installMapWave(material);
  assert.match(material.vertexShader,/mapLatitude = mix\(instanceStart.y,instanceEnd.y/);
  assert.match(material.fragmentShader,/band\*waveStrength/);
  assert.equal(uniforms.waveStrength.value,0);
  assert.match(material.vertexShader,/attribute vec3 instanceStart/);
});