import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../public/vendor/three.module.js';

test('corona covers the sphere with one bounded instanced mesh and releases resources',async()=>{
  const source=await readFile(new URL('../public/globe-corona.js',import.meta.url),'utf8');
  const module=await import('data:text/javascript;base64,'+Buffer.from(source.replace("from 'three'",`from '${new URL('../public/vendor/three.module.js',import.meta.url).href}'`)).toString('base64'));
  const scene=new THREE.Scene(),corona=module.createGlobeCorona(scene);
  assert.equal(scene.children.length,1);
  const object=scene.children[0];assert.equal(object.geometry.instanceCount,1200);
  const normals=object.geometry.getAttribute('rayNormal');let min=1,max=-1;
  for(let i=0;i<normals.count;i++){min=Math.min(min,normals.getY(i));max=Math.max(max,normals.getY(i));}
  assert.ok(min<-.99&&max>.99);
  const camera=new THREE.PerspectiveCamera();camera.position.set(0,0,4.2);
  corona.update(camera,1,1,.8,'#62efc5',true);assert.equal(object.visible,true);
  corona.update(camera,2,1,.8,'#62efc5',false);assert.equal(object.visible,false);
  let disposed=0;object.geometry.addEventListener('dispose',()=>disposed++);object.material.addEventListener('dispose',()=>disposed++);
  corona.dispose();assert.equal(scene.children.length,0);assert.equal(disposed,2);
});