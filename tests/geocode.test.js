import test from 'node:test';
import assert from 'node:assert/strict';
import {deflateRawSync} from 'node:zlib';
import {seededRandom,buildBorders,pointInCountry,createGeocoder,readZipEntry,parseCities,parseCountryInfo} from '../scripts/geocode.js';

const square={type:'Feature',properties:{ADM0_A3:'BGR',ISO_A3:'-99'},geometry:{type:'Polygon',coordinates:[[[22,41],[28,41],[28,44],[22,44],[22,41]]]}};
const holed={type:'Feature',properties:{ADM0_A3:'ITA'},geometry:{type:'Polygon',coordinates:[[[0,0],[10,0],[10,10],[0,10],[0,0]],[[2,2],[8,2],[8,8],[2,8],[2,2]]]}};
const borders=buildBorders({features:[square,holed,{properties:{ADM0_A3:'XXX'},geometry:{type:'Point',coordinates:[0,0]}}]});
const places=[
  {name:'Sofia',alt:['София','Sofiya'],cc:'BG',lat:42.7,lon:23.32,pop:1200000},
  {name:'Plovdiv',alt:[],cc:'BG',lat:42.15,lon:24.75,pop:340000},
  {name:'Paris',alt:[],cc:'FR',lat:48.85,lon:2.35,pop:2100000},
  {name:'Paris',alt:[],cc:'US',lat:33.66,lon:-95.56,pop:25000}
];
const iso3to2=new Map([['BGR','BG'],['FRA','FR'],['USA','US'],['ITA','IT']]);
const geocode=createGeocoder({places,iso3to2,borders});

test('seeded randomness is stable per id and differs between ids',()=>{
  const a=seededRandom('42'),b=seededRandom('42'),c=seededRandom('43');
  const first=[a(),a(),a()];
  assert.deepEqual(first,[b(),b(),b()]);
  assert.notDeepEqual(first,[c(),c(),c()]);
  for(const value of first)assert.ok(value>=0&&value<1);
});
test('borders index by ADM0 code and ignore non-polygon features',()=>{
  assert.ok(borders.has('BGR'));assert.ok(borders.has('ITA'));assert.ok(!borders.has('XXX'));assert.ok(!borders.has('-99'));
});
test('country placement stays inside the border and avoids holes',()=>{
  const random=seededRandom('holes');
  for(let i=0;i<200;i++){
    const {lat,lon}=pointInCountry(borders.get('BGR'),random);
    assert.ok(lon>=22&&lon<=28&&lat>=41&&lat<=44);
    const point=pointInCountry(borders.get('ITA'),random);
    assert.ok(!(point.lon>2&&point.lon<8&&point.lat>2&&point.lat<8),'point fell inside the hole');
  }
});
test('keeps coordinates supplied by Jamendo',()=>{
  const placed=geocode({id:'1',country:'BGR',city:'Sofia',latitude:'42.5',longitude:'23.1'});
  assert.deepEqual(placed,{lat:42.5,lon:23.1,level:0,cc:'BG'});
});
test('treats null and 0/0 coordinates as missing',()=>{
  for(const [latitude,longitude] of [[null,null],['0','0'],[0,0],['','']])assert.notEqual(geocode({id:'2',country:'BGR',city:'Sofia',latitude,longitude}).level,0);
});
test('finds a city inside the artist\'s own country, in any script and spelling',()=>{
  for(const city of ['Sofia','sofia','София','Sofiya, Bulgaria','Sofia 1000','1000 Sofia']){
    const placed=geocode({id:'3',country:'BGR',city,latitude:null,longitude:null});
    assert.equal(placed.level,1,city);
    assert.ok(Math.abs(placed.lat-42.7)<.6&&Math.abs(placed.lon-23.32)<.9,city);
  }
  const paris=geocode({id:'4',country:'USA',city:'Paris',latitude:null,longitude:null});
  assert.ok(paris.lon<-90,'Paris must resolve within the US, not France');
});
test('reports the gazetteer name of the matched city',()=>{
  assert.equal(geocode({id:'9',country:'BGR',city:'софия',latitude:null,longitude:null}).place,'Sofia');
});
test('spreads artists of one city around it instead of stacking them',()=>{
  const spots=new Set();
  for(let i=0;i<30;i++){const p=geocode({id:`crowd${i}`,country:'BGR',city:'Plovdiv',latitude:null,longitude:null});spots.add(`${p.lat.toFixed(3)},${p.lon.toFixed(3)}`);assert.ok(Math.abs(p.lat-42.15)<.6);}
  assert.ok(spots.size>25);
});
test('falls back to a point inside the country when the city is unknown or missing',()=>{
  for(const city of ['','Atlantis','x'.repeat(200)]){
    const placed=geocode({id:'5',country:'BGR',city,latitude:null,longitude:null});
    assert.equal(placed.level,2);assert.ok(placed.lon>=22&&placed.lon<=28&&placed.lat>=41&&placed.lat<=44);
  }
});
test('uses the most populous place when a country has no border geometry',()=>{
  const placed=geocode({id:'6',country:'FRA',city:'',latitude:null,longitude:null});
  assert.equal(placed.level,2);assert.ok(Math.abs(placed.lat-48.85)<.5);
});
test('skips artists in unknown countries',()=>{
  assert.equal(geocode({id:'7',country:'ZZZ',city:'Sofia',latitude:null,longitude:null}),null);
});
test('is deterministic across runs',()=>{
  const again=createGeocoder({places,iso3to2,borders});
  const input={id:'8',country:'BGR',city:'Atlantis',latitude:null,longitude:null};
  assert.deepEqual(again(input),createGeocoder({places,iso3to2,borders})(input));
});

function zip(name,content){
  const data=Buffer.from(content),packed=deflateRawSync(data),nameBuffer=Buffer.from(name);
  const local=Buffer.alloc(30);local.writeUInt32LE(0x04034b50,0);local.writeUInt16LE(8,8);local.writeUInt32LE(packed.length,18);local.writeUInt32LE(data.length,22);local.writeUInt16LE(nameBuffer.length,26);
  const central=Buffer.alloc(46);central.writeUInt32LE(0x02014b50,0);central.writeUInt16LE(8,10);central.writeUInt32LE(packed.length,20);central.writeUInt32LE(data.length,24);central.writeUInt16LE(nameBuffer.length,28);central.writeUInt32LE(0,42);
  const end=Buffer.alloc(22);end.writeUInt32LE(0x06054b50,0);end.writeUInt16LE(1,8);end.writeUInt16LE(1,10);
  const directory=Buffer.concat([central,nameBuffer]);
  end.writeUInt32LE(directory.length,12);end.writeUInt32LE(30+nameBuffer.length+packed.length,16);
  return Buffer.concat([local,nameBuffer,packed,directory,end]);
}
test('reads a deflated entry from a ZIP archive and rejects other input',()=>{
  const archive=zip('cities.txt','hello gazetteer');
  assert.equal(readZipEntry(archive,'cities.txt').toString(),'hello gazetteer');
  assert.throws(()=>readZipEntry(archive,'missing.txt'),/not found/);
  assert.throws(()=>readZipEntry(Buffer.from('not a zip at all, definitely'),'x'),/Not a ZIP/);
});
test('parses GeoNames place and country tables',()=>{
  const row=['1','Sofia','Sofia','Sofiya,София','42.69','23.32','P','PPLC','BG','','','','','','1200000'].join('\t');
  assert.deepEqual(parseCities(`${row}\n\n`),[{name:'Sofia',alt:['Sofia','Sofiya','София'],cc:'BG',lat:42.69,lon:23.32,pop:1200000}]);
  const info=parseCountryInfo('#comment\nBG\tBGR\t100\tBU\tBulgaria\tSofia\n');
  assert.equal(info.iso3to2.get('BGR'),'BG');assert.equal(info.names.get('BG'),'Bulgaria');
});
