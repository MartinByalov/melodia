import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('player cover spacing matches its outer inset',async()=>{
  const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.ok(css.includes('.player-left{column-gap:19px}'));
});

test('all notifications use the player moving line, never the globe, with no floating toast',async()=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/function toast\(text\) \{ playerMessage=text; notify\(text,5000\); \}/);
  assert.doesNotMatch(app,/\$\('#toast'\)\.style\.display\s*=\s*'block'/);
  // Playback problems use the player's moving line instead of the globe overlay.
  assert.match(app,/notify\('This track cannot be played\. Try another artist\.'\)/);
  assert.match(app,/function notify\(text,ms=0\)/);
  assert.doesNotMatch(app,/toast\('This track cannot be played/);
  assert.doesNotMatch(app,/world-message|world-status/);
  assert.match(app,/function setPlayerMessage\(text\)\{\s*playerMessage=text;\s*notify\(text\);/);
  assert.match(app,/addEventListener\('globemessage',\s*event => notify\(event\.detail\)\)/);
  assert.ok(app.includes("['playing','paused','ready'].includes(state)"));
});

test('phone layouts never show the live feed, including notices',async()=>{
  const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.ok(css.includes('body[data-mobile-player=true] .player #globe-status,body[data-landscape-phone=true] .player #globe-status{display:none!important}'));
  assert.ok(css.includes('body[data-mode] .player #rotate{color:var(--icon-color);opacity:1}'));
});

test('favorites actions precede the QR code and scanning instructions',async()=>{
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const download=html.indexOf('id="favorites-download"'),copy=html.indexOf('id="favorites-copy"'),importFile=html.indexOf('id="favorites-import"');
  const qr=html.indexOf('id="favorites-qr"'),note=html.indexOf('id="favorites-qr-note"');
  assert.ok(download>0&&download<copy&&copy<importFile&&importFile<qr&&qr<note);
});