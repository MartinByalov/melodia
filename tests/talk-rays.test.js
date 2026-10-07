import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import * as THREE from '../public/vendor/three.module.js';
import {visualProfile} from '../public/visual-styles.js';

test('Talk/News disables rays without hiding dots and restores music rays',async()=>{
  const source=await readFile(new URL('../public/station-gpu.js',import.meta.url),'utf8');
  const module=await import('data:text/javascript;base64,'+Buffer.from(source.replace("from 'three'",`from '${new URL('../public/vendor/three.module.js',import.meta.url).href}'`)).toString('base64'));
  const scene=new THREE.Scene(),gpu=module.createStationGPU(scene,[]);
  const [dots,rays]=scene.children,camera=new THREE.PerspectiveCamera();camera.position.set(0,0,4.2);camera.updateMatrixWorld();
  const update=time=>gpu.update(camera,time,1,1,-1,-1,.5,true,false,new Map(),true);
  gpu.setVisualProfile(visualProfile('techno'));update(1);assert.equal(rays.visible,true);
  for(const tags of ['talk','news','spoken word']){
    gpu.setVisualProfile(visualProfile(tags));assert.equal(rays.visible,false);update(2);
    assert.equal(rays.visible,false);assert.equal(dots.visible,true);
    gpu.setDiagnosticHidden(true);gpu.setDiagnosticHidden(false);assert.equal(rays.visible,false);
  }
  gpu.setVisualProfile(visualProfile('jazz'));update(3);assert.equal(rays.visible,true);
  gpu.dispose();assert.equal(scene.children.length,0);
});