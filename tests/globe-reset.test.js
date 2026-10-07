import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('axis reset button is an action rather than a rotation toggle',async()=>{
  const [app,html,globe]=await Promise.all(['app.js','index.html','globe.js'].map(file=>readFile(new URL('../public/'+file,import.meta.url),'utf8')));
  assert.match(app,/\$\('#rotate'\)\.addEventListener\('click', \(\) => \{ globe\?\.resetAxis\(\); \}\)/);
  assert.doesNotMatch(app,/syncRotation|toggleRotate/);
  const button=html.match(/<button[^>]*id="rotate"[^>]*>/)[0];
  assert.match(button,/aria-label="Reset globe"/);
  assert.match(button,/title="Reset globe"/);
  assert.doesNotMatch(button,/aria-pressed/);
  assert.match(globe,/resetAxis\(\).*controls\.reset\(\).*camera\.position\.copy\(start\)\.setLength\(distance\).*camera\.up\.set\(0,1,0\)/);
});