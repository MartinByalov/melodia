import test from 'node:test';
import assert from 'node:assert/strict';
import { AudioReactivity } from '../public/audio-reactivity.js';

test('current-stream envelope follows real bass and energy, smoothly and bounded',()=>{
  const envelope=new AudioReactivity(),bins=new Uint8Array(512),samples=new Float32Array(1024);
  bins.fill(220,1,5);samples.fill(.3);
  let previous=0;
  for(let i=0;i<120;i++){
    const result=envelope.update(bins,samples,48000,1024,1/60,true);
    assert.ok(result.available&&result.signal>=0&&result.signal<=1);
    assert.ok(Math.abs(result.signal-previous)<.35);previous=result.signal;
  }
  assert.ok(previous>.4);
  bins.fill(0);samples.fill(0);
  for(let i=0;i<240;i++)envelope.update(bins,samples,48000,1024,1/60,true);
  assert.ok(envelope.signal<.00001,'Real silence must decay to zero');
  assert.equal(envelope.update(null,null,48000,1024,1/60,false).signal,0);
});

test('bass band responds to low frequencies rather than treble',()=>{
  const bass=new Uint8Array(512),treble=new Uint8Array(512),samples=new Float32Array(1024);
  bass.fill(255,1,5);treble.fill(255,100,200);
  const a=new AudioReactivity(),b=new AudioReactivity();
  for(let i=0;i<120;i++){a.update(bass,samples,48000,1024,1/60,true);b.update(treble,samples,48000,1024,1/60,true);}
  assert.ok(a.bass>.9);assert.equal(b.bass,0);
});

test('rhythmic pulse emphasizes bass attacks rather than sustained volume',()=>{
  const envelope=new AudioReactivity(),bins=new Uint8Array(512),samples=new Float32Array(1024);samples.fill(.3);
  for(let i=0;i<100;i++)envelope.update(bins,samples,48000,1024,1/60,true);
  bins.fill(220,1,5);
  let peak=0;
  for(let i=0;i<8;i++)peak=Math.max(peak,envelope.update(bins,samples,48000,1024,1/60,true).rhythm);
  let sustained;
  for(let i=0;i<180;i++)sustained=envelope.update(bins,samples,48000,1024,1/60,true).rhythm;
  assert.ok(peak>sustained*2);
  bins.fill(0);samples.fill(0);
  let silent;
  for(let i=0;i<240;i++)silent=envelope.update(bins,samples,48000,1024,1/60,true).rhythm;
  assert.ok(silent<.00001);
});