import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('all notifications use the globe overlay, including failed tracks, with no floating toast',async()=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/function toast\(text\) \{ setPlayerMessage\(text\); \}/);
  assert.doesNotMatch(app,/\$\('#toast'\)\.style\.display\s*=\s*'block'/);
  // Playback problems use the player's moving line instead of the globe overlay.
  assert.match(app,/notify\('This track cannot be played\. Try another artist\.'\)/);
  assert.match(app,/function notify\(text,ms=0\)/);
  assert.doesNotMatch(app,/toast\('This track cannot be played/);
  assert.ok(app.includes("$('#world-message').textContent=text"));
  assert.ok(app.includes("['playing','paused','ready'].includes(state)"));
});