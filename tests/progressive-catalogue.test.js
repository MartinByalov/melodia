import test from 'node:test';
import assert from 'node:assert/strict';
import {loadInitialStations} from '../public/radio.js';

const raw=(id,tags='pop')=>({stationuuid:id,name:id,url:'https://example.org/live.mp3',tags});
test('initial catalogue includes favorite and lofi, full pagination starts only on demand',async()=>{
  const calls=[];
  const request=async path=>{
    calls.push(path);
    if(path.includes('uuids='))return [raw('favorite')];
    if(path.includes('tag=lofi'))return [raw('lofi','lofi')];
    if(path.includes('limit=5000'))return [raw('more'),raw('favorite')];
    return [raw('popular')];
  };
  const result=await loadInitialStations(['favorite'],request,false);
  assert.deepEqual(result.stations.map(s=>s.id),['popular','lofi','favorite']);
  assert.equal(calls.length,3);
  const first=result.complete();assert.equal(result.complete(),first);
  assert.equal((await first).length,2);assert.equal(calls.length,4);
});
test('failed initial subrequest retains playable stations and background failure is explicit',async()=>{
  const result=await loadInitialStations([],async path=>{
    if(path.includes('tag=lofi'))return [raw('lofi','lofi')];
    throw new Error('Offline');
  },false);
  assert.equal(result.stations.length,1);
  await assert.rejects(result.complete(),/Offline/);
});