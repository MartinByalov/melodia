import test from 'node:test';
import assert from 'node:assert/strict';
import {jamendoPage,collectArtists,collectTags,collectArtistsWithTracks,cleanTags,mergeTags,tidyCity,buildCatalogue} from '../scripts/update-artists.js';

const ok=body=>({status:200,ok:true,headers:new Map(),json:async()=>body});
const page=(results,total)=>ok({headers:{status:'success',results_fullcount:String(total)},results});
const artist=(id,extra={})=>({id:String(id),name:`Artist ${id}`,locations:[{country:'FRA',city:'Paris',latitude:null,longitude:null}],...extra});

test('pages through the artists until the reported total',async()=>{
  const urls=[];
  const pages=[page([artist(1),artist(2)],3),page([artist(3)],3)];
  const artists=await collectArtists('key',{pause:0,retryPause:0,fetchImpl:async url=>{urls.push(new URL(url));return pages.shift();}});
  assert.deepEqual(artists.map(a=>a.id),['1','2','3']);
  assert.deepEqual(urls.map(u=>u.searchParams.get('offset')),['0','2']);
  assert.equal(urls[0].searchParams.get('haslocation'),'true');assert.equal(urls[0].searchParams.get('client_id'),'key');
  assert.equal(urls[0].searchParams.has('order'),false);
});
test('passes the popularity order only when asked',async()=>{
  let url;
  await collectArtists('key',{pause:0,order:'popularity_total',fetchImpl:async address=>{url=new URL(address);return page([artist(1)],1);}});
  assert.equal(url.searchParams.get('order'),'popularity_total');
});
test('drops duplicates and nameless artists',async()=>{
  const artists=await collectArtists('key',{pause:0,fetchImpl:async()=>page([artist(1),artist(1),artist(2,{name:'  '}),{name:'No id'}],4)});
  assert.deepEqual(artists.map(a=>a.id),['1']);
});
test('stops when the API runs out of results early',async()=>{
  let calls=0;
  const artists=await collectArtists('key',{pause:0,retryPause:0,retries:2,fetchImpl:async()=>{calls++;return page([],1000);}});
  assert.equal(artists.length,0);assert.equal(calls,3);
});
test('surfaces API errors instead of publishing partial data',async()=>{
  await assert.rejects(jamendoPage('bad',0,async()=>ok({headers:{status:'failed',code:11,error_message:'Suspended'}})),/Jamendo:.*Suspended/);
});
test('honours Retry-After on rate limiting, then succeeds',async()=>{
  const realSetTimeout=globalThis.setTimeout,waits=[];
  globalThis.setTimeout=(fn,ms)=>{waits.push(ms);return realSetTimeout(fn,0);};
  try{
    const responses=[{status:429,ok:false,headers:new Map([['retry-after','10']])},page([artist(1)],1)];
    const body=await jamendoPage('key',0,async()=>responses.shift());
    assert.equal(body.results.length,1);
    assert.ok(waits.includes(15000),`expected a 15s wait, got ${waits}`);
  }finally{globalThis.setTimeout=realSetTimeout;}
});
test('retries a non-JSON error page and gives up with a clear message',async()=>{
  const realSetTimeout=globalThis.setTimeout;globalThis.setTimeout=(fn)=>realSetTimeout(fn,0);
  try{
    const html={status:502,ok:false,headers:new Map(),json:async()=>{throw new SyntaxError('Unexpected token <');}};
    await assert.rejects(jamendoPage('key',0,async()=>html),/failed: HTTP 502, not JSON/);
  }finally{globalThis.setTimeout=realSetTimeout;}
});

test('collects genres in batches of 50 and keeps only a few clean tags',async()=>{
  const calls=[];
  const ids=Array.from({length:120},(_,i)=>i+1);
  const tags=await collectTags('key',ids,{pause:0,retries:0,fetchImpl:async url=>{
    const u=new URL(url);calls.push(u);
    const requested=u.searchParams.get('id').split(' ');
    return ok({headers:{status:'success'},results:requested.map(id=>({id,musicinfo:{tags:id==='1'?['Rock','rock','Hip Hop','electronic','ambient']:id==='2'?['<script>']:[]}}))});
  }});
  assert.equal(calls.length,3);assert.equal(calls[0].searchParams.get('id').split(' ').length,50);assert.equal(calls[0].searchParams.get('limit'),'50');
  assert.equal(calls[2].searchParams.get('id').split(' ').length,20);
  assert.equal(tags.get('1'),'rock,hip hop,electronic,ambient');
  assert.equal(tags.has('2'),false);assert.equal(tags.has('3'),false);
});
test('finds artists that have published at least one track, with the genres of that track',async()=>{
  const urls=[];
  const pages=[ok({headers:{status:'success'},results:[{artist_id:'1',musicinfo:{tags:{genres:['Rock','pop']}}},{artist_id:'2'}]}),ok({headers:{status:'success'},results:[{artist_id:'3',musicinfo:{tags:{genres:['jazz']}}}]}),ok({headers:{status:'success'},results:[]})];
  const ids=await collectArtistsWithTracks('key',{pause:0,retries:0,fetchImpl:async url=>{urls.push(new URL(url));return pages.shift();}});
  assert.deepEqual([...ids.keys()],['1','2','3']);
  assert.deepEqual(ids.get('1'),['rock','pop']);assert.deepEqual(ids.get('2'),[]);
  assert.equal(urls[0].searchParams.get('include'),'musicinfo');
  assert.deepEqual(urls.map(u=>u.searchParams.get('offset')),['0','2','3']);
  assert.equal(urls[0].searchParams.get('groupby'),'artist_id');assert.equal(urls[0].pathname,'/v3.0/tracks/');
});
test('does not mistake a spurious empty page for the end of the data',async()=>{
  const empty=ok({headers:{status:'success'},results:[]});
  const pages=[empty,page([artist(1),artist(2)],4),empty,empty,page([artist(3),artist(4)],4)];
  const artists=await collectArtists('key',{pause:0,retryPause:0,fetchImpl:async()=>pages.shift()});
  assert.deepEqual(artists.map(a=>a.id),['1','2','3','4']);
  const tracks=[empty,ok({headers:{status:'success'},results:[{artist_id:'9'}]}),empty,empty,empty];
  const ids=await collectArtistsWithTracks('key',{pause:0,retryPause:0,retries:2,fetchImpl:async()=>tracks.shift()});
  assert.deepEqual([...ids.keys()],['9']);
});
test('refuses to filter with a suspiciously small set of artists with tracks',async()=>{
  const none=ok({headers:{status:'success'},results:[]});
  await assert.rejects(collectArtistsWithTracks('key',{pause:0,retryPause:0,retries:1,minimum:10,fetchImpl:async()=>none}),/refusing to filter/i);
});
test('cleans tags and merges profile tags with track genres without duplicates',()=>{
  assert.deepEqual(cleanTags(['Rock ',' rock','<b>','x','hip hop','a'.repeat(30),null]),['rock','hip hop','null']);
  assert.deepEqual(cleanTags('rock'),[]);
  const merged=mergeTags(new Map([['1','rock,pop'],['2','jazz']]),new Map([['1',['pop','metal','blues','folk']],['3',['house']],['4',[]]]));
  assert.equal(merged.get('1'),'rock,pop,metal,blues');assert.equal(merged.get('2'),'jazz');assert.equal(merged.get('3'),'house');assert.equal(merged.has('4'),false);
});
test('tidies cities typed in all lower or upper case but leaves normal spelling alone',()=>{
  assert.equal(tidyCity('  jakarta '),'Jakarta');assert.equal(tidyCity('NEW YORK'),'New York');assert.equal(tidyCity('saint-denis'),'Saint-Denis');
  assert.equal(tidyCity('Wien'),'Wien');assert.equal(tidyCity('McKinney'),'McKinney');assert.equal(tidyCity(null),'');
});
test('prefers the gazetteer name for looked-up cities',()=>{
  const {rows}=buildCatalogue([artist(1)],()=>({lat:1,lon:2,level:1,cc:'FR',place:'Paris'}),new Map());
  assert.equal(rows[0][3],'Paris');
});
test('builds compact rows, counts placement levels and omits cities for country-level points',()=>{
  const geocode=a=>a.id==='1'?{lat:48.85,lon:2.35,level:0,cc:'FR'}:a.id==='2'?{lat:47,lon:3,level:1,cc:'FR'}:a.id==='3'?{lat:46,lon:2,level:2,cc:'FR'}:null;
  const artists=[artist(1,{locations:[{country:'FRA',city:' Paris ',latitude:'48.85',longitude:'2.35'}]}),artist(2),artist(3),artist(4),{id:'5',name:'Nowhere',locations:[]}];
  const {rows,countries,levels,skipped}=buildCatalogue(artists,geocode,new Map([['FR','France']]),new Map([['2','jazz,blues']]));
  assert.deepEqual(rows,[[1,'Artist 1','FR','Paris',48.85,2.35,0],[2,'Artist 2','FR','Paris',47,3,1,'jazz,blues'],[3,'Artist 3','FR','',46,2,2]]);
  assert.deepEqual(countries,{FR:'France'});assert.deepEqual(levels,[1,1,1]);assert.equal(skipped,2);
});
