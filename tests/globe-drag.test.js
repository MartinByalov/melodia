import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import {rotationPerPixel,rotateCamera,installDragRotation} from '../public/globe-drag.js';

function makeCamera(distance=4.2){
  const camera=new THREE.PerspectiveCamera(40,1,.00001,100);
  camera.position.set(0,0,distance);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  return camera;
}
const screenX=(camera,point,size)=>(point.clone().project(camera).x+1)/2*size;
const screenY=(camera,point,size)=>(1-point.clone().project(camera).y)/2*size;

test('dragging right moves the surface under the cursor right by the same number of pixels',()=>{
  for(const distance of [1.05,1.5,4.2,6.5]){
    const camera=makeCamera(distance),size=800,point=new THREE.Vector3(0,0,1);
    rotateCamera(THREE,camera,40,0,rotationPerPixel(THREE,camera,size));
    assert.ok(Math.abs(screenX(camera,point,size)-440)<2.5,`distance ${distance}: ${screenX(camera,point,size)}`);
    assert.ok(Math.abs(screenY(camera,point,size)-400)<1e-6);
  }
});
test('dragging down moves the surface down by the same number of pixels',()=>{
  const camera=makeCamera(),size=800,point=new THREE.Vector3(0,0,1);
  rotateCamera(THREE,camera,0,-30,rotationPerPixel(THREE,camera,size));
  assert.ok(Math.abs(screenY(camera,point,size)-370)<2,`${screenY(camera,point,size)}`);
});
test('rotation keeps the camera on its orbit, facing the globe, with an orthonormal frame',()=>{
  const camera=makeCamera(3);
  for(let i=0;i<200;i++)rotateCamera(THREE,camera,13,-7,rotationPerPixel(THREE,camera,800));
  assert.ok(Math.abs(camera.position.length()-3)<1e-9);
  const forward=new THREE.Vector3(0,0,-1).applyQuaternion(camera.quaternion);
  assert.ok(forward.dot(camera.position.clone().normalize())<-.999999);
  assert.ok(Math.abs(camera.quaternion.length()-1)<1e-9);
  assert.ok(Math.abs(camera.up.length()-1)<1e-9);
});
test('the rotation step shrinks as the camera nears the surface',()=>{
  const near=rotationPerPixel(THREE,makeCamera(1.01),800),far=rotationPerPixel(THREE,makeCamera(4.2),800);
  assert.ok(near>0&&near<far/100);
});

class FakeCanvas{
  constructor(){this.listeners=new Map();this.captured=new Set();this.clientHeight=800;}
  addEventListener(type,fn){this.listeners.set(type,fn);}
  removeEventListener(type){this.listeners.delete(type);}
  setPointerCapture(id){this.captured.add(id);}
  hasPointerCapture(id){return this.captured.has(id);}
  releasePointerCapture(id){this.captured.delete(id);}
  fire(type,event){this.listeners.get(type)?.(event);}
}
test('only the left mouse button drags; touch stays with the trackball',()=>{
  const camera=makeCamera(),canvas=new FakeCanvas(),controls={mouseButtons:{LEFT:0,MIDDLE:1,RIGHT:2},update(){this.updated=(this.updated||0)+1;}};
  const drag=installDragRotation({THREE,camera,controls,canvas});
  assert.equal(controls.mouseButtons.LEFT,-1);
  const start=camera.position.clone();
  for(const event of [{pointerType:'touch',button:0},{pointerType:'mouse',button:2},{pointerType:'pen',button:0}]){
    canvas.fire('pointerdown',{pointerId:1,clientX:100,clientY:100,...event});
    canvas.fire('pointermove',{pointerId:1,clientX:200,clientY:150});
    assert.equal(drag.dragging(),false);
  }
  assert.ok(camera.position.equals(start));
  canvas.fire('pointerdown',{pointerId:2,pointerType:'mouse',button:0,clientX:100,clientY:100});
  assert.equal(drag.dragging(),true);assert.ok(canvas.captured.has(2));
  canvas.fire('pointermove',{pointerId:99,clientX:300,clientY:300});
  assert.ok(camera.position.equals(start),'another pointer must not move the globe');
  canvas.fire('pointermove',{pointerId:2,clientX:140,clientY:100});
  assert.ok(!camera.position.equals(start));
  const moved=camera.position.clone();
  canvas.fire('pointermove',{pointerId:2,clientX:140,clientY:100});
  assert.ok(camera.position.equals(moved),'no pointer movement means no rotation');
  canvas.fire('pointerup',{pointerId:2});
  assert.equal(drag.dragging(),false);assert.equal(canvas.captured.size,0);assert.equal(controls.updated,1);
  canvas.fire('pointermove',{pointerId:2,clientX:400,clientY:100});
  assert.ok(camera.position.equals(moved),'moves after release are ignored');
  drag.dispose();assert.equal(canvas.listeners.size,0);
});
