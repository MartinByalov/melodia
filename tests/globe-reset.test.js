import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('desktop resets the axis and phones toggle rotation with a pause inside the reset arrow',async()=>{
  const [app,html,globe]=await Promise.all(['app.js','index.html','globe.js'].map(file=>readFile(new URL('../public/'+file,import.meta.url),'utf8')));
  assert.match(app,/if\(phoneRotation.matches\)\{\s*if\(!globe\?\.rotationPaused\)globe\?\.resetAxis\(\);\s*globe\?\.toggleRotate\(\);\s*\}else globe\?\.resetAxis\(\)/);
  assert.match(app,/max-width:760px\), \(orientation:landscape\) and \(max-height:500px/);
  assert.match(app,/M10 9v6m4-6v6/);
  assert.match(app,/phoneRotation.addEventListener\('change',syncGlobeButton\)/);
  assert.match(app,/rotateButton.setAttribute\('aria-pressed',String\(paused\)\)/);
  assert.match(globe,/get rotationPaused\(\)\{return rotationPaused;\}/);
  assert.match(globe,/rotationPaused\|\|loadingWorld\|\|reducedMotion/);
  const button=html.match(/<button[^>]*id="rotate"[^>]*>/)[0];
  assert.match(button,/aria-label="Reset globe"/);
  assert.match(button,/title="Reset globe"/);
  assert.doesNotMatch(button,/aria-pressed/);
  assert.match(globe,/resetAxis\(\).*controls\.reset\(\).*camera\.position\.copy\(start\)\.setLength\(distance\).*camera\.up\.set\(0,1,0\)/);
});