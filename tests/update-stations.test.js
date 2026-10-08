import test from 'node:test';
import assert from 'node:assert/strict';
import {mkdtemp,readFile,writeFile,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import {collectStations,downloadStations,updateStations} from '../scripts/update-stations.js';
import {excludedStationIds} from '../public/station-exclusions.js';
import {normalizeStation} from '../public/radio.js';
import {compactStation,compactCatalogue} from '../scripts/compact-stations.js';

const raw=id=>({stationuuid:id,name:'Test FM',url:'https://example.org/live',lastcheckok:1,geo_lat:42,geo_long:23});

test('compaction preserves playback, coordinates, health and distinct exclusion addresses',async()=>{
  const original={...raw('a'),url_resolved:'https://example.org/live',state:'',hls:0,bitrate:0,lastchecktime_iso8601:'2026-10-07T00:00:00Z'};
  const compact=compactStation(original);
  assert.equal(compact.url,undefined);
  assert.equal(compact.lastchecktime_iso8601,undefined);
  assert.equal(compact.lastcheckok,1);
  assert.deepEqual(normalizeStation(compact,false,true),normalizeStation(original,false,true));
  const distinct={...original,url:'https://other.example/live'};
  assert.equal(compactStation(distinct).url,distinct.url);
  const dir=await mkdtemp(join(tmpdir(),'melodia-compact-'));
  try{
    const path=join(dir,'stations.json');await writeFile(path,JSON.stringify([original]));
    const result=await compactCatalogue(path);
    assert.ok(result.afterBytes<result.beforeBytes);
    assert.deepEqual(JSON.parse(await readFile(path,'utf8')),[compact]);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('browser loading assertion does not confuse player messages with startup state',async()=>{
  const source=await readFile(new URL('../tools/browser-check.js',import.meta.url),'utf8');
  const assertion=source.split('\n').find(line=>line.includes("throw new Error('Loading did not finish')"));
  assert.ok(assertion.includes('dataset.loading'));
  assert.ok(assertion.includes('aria-busy'));
  assert.ok(!assertion.includes('globe-status'));
});

test('updater paginates, deduplicates, filters and retains HLS and records without coordinates',async()=>{
  excludedStationIds.add('blocked');
  try{
    const pages=[[raw('a'),raw('a'),raw('blocked')],[{...raw('bad'),url:'http://example.org/live'},{...raw('offline'),lastcheckok:0},{...raw('hls'),hls:1,geo_lat:null}],[]],paths=[];
    const result=await collectStations(async path=>{paths.push(path);return pages.shift();},{pageSize:3});
    assert.deepEqual(result.stations.map(s=>s.stationuuid),['a','hls']);
    assert.deepEqual(result.counts,{received:6,duplicates:1,excluded:1,invalid:1,unhealthy:1,accepted:2,withCoordinates:1});
    assert.ok(paths[2].endsWith('offset=6'));
  }finally{excludedStationIds.delete('blocked');}
});

test('updater rejects malformed responses, repeated pages and page limit exhaustion',async()=>{
  for(const response of [{},[null],[{name:'missing UUID'}]])await assert.rejects(collectStations(async()=>response));
  await assert.rejects(collectStations(async()=>[raw('a')],{pageSize:1}),/did not advance/);
  await assert.rejects(collectStations(async()=>[raw('a')],{pageSize:1,maxPages:1}),/safety limit/);
});

test('failed mirror starts a new complete scan instead of continuing its offsets',async()=>{
  const calls=[];
  const result=await downloadStations(async url=>{
    calls.push(url);
    if(calls.length===1)throw new Error('offline');
    return {ok:true,json:async()=>[raw('a')]};
  });
  assert.equal(calls.length,2);
  assert.ok(calls.every(url=>url.endsWith('offset=0')));
  assert.equal(result.stations.length,1);
});

test('dry run, interrupted download, empty and shrinking results preserve the old file',async()=>{
  const dir=await mkdtemp(join(tmpdir(),'melodia-update-'));
  try{
    const cataloguePath=join(dir,'stations.json'),reportPath=join(dir,'report.json');
    const original=JSON.stringify(Array.from({length:10},(_,i)=>raw(String(i))));
    await writeFile(cataloguePath,original);
    const download=async()=>({stations:JSON.parse(original),counts:{accepted:10},source:'test',pages:1});
    const options={cataloguePath,reportPath,download};
    assert.equal((await updateStations({...options,dryRun:true})).status,'validated');
    assert.equal(await readFile(cataloguePath,'utf8'),original);
    for(const broken of [async()=>{throw new Error('interrupted');},async()=>({stations:[],counts:{}}),async()=>({stations:[raw('one')],counts:{}})]){
      await assert.rejects(updateStations({...options,download:broken}));
      assert.equal(await readFile(cataloguePath,'utf8'),original);
      assert.equal(JSON.parse(await readFile(reportPath,'utf8')).status,'failed');
    }
    await updateStations({...options,download:async()=>({...await download(),stations:[...JSON.parse(original),raw('new')]})});
    assert.equal(JSON.parse(await readFile(cataloguePath,'utf8')).length,11);
    assert.equal(JSON.parse(await readFile(reportPath,'utf8')).added,1);
  }finally{await rm(dir,{recursive:true,force:true});}
});

test('live, shared and saved records use the same explicit health rejection',()=>{
  assert.equal(normalizeStation({...raw('offline'),lastcheckok:0},false,true),null);
  assert.ok(normalizeStation(raw('online'),false,true));
  const legacy=raw('legacy');delete legacy.lastcheckok;
  assert.ok(normalizeStation(legacy,false,true));
});

test('manual candidate workflow does not publish or enable a schedule',async()=>{
  const source=await readFile(new URL('../.github/workflows/update-stations.yml',import.meta.url),'utf8');
  assert.match(source,/workflow_dispatch:/);
  assert.match(source,/npm run update:stations/);
  assert.doesNotMatch(source,/schedule:|deploy-pages|contents: write|git push/);
  const pages=await readFile(new URL('../.github/workflows/pages.yml',import.meta.url),'utf8');
  assert.ok(pages.indexOf('npm run prune:stations')<pages.indexOf('actions/upload-pages-artifact'));
});