import test from 'node:test';
import assert from 'node:assert/strict';
import {createGlobeEntrance} from '../public/globe-entrance.js';
import {readFile} from 'node:fs/promises';

test('globe stays full size while tiles fade after completion',()=>{
  const entrance=createGlobeEntrance();let previous=entrance.update(0,true,false);
  assert.equal(previous,1);
  for(let i=0;i<100;i++){const value=entrance.update(.1,true,false);assert.equal(value,1);previous=value;}
  assert.equal(entrance.update(0,false,false),previous);
  for(let i=0;i<10;i++){const value=entrance.update(.1,false,false);assert.ok(value>=previous&&value<=1);previous=value;}
  assert.equal(previous,1);
  assert.equal(entrance.completion,1);
});

test('slow catalogue keeps the tiles and normal size until ready',()=>{
  const entrance=createGlobeEntrance();let previous=0;
  for(let i=0;i<1200;i++){
    const size=entrance.update(.1,true,false);
    assert.equal(size,1);previous=size;
  }
  assert.equal(entrance.completion,0);
});
test('loading material uses antialiased rectangular tiles with facet highlights instead of stripes',async()=>{
  const source=await readFile(new URL('../public/globe.js',import.meta.url),'utf8');
  assert.match(source,/tileUv\*vec2\(64\.0,32\.0\)/);
  assert.match(source,/fwidth\(grid\)/);
  assert.match(source,/vec3 facet=normalize/);
  assert.match(source,/mix\(baseColor,tiled,hatch\)/);
  assert.doesNotMatch(source,/float stripe=sin/);
});
test('reduced motion shows normal globe immediately',()=>{
  const entrance=createGlobeEntrance();assert.equal(entrance.update(.1,true,true),1);assert.equal(entrance.update(.1,false,true),1);
});