import test from 'node:test';
import assert from 'node:assert/strict';
import {loadInitialStations,loadStations} from '../public/radio.js';

const raw=(id,tags='pop')=>({stationuuid:id,name:id,url:'https://example.org/live.mp3',tags});
test('initial catalogue includes favorite and lofi, bundled directory starts only on demand',async()=>{
  const calls=[];
  const request=async path=>{
    calls.push(path);
    if(path.includes('uuids='))return [raw('favorite')];
    if(path.includes('tag=lofi'))return [raw('lofi','lofi')];
    return [raw('popular')];
  };
  let snapshotCalls=0;
  const snapshot=async()=>{snapshotCalls++;return {stations:[raw('more'),raw('favorite')].map(s=>({id:s.stationuuid}))};};
  const result=await loadInitialStations(['favorite'],request,false,snapshot);
  assert.deepEqual(result.stations.map(s=>s.id),['popular','lofi','favorite']);
  assert.equal(calls.length,3);
  const first=result.complete();assert.equal(result.complete(),first);
  assert.equal((await first).length,2);assert.equal(calls.length,3);assert.equal(snapshotCalls,1);
});
test('failed initial subrequest retains playable stations and snapshot failure is explicit',async()=>{
  const result=await loadInitialStations([],async path=>{
    if(path.includes('tag=lofi'))return [raw('lofi','lofi')];
    throw new Error('Offline');
  },false,async()=>{throw new Error('Snapshot unavailable');});
  assert.equal(result.stations.length,1);
  await assert.rejects(result.complete(),/Snapshot unavailable/);
});

test('when API nodes fail, initial loading uses the bundled snapshot',async()=>{
  const station={id:'cached'};
  const result=await loadInitialStations([],async()=>{throw new Error('Offline');},false,async()=>({stations:[station],cached:true}));
  assert.deepEqual(result,{stations:[station],cached:true});
});

test('bundled directory loads locally and normalizes stations without remote pagination',async()=>{
  let path;
  const result=await loadStations(false,async url=>{path=url;return {ok:true,json:async()=>[raw('local')]};});
  assert.equal(path,'./assets/stations.json');
  assert.equal(result.cached,true);
  assert.deepEqual(result.stations.map(station=>station.id),['local']);
  await assert.rejects(loadStations(false,async()=>({ok:false})),/Directory unavailable/);
});