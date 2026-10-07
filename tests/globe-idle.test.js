import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {createGlobeIdle} from '../public/globe-idle.js';

test('drift starts after thirty seconds and bounces inside available bounds',()=>{
  const idle=createGlobeIdle();idle.update(0,0,40,30);
  assert.equal(idle.update(29999,.016,40,30).active,false);
  assert.equal(idle.update(30000,.016,40,30).active,true);
  let reversed=false,previous=0;
  for(let i=1;i<300;i++){
    const state=idle.update(30000+i*50,.05,40,30);
    assert.ok(Math.abs(state.x)<=40&&Math.abs(state.y)<=30);
    if(state.x<previous)reversed=true;previous=state.x;
  }
  assert.ok(reversed);
});

test('hover or activity eases back rather than jumping and restarts the timer',()=>{
  const idle=createGlobeIdle();idle.update(0,0,100,100);
  const x=idle.update(30000,.05,100,100).x;
  const returning=idle.update(30050,.05,100,100,true);
  assert.equal(returning.active,false);assert.ok(returning.x>0&&returning.x<x);
  assert.ok(Math.abs(returning.x/x-Math.exp(-.05/.6))<1e-9);
  for(let i=1;i<=60;i++)idle.update(30050+i*50,.05,100,100,true);
  assert.equal(idle.update(33100,.05,100,100,true).x,0);
  idle.activity(34000);assert.equal(idle.update(63999,.05,100,100).active,false);
  assert.equal(idle.update(64000,.05,100,100).active,true);
});

test('zoomed globe with no available space stays centered',()=>{
  const idle=createGlobeIdle();idle.update(0,0,0,0);
  assert.deepEqual(idle.update(30001,.05,-100,-50),{x:0,y:0,active:true});
});

test('bounce limits use sphere silhouette without ray lengths or safety padding',async()=>{
  const source=await readFile(new URL('../public/globe.js',import.meta.url),'utf8');
  assert.match(source,/Math\.asin\(1\/camera\.position\.length\(\)\)/);
  assert.match(source,/idleMotion\.update\(time,dt\/1000,idleWidth\/2-globeRadius,idleHeight\/2-globeRadius-Math\.abs\(mobileGlobeOffset\),/);
});