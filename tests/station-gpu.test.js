import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('station shader avoids the reserved GLSL active identifier',async()=>{
  const source=await readFile(new URL('../public/station-gpu.js',import.meta.url),'utf8');
  assert.doesNotMatch(source,/\b(?:bool|float|vec[234])\s+active\b/);
  assert.match(source,/bool isSelected=/);
});

test('station geometry remains instanced with static attributes',async()=>{
  const source=await readFile(new URL('../public/station-gpu.js',import.meta.url),'utf8');
  assert.match(source,/InstancedBufferGeometry/);
  assert.match(source,/geometry\.instanceCount=markers\.length/);
  assert.match(source,/stationColor/);
  assert.match(source,/rays\.visible=playing/);
});

test('dots and rays share static attributes and preserve their full instance count',async()=>{
  const source=await readFile(new URL('../public/station-gpu.js',import.meta.url),'utf8');
  assert.match(source,/Object\.entries\(attributes\).*geometry\.setAttribute\(name,attribute\)/);
  assert.match(source,/geometry\.instanceCount=markers\.length/);
  const globe=await readFile(new URL('../public/globe.js',import.meta.url),'utf8');
  assert.doesNotMatch(globe,/group\.add\(root\)|new THREE\.Mesh\(pointGeometry|new THREE\.Mesh\(columnGeometry/);
  assert.match(globe,/mapWorker\.terminate\(\)/);
});