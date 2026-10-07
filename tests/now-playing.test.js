import test from 'node:test';
import assert from 'node:assert/strict';
import {readSongMetadata,createNowPlayingQueue} from '../public/now-playing.js';

function tag(frames){
  const body=[];
  for(const [id,value] of frames){const data=[3,...new TextEncoder().encode(value)];body.push(...new TextEncoder().encode(id),0,0,0,data.length,0,0,...data);}
  return new Uint8Array([73,68,51,4,0,0,0,0,body.length>>7,body.length&127,...body]);
}
test('ID3 title and artist produce a real song label; unrelated metadata does not',()=>{
  assert.deepEqual(readSongMetadata(tag([['TPE1','Artist'],['TIT2','Song']])),{artist:'Artist',title:'Song',label:'Artist — Song'});
  assert.equal(readSongMetadata(tag([['TPE1','Artist']])),null);
  assert.equal(readSongMetadata(new Uint8Array([1,2,3])),null);
  assert.equal(readSongMetadata(tag([['TIT2','Песен']])).label,'Песен');
});
test('metadata waits for playback time and can be cleared on station switches',()=>{
  const queue=createNowPlayingQueue(),song={label:'Artist — Song'};
  queue.add(10,song);assert.equal(queue.read(2),null);assert.equal(queue.read(10),song);
  queue.add(20,song);queue.clear();assert.equal(queue.read(30),null);
});