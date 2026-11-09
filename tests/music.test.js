import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeArtist,loadStations,licenseLabel,normalizeTrack,fetchArtistTracks,genreOf,matchesStation,safeImageUrl,artistImageUrl,fetchTracksByIds} from '../public/music.js';

const countries={FR:'France',BG:'Bulgaria'};
const row=[42,'  Both  ','FR','Paris',48.85,2.35,0,'Rock,Pop'];

test('normalizes a catalogue row into the shape used by the globe and directory',()=>{
  const artist=normalizeArtist(row,countries,10);
  assert.deepEqual({id:artist.id,name:artist.name,country:artist.country,code:artist.code,state:artist.state,lat:artist.lat,lon:artist.lon,tags:artist.tags,clicks:artist.clicks,approximate:artist.approximate},
    {id:'42',name:'Both',country:'France',code:'FR',state:'Paris',lat:48.85,lon:2.35,tags:'rock,pop',clicks:10,approximate:false});
  assert.equal(artist.homepage,'https://www.jamendo.com/artist/42');
  assert.equal(artist.url,'');
});
test('marks country-level placement as approximate',()=>{
  assert.equal(normalizeArtist([7,'A','BG','',42.7,23.3,2],countries).approximate,true);
});
test('rejects malformed rows and out-of-range coordinates',()=>{
  for(const bad of [null,'x',[],[0,'A','FR','',1,1,0],[1.5,'A','FR','',1,1,0],[1,'  ','FR','',1,1,0],[1,'A','FR','',91,1,0],[1,'A','FR','',1,181,0],[1,'A','FR','',NaN,1,0]])assert.equal(normalizeArtist(bad,countries),null);
});
test('loads the bundled catalogue, ranking earlier rows higher',async()=>{
  const data={countries,artists:[row,[43,'Second','BG','Sofia',42.7,23.3,1],[0,'bad','FR','',1,1,0]]};
  let requested;
  const result=await loadStations(async url=>{requested=url;return {ok:true,json:async()=>data};});
  assert.equal(requested,'./assets/artists.json');
  assert.deepEqual(result.stations.map(s=>s.id),['42','43']);
  assert.ok(result.stations[0].clicks>result.stations[1].clicks);
});
test('reports an unavailable or malformed catalogue',async()=>{
  await assert.rejects(loadStations(async()=>({ok:false})),/Artist directory unavailable/);
  await assert.rejects(loadStations(async()=>({ok:true,json:async()=>({})})),/malformed/);
});
test('formats Creative Commons license URLs',()=>{
  assert.equal(licenseLabel('http://creativecommons.org/licenses/by-nc-sa/2.0/'),'CC BY-NC-SA 2.0');
  assert.equal(licenseLabel('https://creativecommons.org/licenses/by/4.0'),'CC BY 4.0');
  assert.equal(licenseLabel(''),'');assert.equal(licenseLabel('https://example.org/license'),'');
});
test('accepts only HTTPS Jamendo audio addresses',()=>{
  const raw={id:'241',name:' Song ',audio:'https://prod-1.storage.jamendo.com/?trackid=241&format=mp32',duration:'340',license_ccurl:'http://creativecommons.org/licenses/by/3.0/'};
  const track=normalizeTrack(raw);
  assert.deepEqual({id:track.id,title:track.title,duration:track.duration,license:track.license,page:track.page},{id:'241',title:'Song',duration:340,license:'CC BY 3.0',page:'https://www.jamendo.com/track/241'});
  for(const audio of ['http://prod-1.storage.jamendo.com/?trackid=1','https://evil.example/a.mp3','javascript:alert(1)','','not a url'])assert.equal(normalizeTrack({...raw,audio}),null);
  assert.equal(normalizeTrack({audio:raw.audio}),null);
});
test('requests an artist\'s most popular tracks and drops unplayable ones',async()=>{
  let url;
  const tracks=await fetchArtistTracks(5,async(address)=>{url=new URL(address);return {ok:true,json:async()=>({headers:{status:'success'},results:[{id:'1',name:'One',audio:'https://prod-1.storage.jamendo.com/?trackid=1'},{id:'2',name:'No audio'}]})};},'test-client');
  assert.equal(url.origin+url.pathname,'https://api.jamendo.com/v3.0/tracks/');
  assert.equal(url.searchParams.get('artist_id'),'5');assert.equal(url.searchParams.get('client_id'),'test-client');assert.equal(url.searchParams.get('order'),'popularity_total');
  assert.deepEqual(tracks.map(t=>t.id),['1']);
});
test('fails clearly when Jamendo has nothing to play',async()=>{
  await assert.rejects(fetchArtistTracks('abc'),/Invalid artist/);
  await assert.rejects(fetchArtistTracks(5,async()=>({ok:false,status:429})),/HTTP 429/);
  await assert.rejects(fetchArtistTracks(5,async()=>({ok:true,json:async()=>({headers:{status:'failed'},results:[]})})),/could not list/);
  await assert.rejects(fetchArtistTracks(5,async()=>({ok:true,json:async()=>({headers:{status:'success'},results:[]})}),'k',{pause:0}),/no playable tracks/);
});
test('retries empty answers from Jamendo before giving up',async()=>{
  const answers=[[],[],[{id:'7',name:'Finally',audio:'https://prod-1.storage.jamendo.com/?trackid=7'}]];
  let calls=0;
  const tracks=await fetchArtistTracks(5,async()=>({ok:true,json:async()=>({headers:{status:'success'},results:answers[calls++]??[]})}),'k',{pause:0});
  assert.equal(calls,3);assert.deepEqual(tracks.map(t=>t.id),['7']);
  calls=0;
  await assert.rejects(fetchArtistTracks(5,async()=>{calls++;return {ok:true,json:async()=>({headers:{status:'success'},results:[]})};},'k',{pause:0,attempts:3}),/no playable tracks/);
  assert.equal(calls,3);
});
test('genre and search helpers still work on artist tags',()=>{
  assert.equal(genreOf('jazz,blues'),'jazz');assert.equal(genreOf(''),'pop');
  const artist=normalizeArtist(row,countries);
  assert.ok(matchesStation(artist,'FRANCE','rock'));assert.ok(matchesStation(artist,'paris','all'));assert.ok(!matchesStation(artist,'','jazz'));
});

test('pictures come only from Jamendo over HTTPS',()=>{
  assert.equal(artistImageUrl(603037),'https://usercontent.jamendo.com?type=artist&id=603037&width=300');
  for(const bad of ['abc','1;2','',null])assert.equal(artistImageUrl(bad),'');
  const good='https://usercontent.jamendo.com?type=album&id=33&width=300&trackid=241';
  assert.equal(safeImageUrl(good),new URL(good).href);
  for(const bad of ['http://usercontent.jamendo.com/a.jpg','https://evil.example/a.jpg','https://usercontent.jamendo.com.evil.net/a.jpg','javascript:alert(1)','','not a url'])assert.equal(safeImageUrl(bad),'');
});
test('a track carries its album cover when Jamendo provides one',()=>{
  const raw={id:'1',name:'Song',audio:'https://prod-1.storage.jamendo.com/?trackid=1',album_image:'https://usercontent.jamendo.com?type=album&id=33&width=300&trackid=1'};
  assert.equal(normalizeTrack(raw).image,new URL(raw.album_image).href);
  assert.equal(normalizeTrack({...raw,album_image:'https://evil.example/x.jpg'}).image,'');
  assert.equal(normalizeTrack({...raw,album_image:undefined}).image,'');
});

test('looks songs up by id in batches of 50 and keeps their artists',async()=>{
  const calls=[];
  const ids=Array.from({length:120},(_,i)=>i+1);
  const found=await fetchTracksByIds(ids,async url=>{
    const u=new URL(url);calls.push(u);
    const requested=u.searchParams.get('id').split(' ');
    return {ok:true,json:async()=>({headers:{status:'success'},results:requested.filter(id=>id!=='7').map(id=>({id,name:'Song '+id,artist_id:String(1000+Number(id)),audio:'https://prod-1.storage.jamendo.com/?trackid='+id}))})};
  },'k',{pause:0});
  assert.equal(calls.length,3);assert.equal(calls[0].searchParams.get('id').split(' ').length,50);assert.equal(calls[2].searchParams.get('id').split(' ').length,20);
  assert.equal(found.size,119);assert.equal(found.has('7'),false);
  assert.equal(found.get('8').artistId,'1008');assert.equal(found.get('8').track.title,'Song 8');
});
test('song lookup ignores bad ids, retries empty answers and reports failures',async()=>{
  let calls=0;
  const empty={ok:true,json:async()=>({headers:{status:'success'},results:[]})};
  assert.equal((await fetchTracksByIds(['abc','1;2',''],async()=>{calls++;return empty;},'k',{pause:0})).size,0);assert.equal(calls,0);
  calls=0;
  const answers=[empty,empty,{ok:true,json:async()=>({headers:{status:'success'},results:[{id:'5',name:'Five',artist_id:'9',audio:'https://prod-1.storage.jamendo.com/?trackid=5'}]})}];
  assert.equal((await fetchTracksByIds(['5'],async()=>answers[calls++],'k',{pause:0})).get('5').artistId,'9');assert.equal(calls,3);
  await assert.rejects(fetchTracksByIds(['5'],async()=>({ok:false,status:500}),'k',{pause:0}),/HTTP 500/);
});

test('a track keeps its own genres and speed from Jamendo musicinfo',()=>{
  const track=normalizeTrack({id:'1',name:'Song',audio:'https://prod-1.storage.jamendo.com/?trackid=1',musicinfo:{speed:'high',tags:{genres:['Pop','IndiePop'],vartags:['acoustic']}}});
  assert.equal(track.tags,'pop, indiepop, acoustic');
  assert.equal(track.speed,'high');
  const bare=normalizeTrack({id:'2',name:'Bare',audio:'https://prod-1.storage.jamendo.com/?trackid=2'});
  assert.equal(bare.tags,'');assert.equal(bare.speed,'');
});
