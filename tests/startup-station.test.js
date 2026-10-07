import test from 'node:test';
import assert from 'node:assert/strict';
import { startupStation } from '../public/startup-station.js';
import { readFile } from 'node:fs/promises';

const stations=[{id:'lofi',tags:'lo-fi,chill'},{id:'jazz',tags:'jazz'},{id:'pop',tags:'pop'}];
test('startup selects the first available favorite in saved order',()=>{
  assert.equal(startupStation(stations,new Set(['missing','pop','jazz'])),stations[2]);
});
test('startup falls back to Lo-Fi when favorites are empty or unavailable',()=>{
  assert.equal(startupStation(stations,new Set()),stations[0]);
  assert.equal(startupStation(stations,new Set(['missing'])),stations[0]);
  assert.equal(startupStation([{id:'rock',tags:'rock'}],new Set()),null);
  assert.equal(startupStation([],new Set()),null);
});
test('startup waits for loading, preserves explicit links and does not autoplay embed',async()=>{
  const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const startup=source.slice(source.indexOf('async function startWorld()'));
  assert.ok(startup.indexOf('await Promise.all')<startup.indexOf('startupStation(stations,favoriteIds)'));
  assert.match(startup,/dataset\.embed!=='true'/);
  assert.match(startup,/searchParams\.has\('station'\)/);
  assert.match(startup,/if\(!audio&&document\.body\.dataset\.playerState==='ready'\)/);
});

test('initial station theme is applied before loading ends without early playback',async()=>{
  const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const refresh=source.slice(source.indexOf('async function refresh()'),source.indexOf("$('#search').addEventListener"));
  assert.match(refresh,/dataset\.loading==='true'&&!selected&&!id&&document\.body\.dataset\.embed!=='true'/);
  assert.match(refresh,/const initial=startupStation\(stations,favoriteIds\);\s*if\(initial\)choose\(initial,false\)/);
  const choose=source.slice(source.indexOf('function choose('),source.indexOf('let catalogueGeneration'));
  assert.match(choose,/setTheme\(s\)/);
  assert.match(choose,/if \(autoplay\)/);
  const globe=await readFile(new URL('../public/globe.js',import.meta.url),'utf8');
  assert.match(globe,/entranceEarthColor\.set\(color\)/);
});