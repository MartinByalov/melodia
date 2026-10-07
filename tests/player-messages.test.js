import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('all notifications use the player line, including failed streams, with no floating toast',async()=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/function toast\(text\) \{ setPlayerMessage\(text\); \}/);
  assert.doesNotMatch(app,/\$\('#toast'\)\.style\.display\s*=\s*'block'/);
  assert.match(app,/toast\('This stream cannot be played\. Try another station\.'\)/);
  assert.match(app,/if\(playing&&document.body.dataset.loading!=='true'\)setPlayerMessage\(''\)/);
});