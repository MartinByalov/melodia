import test from 'node:test';
import assert from 'node:assert/strict';
import { embedCode, embedUrl } from '../public/embed.js';
import { readFile } from 'node:fs/promises';

test('Embed shows intro with mobile-style spacing and zoom fade at every frame width',async()=>{
  const [css,globe]=await Promise.all([readFile(new URL('../public/styles.css',import.meta.url),'utf8'),readFile(new URL('../public/globe.js',import.meta.url),'utf8')]);
  assert.match(css,/body\[data-embed=true\] \.intro.visible\{opacity:1\}/);
  assert.doesNotMatch(css,/body\[data-embed=true\] \.intro[^\n]*display:none/);
  assert.match(globe,/const mobileIntro=innerWidth<=760\|\|document.body.dataset.embed==='true'/);
  assert.match(globe,/const target=\(mobileDrift&&!idleMotion\.active\?mobileGlobeTarget:0\)\*entranceScale/);
  assert.match(globe,/const introTop=mobileIntro\?Math\.max\(18,\(playerTop-box\.top-2\*radius-rect\.height\)\/3\):18/);
  assert.match(globe,/const showIntro=visible&&\!\(mobileIntro&&idleMotion\.active\)/);
});

test('intro asks What\'s yours in the main and embedded views',async()=>{
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(html,/<h1>The world<br>has a <em>rhythm\.<\/em><br><span class="intro-question">What's yours\?<\/span><\/h1>/);
  assert.doesNotMatch(html,/Pick yours\./);
});

test('desktop question stays on one line without forcing mobile or embedded wrapping',async()=>{
  const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.match(css,/@media\(min-width:761px\)\{body:not\(\[data-embed=true\]\) \.intro-question\{white-space:nowrap\}\}/);
});

test('embed targets the selected station and strips diagnostics and fragments',()=>{
  const code=embedCode('https://example.com/radio/?perf=1&station=old#test',{id:'new',name:'Jazz FM'});
  assert.ok(code.includes('src="https://example.com/radio/?station=new&amp;embed=1"'));
  assert.equal(embedUrl('https://example.com/radio/?perf=1',{id:'new'}),'https://example.com/radio/?station=new&embed=1');
  assert.ok(code.includes('title="melodia · Jazz FM"'));
  assert.ok(code.includes('width="100%" height="600"'));
  assert.ok(code.includes('loading="lazy"'));
  assert.doesNotMatch(code,/autoplay|perf=|#test/);
});

test('embed UI provides icon copy, fixed code field and an on-demand preview with chrome-free player',async()=>{
  const [html,app,css]=await Promise.all([
    readFile(new URL('../public/index.html',import.meta.url),'utf8'),
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/styles.css',import.meta.url),'utf8')
  ]);
  assert.match(html,/aria-controls="embed-options">Embed<\/button>/);
  assert.match(html,/id="copy-embed"[^>]*aria-label="Copy embed code"[^>]*><svg/);
  assert.match(html,/<iframe id="embed-preview"/);
  assert.match(css,/#embed-code\{resize:none/);
  assert.match(css,/body\[data-embed=true\] header,body\[data-embed=true\] footer/);
  assert.match(css,/body\[data-embed=true\] \.player #favorite\{display:none!important\}/);
  assert.match(app,/#embed-preview'\)\.src=embedUrl/);
  assert.match(app,/addEventListener\('close',\(\)=>\$\('#embed-preview'\)\.removeAttribute\('src'\)\)/);
});

test('embed escapes station names and rejects script URLs',()=>{
  const code=embedCode('https://example.com/',{id:'a',name:'"><script>&'});
  assert.ok(code.includes('&quot;&gt;&lt;script&gt;&amp;'));
  assert.doesNotMatch(code,/<script>/);
  assert.throws(()=>embedCode('javascript:alert(1)',{id:'a',name:'a'}));
});

test('embed does not show the removed explanatory note',async()=>{
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  assert.doesNotMatch(html,/Paste this HTML|Playback starts only after pressing Play|Use a public HTTPS address, not localhost/);
});

test('empty genre results use the player moving line instead of a toast',async()=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/else setPlayerMessage\(stations.length\?'No stations available in this style\.'/);
  assert.doesNotMatch(app,/else toast\(stations.length\?'No stations available in this style\.'/);
  assert.match(app,/dataset.loading==='true'\?'The station directory is still loading\. Please try again\.':'No stations loaded'/);
});

test('embed uses two control rows, vertical accessible volume and prevents recursive embeds',async()=>{
  const [app,css]=await Promise.all([
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/styles.css',import.meta.url),'utf8')
  ]);
  assert.match(app,/top\.append\(\$\('#rotate'\),\$\('#previous'\),\$\('#play'\),\$\('#next'\),\$\('\.volume'\)\)/);
  assert.match(app,/bottom\.append\(\$\('\.player-left'\),\$\('#share'\)\)/);
  assert.match(app,/\$\('#embed-toggle'\)\.hidden=true/);
  assert.match(app,/if\(document\.body\.dataset\.embed==='true'\)return/);
  assert.match(css,/writing-mode:vertical-lr;direction:rtl/);
  assert.match(css,/\.volume:focus-within #volume/);
  assert.match(css,/\.volume\.volume-open #volume/);
  assert.match(css,/body\[data-embed=true\] \.player #globe-status,body\[data-embed=true\] \.player \.track-label\{display:none!important\}/);
  assert.match(css,/body\[data-embed=true\] \.player #previous,body\[data-embed=true\] \.player #next\{display:inline-flex/);
});

test('embed player spans frame width and globe uses only space above measured player',async()=>{
  const [app,css]=await Promise.all([
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/styles.css',import.meta.url),'utf8')
  ]);
  assert.match(app,/setProperty\('--embed-player-height',`\$\{height\}px`\)/);
  assert.match(css,/body\[data-embed=true\] main\{height:max\(0px,calc\(100dvh - var\(--embed-player-height,120px\)\)\)/);
  assert.match(css,/body\[data-embed=true\] \.player\{left:0;right:0;bottom:0;width:100%;max-width:none;transform:none;border-radius:0/);
});

test('share exposes embed code and clipboard fallback without autoplaying shared stations',async()=>{
  const [html,app]=await Promise.all([
    readFile(new URL('../public/index.html',import.meta.url),'utf8'),
    readFile(new URL('../public/app.js',import.meta.url),'utf8')
  ]);
  assert.match(html,/id="embed-toggle"[^>]*aria-expanded="false"[^>]*aria-controls="embed-options"/);
  assert.match(html,/id="embed-code" readonly/);
  assert.match(app,/navigator\.clipboard\.writeText\(field\.value\)/);
  assert.match(app,/field\.focus\(\);field\.select\(\)/);
  assert.match(app,/choose\(s, false\)/);
});