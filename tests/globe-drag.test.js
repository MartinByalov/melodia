import test from 'node:test';
import assert from 'node:assert/strict';
import * as THREE from '../public/vendor/three.module.js';
import {rotationPerPixel,rotateCamera,installDragRotation,surfacePoint,DRAG_GAIN,DRAG_SMOOTHING} from '../public/globe-drag.js';

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
  getBoundingClientRect(){return {left:0,top:0,width:800,height:800};}
  addEventListener(type,fn){this.listeners.set(type,fn);}
  removeEventListener(type){this.listeners.delete(type);}
  setPointerCapture(id){this.captured.add(id);}
  hasPointerCapture(id){return this.captured.has(id);}
  releasePointerCapture(id){this.captured.delete(id);}
  fire(type,event){this.listeners.get(type)?.(event);}
}
test('the left mouse button and one finger drag; other buttons and a second finger do not',()=>{
  const camera=makeCamera(),canvas=new FakeCanvas(),controls={mouseButtons:{LEFT:0,MIDDLE:1,RIGHT:2},update(){this.updated=(this.updated||0)+1;}};
  const drag=installDragRotation({THREE,camera,controls,canvas});
  assert.equal(controls.mouseButtons.LEFT,-1);assert.equal(controls.noRotate,true);
  const start=camera.position.clone();
  canvas.fire('pointerdown',{pointerId:1,pointerType:'mouse',button:2,clientX:100,clientY:100});
  canvas.fire('pointermove',{pointerId:1,clientX:200,clientY:150});
  assert.equal(drag.dragging(),false);assert.ok(camera.position.equals(start));
  canvas.fire('pointerdown',{pointerId:2,pointerType:'mouse',button:0,clientX:100,clientY:100});
  assert.equal(drag.dragging(),true);assert.ok(canvas.captured.has(2));
  canvas.fire('pointermove',{pointerId:99,clientX:300,clientY:300});
  assert.ok(camera.position.equals(start),'another pointer must not move the globe');
  canvas.fire('pointermove',{pointerId:2,clientX:140,clientY:100});
  drag.update();
  assert.ok(!camera.position.equals(start));
  const moved=camera.position.clone();
  canvas.fire('pointermove',{pointerId:2,clientX:140,clientY:100});
  drag.update();
  assert.ok(camera.position.equals(moved),'no pointer movement means no rotation');
  canvas.fire('pointerup',{pointerId:2});
  assert.equal(drag.dragging(),false);assert.equal(canvas.captured.size,0);drag.update();assert.equal(controls.updated,1);
  canvas.fire('pointermove',{pointerId:2,clientX:400,clientY:100});
  drag.update();
  assert.ok(camera.position.equals(moved),'moves after release are ignored');
  // One finger turns the globe as far as the same drag with the mouse.
  const mouseCamera=makeCamera(),mouseCanvas=new FakeCanvas();
  const mouseDrag=installDragRotation({THREE,camera:mouseCamera,controls:{mouseButtons:{},update(){}},canvas:mouseCanvas});
  mouseCanvas.fire('pointerdown',{pointerId:1,pointerType:'mouse',button:0,clientX:100,clientY:100});mouseCanvas.fire('pointermove',{pointerId:1,clientX:160,clientY:100});mouseDrag.update();
  const fingerCamera=makeCamera(),fingerCanvas=new FakeCanvas();
  const fingerDrag=installDragRotation({THREE,camera:fingerCamera,controls:{mouseButtons:{},update(){}},canvas:fingerCanvas});
  fingerCanvas.fire('pointerdown',{pointerId:7,pointerType:'touch',button:0,clientX:100,clientY:100});fingerCanvas.fire('pointermove',{pointerId:7,clientX:160,clientY:100});fingerDrag.update();
  assert.ok(fingerCamera.position.distanceTo(mouseCamera.position)<1e-12);
  // A second finger ends the rotation so a pinch only zooms.
  fingerCanvas.fire('pointerdown',{pointerId:8,pointerType:'touch',button:0,clientX:300,clientY:100});
  const held=fingerCamera.position.clone();
  fingerCanvas.fire('pointermove',{pointerId:7,clientX:260,clientY:100});
  fingerDrag.update();
  assert.ok(fingerCamera.position.equals(held),'pinch must not rotate');
  drag.dispose();assert.equal(canvas.listeners.size,0);
});

test('with a gain of 1 the surface point that was grabbed stays under the pointer, also near the edge of the globe',()=>{
  for(const distance of [1.3,3,6]){
    const camera=makeCamera(distance),canvas=new FakeCanvas();
    const drag=installDragRotation({THREE,camera,controls:{mouseButtons:{},update(){}},canvas,gain:1});
    // The north point of the globe is grabbed and dragged down the upper left of the outline.
    const radius=400*Math.tan(Math.asin(1/distance))/Math.tan(THREE.MathUtils.degToRad(20))*.9,start=surfacePoint(THREE,camera,canvas,400,400-radius);
    assert.ok(start.onGlobe,'grab point is on the globe');
    const grabbed=start.point.clone();
    canvas.fire('pointerdown',{pointerId:1,pointerType:'mouse',button:0,clientX:400,clientY:400-radius});
    for(let step=1;step<=12;step++){
      const angle=step*Math.PI/24,x=400-radius*Math.sin(angle),y=400-radius*Math.cos(angle);
      canvas.fire('pointermove',{pointerId:1,clientX:x,clientY:y});
      drag.update();
      const projected=grabbed.clone().project(camera);
      assert.ok(Math.abs((projected.x+1)/2*800-x)<1e-3&&Math.abs((1-projected.y)/2*800-y)<1e-3,'distance '+distance+' step '+step);
      assert.ok(grabbed.dot(camera.position)>1,'the grabbed point faces the camera');
    }
    assert.ok(Math.abs(camera.position.length()-distance)<1e-9);
  }
});

const turnedBy=(options,frames)=>{
  const camera=makeCamera(3),canvas=new FakeCanvas(),drag=installDragRotation({THREE,camera,controls:{mouseButtons:{},update(){}},canvas,...options});
  const start=camera.position.clone().normalize(),angle=()=>start.angleTo(camera.position.clone().normalize());
  canvas.fire('pointerdown',{pointerId:1,pointerType:'mouse',button:0,clientX:400,clientY:400});
  for(let step=1;step<=6;step++)canvas.fire('pointermove',{pointerId:1,clientX:400+step*20,clientY:400});
  const samples=[];
  for(let frame=0;frame<frames;frame++){drag.update(16);samples.push(angle());}
  canvas.fire('pointerup',{pointerId:1});
  for(let frame=0;frame<80;frame++)drag.update(16);
  return {samples,final:angle(),camera,drag};
};

test('the globe turns at a calm fraction of the pointer speed',()=>{
  const full=turnedBy({gain:1,smoothing:0},1).final,calm=turnedBy({},1).final;
  assert.ok(Math.abs(calm/full-DRAG_GAIN)<.03,'ratio '+calm/full+' against '+DRAG_GAIN);
  assert.ok(DRAG_GAIN<=.6&&DRAG_GAIN>=.4);
});

test('the globe eases into the drag in a few frames, never goes back, and stops after release',()=>{
  const {samples,final,camera,drag}=turnedBy({},14);
  assert.ok(samples[0]>0&&samples[0]<final*.2,'the first frame moves only a little: '+samples[0]+' of '+final);
  for(let i=1;i<samples.length;i++)assert.ok(samples[i]>=samples[i-1]-1e-12,'the turn never reverses');
  assert.ok(samples.at(-1)>final*.6&&samples.at(-1)<final,'still on its way after about 220 ms');
  const rest=camera.position.clone();
  drag.update(16);drag.update(16);
  assert.ok(camera.position.equals(rest),'no motion after it has settled');
  assert.ok(DRAG_SMOOTHING>=80);
});
