import test from 'node:test';
import assert from 'node:assert/strict';
import {safeHomepage,stationUrl,continuePlayback} from '../public/station-details.js';
import {normalizeStation} from '../public/radio.js';
import {compactStation} from '../scripts/compact-stations.js';

test('station websites reject executable URLs and credentials, without inventing a homepage',()=>{
  for(const value of [undefined,'','javascript:alert(1)','data:text/html,test','https://user:pass@example.org'])assert.equal(safeHomepage(value),'');
  assert.equal(safeHomepage('https://example.org'),'https://example.org/');
  const raw={stationuuid:'a',name:'Radio',url:'https://stream.example/live',homepage:'https://radio.example',lastcheckok:1};
  assert.equal(normalizeStation(compactStation(raw),false).homepage,'https://radio.example/');
  assert.equal(normalizeStation({...raw,homepage:undefined},false).homepage,'');
});
test('readable station links retain UUID identity and preserve embed mode',()=>{
  const url=stationUrl('https://melodia.lol/?station=old&radio=wrong&embed=1',{name:'Café FM',id:'unique-id'});
  assert.equal(url.searchParams.get('radio'),'cafe-fm');
  assert.equal(url.searchParams.get('station'),'unique-id');
  assert.equal(url.searchParams.get('embed'),'1');
  assert.equal(url.pathname,'/');
});
test('station selection preserves pause and only continues active playback',()=>{
  for(const state of [undefined,'ready','paused','error'])assert.equal(continuePlayback(state),false);
  for(const state of ['playing','loading'])assert.equal(continuePlayback(state),true);
});