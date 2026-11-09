import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {excludedStationIds,excludedStreamHosts,stationExcluded} from '../public/station-exclusions.js';
import {normalizeArtist,loadStations} from '../public/music.js';

const row=[1001,'Test Artist','FR','Paris',48.85,2.35,0];

test('removed artist ID is rejected for both normalized and bundled catalogue records',async()=>{
  excludedStationIds.add('1002');
  try {
    assert.equal(stationExcluded({id:'1002'}),true);
    assert.equal(normalizeArtist([1002,'Blocked','FR','Paris',48.85,2.35,0]),null);
    const snapshot=async()=>({ok:true,json:async()=>({countries:{FR:'France'},artists:[row,[1002,'Blocked','FR','Paris',48.85,2.35,0]]})});
    assert.deepEqual((await loadStations(snapshot)).stations.map(s=>s.id),['1001']);
  } finally { excludedStationIds.delete('1002'); }
});

test('removals by host still match subdomains but not similarly named hosts',()=>{
  excludedStreamHosts.add('example.org');
  try {
    assert.equal(stationExcluded({id:'x',url_resolved:'https://audio.example.org/live'}),true);
    assert.equal(stationExcluded({id:'x',url_resolved:'https://safe.net/live',url:'https://EXAMPLE.ORG/live'}),true);
    assert.equal(stationExcluded({id:'x',url_resolved:'https://notexample.org/live'}),false);
    assert.equal(stationExcluded({id:'x',url_resolved:'https://example.org.evil.net/live'}),false);
  } finally { excludedStreamHosts.delete('example.org'); }
});

test('all application entry points respect station removals',async()=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/function choose\(s, autoplay = continuePlayback\(document.body.dataset.playerState\), trackId = null\) \{\s*if \(stationExcluded\(s\)\) return/);
  assert.match(app,/result\.stations\.filter\(s=>!stationExcluded\(s\)\)/);
});