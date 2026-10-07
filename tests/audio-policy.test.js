import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {embedCode} from '../public/embed.js';

test('audio analysis waits for trusted user interaction',async()=>{
  const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(source,/let audioGestureReceived=false/);
  assert.match(source,/if\(!audioGestureReceived\|\|!audio\?\.crossOrigin/);
  assert.match(source,/if\(!event\.isTrusted\)return/);
  assert.match(source,/if\(audioGestureReceived&&audioContext\?\.state==='suspended'\)/);
});

test('embed omits unsupported clipboard policy and preserves fullscreen',async()=>{
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/allow="[^"]*clipboard-write/);
  assert.match(embedCode('https://example.com/',{id:'abc',name:'Test'}),/allow="fullscreen"/);
});