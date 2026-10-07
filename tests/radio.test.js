import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeStation, genreOf, matchesStation, fetchStationCatalogue } from '../public/radio.js';
const raw = { stationuuid:'test', name:' Test FM ', geo_lat:42.7, geo_long:23.3, url_resolved:'https://example.org/live.mp3', tags:'JAZZ,blues', country:'Bulgaria', clickcount:'200', bitrate:'128' };
test('normalizes API station and preserves actual coordinates', () => { const s=normalizeStation(raw); assert.equal(s.name,'Test FM');assert.equal(s.lat,42.7);assert.equal(s.lon,23.3);assert.equal(s.clicks,200);assert.equal(s.tags,'jazz,blues'); });
test('rejects missing, invalid and out-of-range coordinates', () => { for(const geo_lat of [null,undefined,'invalid',91])assert.equal(normalizeStation({...raw,geo_lat}),null);assert.equal(normalizeStation({...raw,geo_long:181}),null); });
test('accepts zero coordinates rather than inventing locations', () => { assert.equal(normalizeStation({...raw,geo_lat:0,geo_long:0}).lat,0); });
test('rejects insecure streams, invalid urls, missing ids and native unsupported HLS', () => { for(const update of [{url_resolved:'http://example.org/live'},{url_resolved:'javascript:alert(1)'},{url_resolved:'invalid'},{stationuuid:''},{hls:1}]) assert.equal(normalizeStation({...raw,...update}),null); });
test('assigns thematic genres', () => { for(const [tags,genre] of [['synthwave,house','electronic'],['jazz,swing','jazz'],['heavy metal','rock'],['ambient,lofi','chill'],['opera','classical'],['hits','pop']])assert.equal(genreOf(tags),genre); });
test('filters case-insensitively by country, name and genre', () => { const s=normalizeStation(raw);assert.ok(matchesStation(s,'BULGARIA','jazz'));assert.ok(matchesStation(s,'test','all'));assert.ok(!matchesStation(s,'','rock'));assert.ok(!matchesStation(s,'France','all')); });

test('genre filters reject incidental tags and substring false positives',()=>{
  const station=tags=>({name:'Rock Electronic FM',country:'',state:'',tags});
  assert.equal(matchesStation(station('house,deep house,tech house,hiphop'),'','hiphop'),false);
  assert.equal(matchesStation(station('rock,classic rock,rap'),'','hiphop'),false);
  assert.equal(matchesStation(station('therapeutic,paragraph,trap'),'','hiphop'),false);
  assert.equal(matchesStation(station('hip-hop,rap,urban'),'','hiphop'),true);
  assert.equal(matchesStation(station('rock,hip-hop'),'','hiphop'),true);
  assert.equal(matchesStation(station('electronic'),'','hiphop'),false);
  assert.equal(matchesStation(station('pop'),'','hiphop'),false);
  assert.equal(matchesStation(station('chill'),'','lofi'),false);
  assert.equal(matchesStation(station('lo-fi'),'','lofi'),true);
  assert.equal(matchesStation(station(''),'','pop'),false);
});
test('favorites retain secondary explicit styles without accepting substring matches',()=>{
  const s={name:'Mixed FM',tags:'rock,classic rock,hip-hop',country:'',state:''};
  assert.equal(matchesStation(s,'','hiphop'),false);
  assert.equal(matchesStation(s,'','hiphop',true),true);
  assert.equal(matchesStation({...s,tags:'paragraph,rock'},'','hiphop',true),false);
});

test('Pop favorites include chart aliases and secondary Pop but not untagged stations',()=>{
  for(const tags of ['hits','top40','top 40','charts','rock,classic rock,pop']){
    assert.equal(matchesStation({tags,name:'Test',country:''},'','pop',true),true,tags);
  }
  assert.equal(matchesStation({tags:'',name:'Test',country:''},'','pop',true),false);
});

test('full catalogue keeps stations without coordinates without inventing positions',()=>{
  const station=normalizeStation({...raw,geo_lat:null,geo_long:null},false);
  assert.ok(station);assert.equal(station.lat,null);assert.equal(station.lon,null);
  assert.equal(normalizeStation({...raw,url_resolved:'http://example.org/live'},false),null);
});

test('catalogue accepts secure original URLs and HLS only with native support',async()=>{
  const fallback={...raw,url_resolved:'http://example.org/live',url:'https://example.org/original'};
  assert.equal(normalizeStation(fallback,false).url,fallback.url);
  const hls={...raw,stationuuid:'hls',hls:1,url_resolved:'https://example.org/live.m3u8'};
  assert.equal(normalizeStation(hls,false,false),null);
  assert.ok(normalizeStation(hls,false,true));
  assert.equal(normalizeStation({...hls,hls:0},false,false),null);
  let path;
  const stations=await fetchStationCatalogue(async query=>{path=query;return [fallback,hls];},5000,true);
  assert.equal(stations.length,2);
  assert.ok(!path.includes('is_https'));
  assert.ok(path.includes('hidebroken=true'));
});

test('catalogue paginates to completion, deduplicates and orders by popularity',async()=>{
  const urls=[];
  const make=(id,clicks)=>({...raw,stationuuid:id,clickcount:clicks});
  const pages=[[make('a',1),make('b',9)],[make('b',9),{...make('c',4),geo_lat:null}],[make('d',3)]];
  const stations=await fetchStationCatalogue(async path=>{urls.push(path);return pages.shift();},2);
  assert.deepEqual(stations.map(s=>s.id),['b','c','d','a']);
  assert.deepEqual(urls.map(path=>new URL('https://example.org/'+path).searchParams.get('offset')),['0','2','4']);
  assert.ok(urls.every(path=>!path.includes('has_geo_info')));
  assert.equal(stations.find(s=>s.id==='c').lat,null);
});

test('catalogue does not return a silently truncated result on failure or repeated pages',async()=>{
  const page=[raw];
  await assert.rejects(fetchStationCatalogue(async()=>page,1),/did not advance/);
  let calls=0;
  await assert.rejects(fetchStationCatalogue(async()=>{if(calls++)throw new Error('network');return page;},1),/network/);
  await assert.rejects(fetchStationCatalogue(async()=>({}),2),/Invalid catalogue response/);
});