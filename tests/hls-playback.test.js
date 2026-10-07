import test from 'node:test';
import assert from 'node:assert/strict';
import {createHLSPlayback} from '../public/hls-playback.js';

class Engine {
  static Events={ERROR:'error',FRAG_PARSING_METADATA:'metadata'};
  static isSupported(){return true;}
  static instances=[];
  constructor(options){this.options=options;Engine.instances.push(this);}
  on(event,callback){this.handlers??={};this.handlers[event]=callback;if(event==='error')this.callback=callback;}
  attachMedia(media){this.media=media;}
  loadSource(url){this.url=url;}
  destroy(){this.destroyed=true;}
  pauseBuffering(){this.buffering=false;}
  resumeBuffering(){this.buffering=true;}
}
test('HLS attaches once and destroys old streams and handles fatal errors',async()=>{
  const playback=createHLSPlayback(async()=>Engine),media=new EventTarget();let errors=0;
  assert.equal(await playback.attach(media,'https://example.org/live.m3u8',()=>errors++),true);
  const first=Engine.instances.at(-1);
  assert.equal(first.media,media);assert.equal(first.options.backBufferLength,3);
  assert.equal(first.options.maxBufferSize,4*1024*1024);
  media.dispatchEvent(new Event('pause'));assert.equal(first.buffering,false);
  media.dispatchEvent(new Event('play'));assert.equal(first.buffering,true);
  await playback.attach(media,'https://example.org/next.m3u8',()=>errors++);
  assert.ok(first.destroyed);
  media.dispatchEvent(new Event('pause'));assert.equal(first.buffering,true);
  first.callback(null,{fatal:true});assert.equal(errors,0);
  const second=Engine.instances.at(-1);
  second.callback(null,{fatal:false});assert.equal(errors,0);
  second.callback(null,{fatal:true});assert.equal(errors,1);assert.ok(second.destroyed);
});
test('switching stations during lazy import cannot attach stale media',async()=>{
  let resolve;const playback=createHLSPlayback(()=>new Promise(r=>{resolve=r;}));
  const pending=playback.attach({},'https://example.org/live.m3u8',()=>{});
  playback.destroy();resolve(Engine);assert.equal(await pending,false);
});
test('unsupported browsers fail cleanly',async()=>{
  const playback=createHLSPlayback(async()=>({isSupported:()=>false}));
  await assert.rejects(playback.attach({},'https://example.org/live.m3u8',()=>{}),/unavailable/);
});

test('HLS song metadata is delivered at playback time, not buffer arrival',async()=>{
  const playback=createHLSPlayback(async()=>Engine),media=new EventTarget();media.currentTime=0;
  let song=null;
  await playback.attach(media,'https://example.org/live.m3u8',()=>{},value=>{song=value;});
  const data=[3,...new TextEncoder().encode('Song')];
  const body=[...new TextEncoder().encode('TIT2'),0,0,0,data.length,0,0,...data];
  const tag=new Uint8Array([73,68,51,4,0,0,0,0,0,body.length,...body]);
  Engine.instances.at(-1).handlers.metadata(null,{samples:[{pts:5,data:tag}]});
  media.dispatchEvent(new Event('timeupdate'));assert.equal(song,null);
  media.currentTime=5;media.dispatchEvent(new Event('timeupdate'));assert.equal(song.label,'Song');
  playback.destroy();
});