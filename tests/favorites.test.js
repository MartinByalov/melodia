import test from 'node:test';
import assert from 'node:assert/strict';
import {normalizeFavorite,normalizeFavorites,loadFavorites,saveFavorites,hasFavorite,removeFavorite,toggleFavorite,mergeFavorites,favoriteArtistIds,encodeFavoritesLink,decodeFavoritesPayload,favoritesToFile,favoritesFromFile,FAVORITES_KEY,MAX_FAVORITES,QR_LIMIT,LINK_LIMIT} from '../public/favorites.js';
import {qrMatrix} from '../public/qr.js';

const song=(a,t,n='')=>({a:String(a),t:String(t),n});

test('normalizes entries and rejects anything that is not numeric ids',()=>{
  assert.deepEqual(normalizeFavorite({a:603609,t:'2292437',n:'  Here   We Go '}),song(603609,2292437,'Here We Go'));
  assert.deepEqual(normalizeFavorite({artist:5,track:6,title:'X'}),song(5,6,'X'));
  for(const bad of [null,'x',{},{a:'1'},{a:'1',t:'x'},{a:'1;2',t:'3'},{a:'12345678901',t:'1'},{a:'-1',t:'2'}])assert.equal(normalizeFavorite(bad),null);
  assert.equal(normalizeFavorite({a:1,t:2,n:'x'.repeat(500)}).n.length,120);
});
test('removes duplicates by track and caps the list',()=>{
  assert.deepEqual(normalizeFavorites([song(1,2,'A'),song(9,2,'B'),song(1,3)]),[song(1,2,'A'),song(1,3)]);
  const many=Array.from({length:MAX_FAVORITES+50},(_,i)=>song(1,i+1));
  assert.equal(normalizeFavorites(many).length,MAX_FAVORITES);
  assert.deepEqual(normalizeFavorites('nope'),[]);
});
test('loads and saves through storage, ignoring corrupt data',()=>{
  const store=new Map(),storage={getItem:key=>store.get(key)??null,setItem:(key,value)=>store.set(key,value)};
  assert.deepEqual(loadFavorites(storage),[]);
  saveFavorites(storage,[song(1,2,'A')]);
  assert.deepEqual(loadFavorites(storage),[song(1,2,'A')]);
  store.set(FAVORITES_KEY,'{not json');assert.deepEqual(loadFavorites(storage),[]);
  assert.deepEqual(loadFavorites({getItem(){throw new Error('blocked');}}),[]);
});
test('toggling adds a song and removes it again without touching other songs',()=>{
  let list=[song(1,10,'A')];
  let result=toggleFavorite(list,song(2,20,'B'));
  assert.equal(result.added,true);assert.deepEqual(result.list.map(f=>f.t),['10','20']);
  assert.ok(hasFavorite(result.list,20));
  result=toggleFavorite(result.list,song(2,20,'B'));
  assert.equal(result.added,false);assert.deepEqual(result.list.map(f=>f.t),['10']);
  assert.equal(toggleFavorite(list,{a:'x'}).added,false);
  assert.deepEqual(removeFavorite([song(1,1),song(1,2)],'1').map(f=>f.t),['2']);
});
test('merging appends new songs, keeps order and fills in missing titles',()=>{
  const current=[song(1,1,'One'),song(2,2,'')];
  const {list,added}=mergeFavorites(current,[song(2,2,'Two'),song(3,3,'Three'),song(1,1,'Changed'),{bad:true}]);
  assert.equal(added,1);
  assert.deepEqual(list,[song(1,1,'One'),song(2,2,'Two'),song(3,3,'Three')]);
  assert.deepEqual(current[1],song(2,2,''),'merging must not mutate the original');
});
test('artists of favorite songs keep first-favorited order and are distinct',()=>{
  assert.deepEqual([...favoriteArtistIds([song(7,1),song(5,2),song(7,3)])],['7','5']);
});
test('link payload round-trips ids and drops malformed pairs',()=>{
  const list=[song(603609,2292437,'A'),song(603037,12,'B'),song(5,6)];
  const link=encodeFavoritesLink('https://melodia.lol/?artist=x&id=1#frag',list);
  const url=new URL(link);
  assert.equal(url.origin+url.pathname,'https://melodia.lol/');assert.deepEqual([...url.searchParams.keys()],['f']);assert.equal(url.hash,'');
  assert.deepEqual(decodeFavoritesPayload(url.searchParams.get('f')),list.map(f=>song(f.a,f.t)));
  assert.deepEqual(decodeFavoritesPayload('d0b9-1o2v.zzzzzzzzzz-1.abc.1-2-3.'+'<script>').length,1);
  assert.deepEqual(decodeFavoritesPayload(''),[]);assert.deepEqual(decodeFavoritesPayload(null),[]);
});
test('a full-size QR list fits comfortably in the link',()=>{
  const list=Array.from({length:QR_LIMIT},(_,i)=>song(603000+i,2290000+i*7));
  const link=encodeFavoritesLink('https://melodia.lol/',list);
  assert.ok(link.length<1000,`${link.length} bytes`);
  const long=encodeFavoritesLink('https://melodia.lol/',Array.from({length:LINK_LIMIT},(_,i)=>song(603000+i,2290000+i*7)));
  assert.ok(long.length<2400,`${long.length} bytes`);
});
test('file export is readable JSON and imports back losslessly',()=>{
  const list=[song(603609,2292437,'Here We Go'),song(5,241,'Simple Exercice')];
  const text=favoritesToFile(list,id=>id==='5'?'Both':'',new Date('2026-11-09T12:00:00Z'));
  const data=JSON.parse(text);
  assert.equal(data.app,'melodia');assert.equal(data.exported,'2026-11-09');
  assert.deepEqual(data.favorites[1],{artist:5,artistName:'Both',track:241,title:'Simple Exercice',link:'https://www.jamendo.com/track/241'});
  assert.equal(data.favorites[0].artistName,undefined);
  assert.deepEqual(favoritesFromFile(text),list);
  for(const bad of ['not json','{}','{"app":"other","favorites":[]}','{"app":"melodia","favorites":"x"}','null'])assert.throws(()=>favoritesFromFile(bad),/not a Melodia favorites file/);
  assert.deepEqual(favoritesFromFile('{"app":"melodia","favorites":[{"artist":1,"track":2},{"artist":"x"}]}'),[song(1,2)]);
});
test('QR matrix is square, has finder patterns and grows with the text',()=>{
  const small=qrMatrix('https://melodia.lol/?f=1-2'),large=qrMatrix('https://melodia.lol/?f='+'a1b2c3-d4e5f6.'.repeat(60));
  assert.equal(small.length,small[0].length);assert.ok(large.length>small.length);assert.equal((small.length-17)%4,0);
  for(const [r,c] of [[0,0],[0,small.length-7],[small.length-7,0]]){
    for(let i=0;i<7;i++){assert.equal(small[r][c+i],true);assert.equal(small[r+6][c+i],true);assert.equal(small[r+i][c],true);assert.equal(small[r+i][c+6],true);}
    assert.equal(small[r+1][c+1],false);assert.equal(small[r+3][c+3],true);
  }
  assert.throws(()=>qrMatrix('x'.repeat(4000)));
});
