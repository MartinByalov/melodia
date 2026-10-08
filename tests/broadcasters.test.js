import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('station reports use the provided contact and are reachable from the main page',async()=>{
  const [page,index,info]=await Promise.all(['broadcasters.html','index.html','site-info.js'].map(name=>readFile(new URL(`../public/${name}`,import.meta.url),'utf8')));
  assert.match(index,/<a href="broadcasters\.html">Report station<\/a>/);
  assert.match(page,/<a href="mailto:evangelion\.conquest@gmail\.com\?subject=Melodia%20station%20report">evangelion\.conquest@gmail\.com<\/a>/);
  assert.doesNotMatch(page,/<form\b|formsubmit|Send report/i);
  assert.match(page,/Melodia does not send the message for you/);
  assert.doesNotMatch(info,/FormSubmit|formsubmit/);
  assert.match(page,/Request a correction or removal/);
  assert.match(page,/A listing does not mean that the station has approved Melodia/);
  assert.match(info,/href="broadcasters.html">report a station<\/a>/);
});