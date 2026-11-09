import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';

test('player hover and focus tooltips use current accessible labels with mode-independent contrast',async()=>{
  const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.match(css,/\.player button\[aria-label\]::after\{content:attr\(aria-label\)/);
  assert.match(css,/background:#151924;color:#fff;font-size:11px/);
  assert.match(css,/\.player button\[aria-label\]:hover::after,\.player button\[aria-label\]:focus-visible::after\{opacity:1;visibility:visible\}/);
  assert.match(css,/\.player #share::after\{left:auto;right:0;transform:none\}/);
});

test('startup waits for map layers and catalogue, and player tooltips describe current actions',async()=>{
  const [app,html,globe]=await Promise.all(['app.js','index.html','globe.js'].map(file=>readFile(new URL('../public/'+file,import.meta.url),'utf8')));
  // The animated reveal on the globe is the only loading label; the plain message box stays hidden.
  assert.match(html,/<div id="world-status"[^>]*hidden><span id="world-message"><\/span><\/div>/);
  assert.doesNotMatch(app,/Loading World Vibe/);
  assert.match(app,/Promise\.all\(\[refresh\(\),globe\?\.ready/);
  assert.match(globe,/pendingMaps=new Set\(\['overview','detail','district'\]\)/);
  // Startup waits for the overview map only; detail and district layers load in the background.
  assert.match(globe,/if\(kind==='overview'\)resolveReady\(!failed\)/);
  assert.doesNotMatch(globe,/if\(!pendingMaps\.size\)resolveReady/);
  assert.match(app,/favorite\?'Remove this song from favorites':'Add this song to favorites'/);
  assert.match(app,/title=playing\?'Pause':'Play'/);
});

test('loading message sits after reset in the player with a reduced-motion-safe moving line',async()=>{
  const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(css,/\.player #globe-status\{position:static/);
  assert.match(css,/animation:player-message-scroll/);
  assert.match(css,/padding-left:100%;white-space:nowrap;animation:player-message-scroll/);
  assert.match(css,/max-width:280px/);
  assert.match(css,/prefers-reduced-motion:reduce\)\{\.player-moving-line span\{animation:none/);
  assert.ok(html.indexOf('id="globe-status"')>html.indexOf('id="rotate"'));
  assert.match(html,/<div class="player-right">\s*<div id="globe-status"/);
  assert.match(app,/setPlayerMessage\(stations.length\?'':'No artists loaded'\)/);
  assert.doesNotMatch(css,/body\[data-loading=true\][^\n]*visibility:hidden/);
  assert.doesNotMatch(css,/body\[data-loading=true\] #globe-status\{position:fixed/);
});

test('mute synchronizes actual audio, accessible state and crossed speaker without losing volume',async()=>{
  const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const body=source.slice(source.indexOf('function syncVolume(){'),source.indexOf('// Favorites are songs'));
  const button={setAttribute(key,value){this[key]=value;},title:'',innerHTML:''};
  const volume={value:'0.7'},audio={};
  const context=vm.createContext({audio,muted:false,$:selector=>selector==='#mute'?button:volume});
  vm.runInContext(body,context);vm.runInContext('syncVolume()',context);
  assert.equal(audio.volume,.7);assert.equal(audio.muted,false);assert.equal(button['aria-label'],'Mute');
  vm.runInContext('muted=true;syncVolume()',context);
  assert.equal(audio.muted,true);assert.equal(audio.volume,.7);assert.equal(button['aria-pressed'],'true');
  assert.match(button.innerHTML,/m16 9 5 6m0-6-5 6/);
  vm.runInContext('muted=false;syncVolume()',context);
  assert.equal(audio.muted,false);assert.equal(button.title,'Mute');
  volume.value='0';vm.runInContext('syncVolume()',context);
  assert.equal(button.title,'Unmute');assert.equal(audio.volume,0);
});
test('previous and next walk the selected artist playlist and never switch artist',async()=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/\$\('#next'\)\.addEventListener\('click', \(\) => stepPlaylist\(1\)\); \$\('#previous'\)\.addEventListener\('click', \(\) => stepPlaylist\(-1\)\)/);
  const step=app.slice(app.indexOf('async function stepPlaylist'),app.indexOf("$('#next').addEventListener"));
  assert.match(step,/await ensureTracks\(artist\)/);
  assert.match(step,/count < 2/);
  assert.match(step,/This artist has no other tracks\./);
  assert.match(step,/\(artist\.trackIndex \?\? 0\) \+ delta \+ count\) % count/);
  assert.match(step,/if \(!artist\) \{ adjacent\(delta\); return; \}/);
  assert.doesNotMatch(step.slice(step.indexOf('count < 2')),/adjacent\(/);
  assert.match(step,/continuePlayback\(document\.body\.dataset\.playerState\)/);
});

test('the player square shows the artist picture and falls back to the music note',async()=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/setAlbumImage\(artistImageUrl\(s\.id\)\)/);
  assert.match(app,/if \(track\.image\) setAlbumImage\(track\.image\)/);
  assert.match(app,/image\.referrerPolicy = 'no-referrer'/);
  assert.match(app,/addEventListener\('error', \(\) => \{ if \(album\.firstChild === image\) album\.innerHTML = ALBUM_NOTE; \}\)/);
});
