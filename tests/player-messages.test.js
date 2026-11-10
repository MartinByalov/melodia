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