import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('all notifications use the globe overlay, including failed streams, with no floating toast',async()=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/function toast\(text\) \{ setPlayerMessage\(text\); \}/);
  assert.doesNotMatch(app,/\$\('#toast'\)\.style\.display\s*=\s*'block'/);
  assert.match(app,/toast\('This stream cannot be played\. Try another station\.'\)/);
  assert.ok(app.includes("$('#world-message').textContent=text"));
  assert.ok(app.includes("['playing','paused','ready'].includes(state)"));
});