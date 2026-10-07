import test from 'node:test';
import assert from 'node:assert/strict';
import { Box3, Frustum, Matrix4, PerspectiveCamera, Vector3 } from '../public/vendor/three.module.js';
import { buildMapBatch, queryMapBVH, writeVisibleSegmentIds, mapHorizonConstant } from '../public/map-bvh.js';

test('texture packing preserves all endpoints and exact segment ranges',()=>{
  const chunks=[new Float32Array([1,2,3,4,5,6]),new Float32Array([7,8,9,10,11,12,13,14,15,16,17,18])];
  const batch=buildMapBatch(chunks,4);
  assert.deepEqual(Array.from(batch.ranges),[0,1,1,2]);
  assert.equal(batch.segmentCount,3);assert.equal(batch.width,4);assert.equal(batch.height,2);
  const unpacked=[];
  for(let i=0;i<6;i++)unpacked.push(...batch.textureData.subarray(i*4,i*4+3));
  assert.deepEqual(unpacked,chunks.flatMap(chunk=>Array.from(chunk)));
  const ids=new Float32Array(3);
  assert.equal(writeVisibleSegmentIds(batch,[1,0],ids),3);
  assert.deepEqual(Array.from(ids),[1,2,0]);
  assert.throws(()=>writeVisibleSegmentIds(batch,[0,1],new Float32Array(2)),/too small/);
});

test('BVH matches brute-force padded frustum boxes across camera poses',()=>{
  const chunks=[];
  for(let i=0;i<500;i++){
    const p=i*.61803398875*2*Math.PI,y=1-2*(i+.5)/500,r=Math.sqrt(1-y*y);
    const x=Math.cos(p)*r,z=Math.sin(p)*r;
    chunks.push(new Float32Array([x,y,z,x+.003,y+.004,z-.002]));
  }
  const batch=buildMapBatch(chunks),camera=new PerspectiveCamera(40,1.6,.0001,100),frustum=new Frustum(),matrix=new Matrix4();
  for(let pose=0;pose<24;pose++){
    const angle=pose*.7,distance=[4.2,1.2,1.005][pose%3];
    camera.position.set(Math.cos(angle)*distance,.2*distance,Math.sin(angle)*distance);camera.lookAt(0,0,0);camera.updateMatrixWorld();
    frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    for(const margin of [0,.0001,.025]){
      const expected=chunks.flatMap((positions,id)=>{
        const box=new Box3().setFromArray(positions).expandByScalar(margin);
        return frustum.intersectsBox(box)?[id]:[];
      });
      const actual=[];queryMapBVH(batch,frustum.planes,margin,actual);
      assert.deepEqual(actual.sort((a,b)=>a-b),expected);
    }
  }
  camera.position.set(0,0,1.005);camera.lookAt(0,0,0);camera.updateMatrixWorld();
  frustum.setFromProjectionMatrix(matrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
  assert.ok(queryMapBVH(batch,frustum.planes,0,[])<batch.nodes.length,'BVH must skip whole subtrees');
});

test('empty batches and GPU texture capacity failures are handled',()=>{
  const batch=buildMapBatch([]);const result=[99];
  assert.equal(queryMapBVH(batch,[],0,result),0);assert.deepEqual(result,[]);
  assert.equal(writeVisibleSegmentIds(batch,[],new Float32Array()),0);
  assert.throws(()=>buildMapBatch([new Float32Array(5)]),/Incomplete/);
  assert.throws(()=>buildMapBatch([new Float32Array(18)],2),/capacity/);
  const point=buildMapBatch([new Float32Array([0,0,0,0,0,0])]);
  const planes=[{normal:new Vector3(1,0,0),constant:0}];
  const visible=[];queryMapBVH(point,planes,0,visible);assert.deepEqual(visible,[0]);
});

test('horizon rejection retains every endpoint not occluded by the unit sphere',()=>{
  for(const distance of [1.0008,1.005,1.2,4.2,6.5])for(const radius of [1.00001,1.000025,1.001,1.025]){
    const camera=new Vector3(0,0,distance),constant=mapHorizonConstant(distance,radius);
    for(let i=0;i<=2000;i++){
      const z=radius*(2*i/2000-1),point=new Vector3(Math.sqrt(Math.max(0,radius*radius-z*z)),0,z);
      const direction=point.clone().sub(camera),length=direction.length();direction.divideScalar(length);
      const b=camera.dot(direction),discriminant=b*b-(distance*distance-1);
      const hit=discriminant>=0?-b-Math.sqrt(discriminant):Infinity;
      const occluded=hit>=0&&hit<length-1e-8;
      if(!occluded)assert.ok(camera.dot(point)+constant>=-1e-8,'Visible endpoint rejected at horizon');
    }
  }
  assert.ok(-4.2+mapHorizonConstant(4.2,1.00001)<0,'Far side must be rejected');
});