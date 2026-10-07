import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('static application selectors resolve to elements in index.html',async()=>{
  const [html,app,globe]=await Promise.all(['index.html','app.js','globe.js'].map(name=>readFile(new URL(`../public/${name}`,import.meta.url),'utf8')));
  const ids=new Set([...html.matchAll(/\bid="([^"]+)"/g)].map(match=>match[1]));
  const classes=new Set([...html.matchAll(/\bclass="([^"]+)"/g)].flatMap(match=>match[1].split(/\s+/)));
  const selectors=[...app.matchAll(/\$\(['"]([#.][\w-]+)['"]\)/g),...globe.matchAll(/document\.querySelector\(['"]([#.][\w-]+)['"]\)/g)].map(match=>match[1]);
  assert.ok(selectors.includes('#mode-toggle'));
  assert.ok(selectors.includes('.player'));
  for(const selector of selectors){
    assert.ok(selector.startsWith('#')?ids.has(selector.slice(1)):classes.has(selector.slice(1)),`${selector} is missing from index.html`);
  }
  assert.match(app,/modeToggle\.addEventListener\('click'/);
  assert.match(globe,/player\.getBoundingClientRect\(\)\.top/);
});

test('reduce-effects controls never select the body carrying the preference',async()=>{
  const source=await readFile(new URL('../public/site-info.js',import.meta.url),'utf8');
  assert.match(source,/document\.body\.dataset\.reduceEffects=String\(effective\)/);
  assert.match(source,/document\.querySelectorAll\('button\[data-reduce-effects\]'\)/);
  assert.match(source,/event\.target\.closest\('button\[data-reduce-effects\]'\)/);
  assert.doesNotMatch(source,/querySelectorAll\('\[data-reduce-effects\]'\)/);
});