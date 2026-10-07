import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import * as THREE from '../public/vendor/three.module.js';

const source=await readFile(new URL('../public/station-layout.js',import.meta.url),'utf8');
const module=await import('data:text/javascript;base64,'+Buffer.from(source.replace("from 'three'",`from '${new URL('../public/vendor/three.module.js',import.meta.url).href}'`)).toString('base64'));
function marker(){const normal=new THREE.Vector3(0,0,1),root=new THREE.Group();root.position.copy(normal).multiplyScalar(1.00004);return {normal,geoNormal:normal.clone(),root,inverseRotation:new THREE.Quaternion()};}

test('one-time overlap separation stays on the sphere and preserves geographic normals',()=>{
  const markers=Array.from({length:30},marker);
  module.spreadStationMarkers(markers);
  for(let i=0;i<markers.length;i++){
    assert.deepEqual(markers[i].geoNormal.toArray(),[0,0,1]);
    assert.ok(Math.abs(markers[i].root.position.length()-1.00004)<1e-9);
    for(let j=0;j<i;j++)assert.ok(markers[i].normal.distanceTo(markers[j].normal)>=.0005);
  }
  const positions=markers.map(m=>m.normal.toArray());
  module.spreadStationMarkers(markers);
  assert.deepEqual(markers.map(m=>m.normal.toArray()),positions);
});

test('animation does not recalculate marker layout or upload positions',async()=>{
  const globe=await readFile(new URL('../public/globe.js',import.meta.url),'utf8');
  const gpu=await readFile(new URL('../public/station-gpu.js',import.meta.url),'utf8');
  assert.equal((globe.match(/spreadStationMarkers\(markers\)/g)||[]).length,1);
  assert.ok(globe.indexOf('spreadStationMarkers(markers)')<globe.indexOf('stationGPU=createStationGPU'));
  assert.doesNotMatch(globe,/stationLayout\?\.|updatePositions/);
  assert.doesNotMatch(gpu,/stationNormal\.needsUpdate/);
});

test('zoom point growth is gently increased and bounded',()=>{
  assert.equal(module.pointGrowth(3.2),1);
  assert.ok(module.pointGrowth(.2)>module.pointGrowth(1));
  assert.ok(module.pointGrowth(.0008)<=4.5);
});