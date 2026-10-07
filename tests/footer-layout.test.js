import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('footer reaches the measured player center without covering its controls',async()=>{
  const [css,app]=await Promise.all([
    readFile(new URL('../public/styles.css',import.meta.url),'utf8'),
    readFile(new URL('../public/app.js',import.meta.url),'utf8')
  ]);
  assert.match(app,/playerHeightObserver=new ResizeObserver/);
  assert.match(app,/playerHeightObserver=new ResizeObserver\(measurePlayer\)/);
  assert.match(app,/setProperty\('--player-half-height',`\$\{height\/2\}px`\)/);
  assert.match(app,/playerHeightObserver\.observe\(\$\('\.player'\)\)/);
  const footer=css.slice(css.indexOf('/* Footer surface'));
  assert.match(footer,/height:calc\(var\(--player-bottom\) \+ var\(--player-half-height,40px\)\)/);
  assert.match(footer,/z-index:5;pointer-events:none/);
  assert.match(footer,/background:var\(--panel-surface\)/);
  assert.match(footer,/safe-area-inset-bottom/);
  assert.match(css,/footer\{align-items:center;padding:var\(--player-half-height,40px\) 16px 0\}/);
});

test('globe background and footer share the same boundary on desktop and mobile',async()=>{
  const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  const boundary=css.slice(css.indexOf('/* End the WebGL background'));
  assert.match(boundary,/main\{height:calc\(100dvh - 72px\);min-height:0\}/);
  for(const fallback of [40,85])assert.ok(boundary.includes(`#globe{inset:0 0 calc(var(--player-bottom) + var(--player-half-height,${fallback}px));height:auto}`));
  assert.match(boundary,/main\{height:calc\(100dvh - var\(--mobile-header\)\)\}/);
});

test('both directory views end at the footer and share mode-independent action tooltips',async()=>{
  const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  const directory=css.slice(css.indexOf('/* Both directory views'));
  assert.match(directory,/\.discover-panel\{bottom:calc\(var\(--player-bottom\) \+ var\(--player-half-height,40px\)\)/);
  assert.match(directory,/\.discover-panel\{bottom:calc\(var\(--player-bottom\) \+ var\(--player-half-height,85px\)\)/);
  assert.match(directory,/content:attr\(aria-label\)/);
  for(const id of ['random','clear-filters']){
    assert.ok(directory.includes(`#${id}:hover::after`));
    assert.ok(directory.includes(`#${id}:focus-visible::after`));
  }
  assert.match(directory,/background:#151924;color:#fff/);
});