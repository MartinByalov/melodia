import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import vm from 'node:vm';
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

test('ordinary streams invoke play synchronously from the user gesture',async()=>{
  const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const body=source.slice(source.indexOf('async function playCurrent('),source.indexOf('function choose('));
  let played=0,resolvePreparation;
  const element={play(){played++;return Promise.resolve();}};
  const context=vm.createContext({audio:element,session:1,audioNeedsPreparation:false,
    audioPreparation:new Promise(resolve=>{resolvePreparation=resolve;}),audioGestureReceived:true,
    audioContext:{state:'suspended',resume:()=>new Promise(()=>{})},
    updatePlayerState(){},prepareAudioAnalysis(){},navigator:{userActivation:{isActive:true}}});
  vm.runInContext(body,context);
  const pending=vm.runInContext('playCurrent()',context);
  assert.equal(played,1);
  resolvePreparation(true);
  await pending;
});

test('HLS does not request playback after user activation has expired',async()=>{
  const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const body=source.slice(source.indexOf('async function playCurrent('),source.indexOf('function choose('));
  let played=0,resolvePreparation,state;
  const element={play(){played++;return Promise.resolve();}};
  const context=vm.createContext({audio:element,session:1,audioNeedsPreparation:true,
    audioPreparation:new Promise(resolve=>{resolvePreparation=resolve;}),audioGestureReceived:false,
    audioContext:null,navigator:{userActivation:{isActive:true}},loadingTimer:null,clearTimeout(){},
    updatePlayerState(value){state=value;},prepareAudioAnalysis(){},toast(){}});
  vm.runInContext(body,context);
  const pending=vm.runInContext('playCurrent()',context);
  context.navigator.userActivation.isActive=false;
  resolvePreparation(true);
  await pending;
  assert.equal(played,0);
  assert.equal(state,'ready');
});

test('startup player measurements run in the resize observer, not synchronously during module evaluation',async()=>{
  const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const setup=source.slice(source.indexOf('function measurePlayer()'),source.indexOf('let nowPlaying='));
  assert.match(setup,/new ResizeObserver\(measurePlayer\)/);
  assert.doesNotMatch(setup,/^measurePlayer\(\);/m);
});