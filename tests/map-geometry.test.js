import test from 'node:test';
import assert from 'node:assert/strict';
import { Vector3 } from '../public/vendor/three.module.js';
import { buildMapPositions, partitionMapPositions } from '../public/map-geometry.js';

function direction(lat,lon){
  const p=lat*Math.PI/180,l=lon*Math.PI/180;
  return new Vector3(Math.cos(p)*Math.cos(l),Math.sin(p),-Math.cos(p)*Math.sin(l));
}

for(const kind of ['overview','detail','district']){
  test(`${kind} worker geometry is byte-identical to the previous spherical subdivision`,()=>{
    const line=[[179,22],[-179,23],[-178,24]];
    const geometry=kind==='district'?{type:'MultiLineString',coordinates:[line]}:{type:'MultiPolygon',coordinates:[[line]]};
    const data={features:[{geometry}]},expected=[];
    const radius=kind==='district'?1.000025:kind==='detail'?1.00001:1.0001;
    const step=kind==='district'?Math.PI/24000:kind==='detail'?Math.PI/12000:.008;
    for(let i=1;i<line.length;i++){
      const from=direction(line[i-1][1],line[i-1][0]),to=direction(line[i][1],line[i][0]);
      const steps=Math.max(1,Math.ceil(from.angleTo(to)/step));
      let previous=from.clone().multiplyScalar(radius);
      for(let j=1;j<=steps;j++){
        const next=from.clone().lerp(to,j/steps).normalize().multiplyScalar(radius);
        expected.push(...previous.toArray(),...next.toArray());previous=next;
      }
    }
    assert.deepEqual(buildMapPositions(data,kind),new Float32Array(expected));
  });
}

test('detail deduplicates reversed shared edges without joining separate polygons',()=>{
  const a=[[0,0],[1,0]],b=[[1,0],[0,0]];
  const single={features:[{geometry:{type:'Polygon',coordinates:[a]}}]};
  const shared={features:[{geometry:{type:'MultiPolygon',coordinates:[[a],[b]]}},{geometry:null}]};
  assert.deepEqual(buildMapPositions(shared,'detail'),buildMapPositions(single,'detail'));
});

test('district geometry never connects disconnected ways',()=>{
  const lines=[[[0,0],[.01,0]],[[90,0],[90.01,0]]];
  const combined=buildMapPositions({features:[{geometry:{type:'MultiLineString',coordinates:lines}}]},'district');
  const separate=lines.flatMap(line=>Array.from(buildMapPositions({features:[{geometry:{type:'LineString',coordinates:line}}]},'district')));
  assert.deepEqual(combined,new Float32Array(separate));
});

test('spatial chunks preserve every segment byte-for-byte, including duplicates and long edges',()=>{
  const input=new Float32Array([1,0,0,1,.01,0,-1,0,0,-1,.01,0,1,0,0,1,.01,0,-1,0,0,1,0,0]);
  const chunks=partitionMapPositions(input);
  assert.ok(chunks.length>1);
  const segments=positions=>{
    const result=[];
    for(let i=0;i<positions.length;i+=6)result.push(Buffer.from(positions.buffer,positions.byteOffset+i*4,24).toString('hex'));
    return result;
  };
  assert.deepEqual(chunks.flatMap(segments).sort(),segments(input).sort());
  assert.equal(chunks.reduce((count,chunk)=>count+chunk.length,0),input.length);
  assert.deepEqual(partitionMapPositions(new Float32Array()),[]);
});