import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('mobile overrides keep controls accessible, menus bounded and account for safe areas',async()=>{
  const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  const mobile=css.slice(css.indexOf('/* Mobile layout:'));
  assert.match(mobile,/env\(safe-area-inset-bottom,0px\)/);
  assert.match(mobile,/grid-template-rows:44px 48px 44px/);
  assert.match(mobile,/\.player \.volume\{display:flex/);
  assert.match(mobile,/\.header-genres\{[^}]*overflow-x:auto/);
  assert.match(mobile,/\.discover-panel\{[^}]*bottom:var\(--player-bottom\)/);
  assert.match(mobile,/\.search-box input\{font-size:16px/);
  assert.match(mobile,/@media\(max-width:760px\) and \(max-height:500px\)/);
  assert.match(mobile,/@media\(hover:none\)/);
});