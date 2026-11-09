import test from 'node:test';
import assert from 'node:assert/strict';
import {safeHomepage,stationUrl,continuePlayback} from '../public/station-details.js';

test('artist websites reject executable URLs and credentials, without inventing a homepage',()=>{
  for(const value of [undefined,'','javascript:alert(1)','data:text/html,test','https://user:pass@example.org'])assert.equal(safeHomepage(value),'');
  assert.equal(safeHomepage('https://example.org'),'https://example.org/');
});
test('readable artist links keep the artist ID and preserve embed mode',()=>{
  const url=stationUrl('https://melodia.lol/?station=old&radio=wrong&artist=x&id=y&embed=1',{name:'Aren Blake',id:'8296'});
  assert.equal(url.search,'?embed=1&artist=aren-blake&id=8296');
  assert.equal(url.searchParams.get('artist'),'aren-blake');
  assert.equal(url.searchParams.get('id'),'8296');
  assert.equal(url.searchParams.has('radio'),false);assert.equal(url.searchParams.has('station'),false);
  assert.equal(url.searchParams.get('embed'),'1');
  assert.equal(url.pathname,'/');
});
test('station selection preserves pause and only continues active playback',()=>{
  for(const state of [undefined,'ready','paused','error'])assert.equal(continuePlayback(state),false);
  for(const state of ['playing','loading'])assert.equal(continuePlayback(state),true);
});