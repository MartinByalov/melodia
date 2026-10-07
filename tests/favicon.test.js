import test from 'node:test';
import assert from 'node:assert/strict';
import {faviconURL,createThemeFavicon} from '../public/favicon.js';

test('favicon represents the logo with two theme-colored concentric circles',()=>{
  const svg=decodeURIComponent(faviconURL('#ff9933').split(',')[1]);
  assert.equal((svg.match(/<circle /g)||[]).length,2);
  assert.match(svg,/stroke="#ff9933"/);
  assert.doesNotMatch(svg,/<path/);
  assert.throws(()=>faviconURL('red" onload="bad'),/Invalid/);
});

test('station color updates immediately and repeated colors do not rewrite the icon',()=>{
  let writes=0,href='';
  const link={set href(value){writes++;href=value;}};
  const icon=createThemeFavicon(link);
  icon.update('#62efc5');icon.update('#62efc5');assert.equal(writes,1);
  icon.update('#ffffff',true);assert.equal(writes,1);
  icon.update('#123456');assert.equal(writes,2);
  assert.match(decodeURIComponent(href),/#123456/);
  icon.dispose();
});

test('animated colors are coalesced to the latest theme rather than updated per frame',t=>{
  t.mock.timers.enable({apis:['setTimeout']});
  const link={},icon=createThemeFavicon(link);
  icon.update('#62efc5');const initial=link.href;
  icon.update('#123456',true);icon.update('#abcdef',true);
  t.mock.timers.tick(1499);assert.equal(link.href,initial);
  t.mock.timers.tick(1);assert.match(decodeURIComponent(link.href),/#abcdef/);
  icon.update('#ffffff',true);icon.dispose();
  t.mock.timers.tick(1500);assert.match(decodeURIComponent(link.href),/#abcdef/);
});