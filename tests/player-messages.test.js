import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

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

test('phone layouts keep the artist live feed visible between notices',async()=>{
  const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  for(const layout of ['mobile-player','landscape-phone']){
    assert.ok(!css.includes(`body[data-${layout}=true] #station-homepage{display:none}`));
    assert.ok(!css.includes(`body[data-${layout}=true] #globe-status:not(:has(#player-notice:not([hidden]))){display:none}`));
  }
  assert.ok(css.includes('body[data-landscape-phone=true] .player>#globe-status:not([hidden]){display:block;grid-column:1/-1;grid-row:2;'));
});

test('favorites actions precede the QR code and scanning instructions',async()=>{
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const download=html.indexOf('id="favorites-download"'),copy=html.indexOf('id="favorites-copy"'),importFile=html.indexOf('id="favorites-import"');
  const qr=html.indexOf('id="favorites-qr"'),note=html.indexOf('id="favorites-qr-note"');
  assert.ok(download>0&&download<copy&&copy<importFile&&importFile<qr&&qr<note);
});