import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {excludedStationIds,excludedStreamHosts,stationExcluded} from '../public/station-exclusions.js';
import {normalizeStation,loadInitialStations,loadStations} from '../public/radio.js';

const raw={stationuuid:'allowed',name:'Test FM',url_resolved:'https://streams.example.org/live.mp3',geo_lat:42,geo_long:23};

test('removed UUID is rejected for both live and bundled catalogue records',async()=>{
  excludedStationIds.add('blocked');
  try {
    assert.equal(stationExcluded({id:'blocked'}),true);
    assert.equal(normalizeStation({...raw,stationuuid:'blocked'},false),null);
    const snapshot=async()=>({ok:true,json:async()=>[raw,{...raw,stationuuid:'blocked'}]});
    assert.deepEqual((await loadStations(false,snapshot)).stations.map(s=>s.id),['allowed']);
    const request=async()=>[raw,{...raw,stationuuid:'blocked'}];
    const result=await loadInitialStations(['blocked'],request,false,()=>loadStations(false,snapshot));
    assert.deepEqual(result.stations.map(s=>s.id),['allowed']);
    assert.deepEqual((await result.complete()).map(s=>s.id),['allowed']);
  } finally { excludedStationIds.delete('blocked'); }
});

test('host removal covers subdomains and both original and resolved URLs, not similarly named hosts',()=>{
  excludedStreamHosts.add('example.org');
  try {
    assert.equal(normalizeStation(raw,false),null);
    assert.equal(normalizeStation({...raw,url_resolved:'https://safe.net/live',url:'https://EXAMPLE.ORG/live'},false),null);
    assert.ok(normalizeStation({...raw,url_resolved:'https://notexample.org/live'},false));
    assert.ok(normalizeStation({...raw,url_resolved:'https://example.org.evil.net/live'},false));
  } finally { excludedStreamHosts.delete('example.org'); }
});

test('all application entry points respect station removals',async()=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/function choose\(s, autoplay = continuePlayback\(document.body.dataset.playerState\)\) \{\s*if \(stationExcluded\(s\)\) return/);
  assert.match(app,/stations=next\.filter\(s=>!stationExcluded\(s\)\)/);
  assert.match(app,/result\.stations\.filter\(s=>!stationExcluded\(s\)\)/);
  assert.match(app,/!stationExcluded\(\{id\}\) && !stations\.some/);
  assert.ok(app.includes("!stationExcluded({id}) && /^[a-zA-Z0-9-]{1,64}$/.test(id)"));
});