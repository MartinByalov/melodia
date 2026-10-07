import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('directory final rules apply equal gaps from header, right edge and footer',async()=>{
  const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  const rules=css.slice(css.indexOf('/* Equal gaps'));
  assert.match(rules,/top:calc\(72px \+ var\(--directory-gap\)\);right:var\(--directory-gap\)/);
  assert.match(rules,/bottom:calc\(var\(--player-bottom\) \+ var\(--player-half-height,40px\) \+ var\(--directory-gap\)\)/);
  assert.match(rules,/top:calc\(var\(--mobile-header\) \+ var\(--directory-gap\)\)/);
  assert.match(rules,/bottom:calc\(var\(--player-bottom\) \+ var\(--player-half-height,85px\) \+ var\(--directory-gap\)\)/);
});

test('day share borders are dark in normal, hover and keyboard focus states',async()=>{
  const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  const rules=css.slice(css.indexOf('/* Equal gaps'));
  assert.match(rules,/\.dialog-close\{border-color:#64748b\}/);
  assert.match(rules,/\.dialog-close:focus-visible\{border-color:#334155\}/);
  for(const selector of ['.share-links button','#copy-link','.dialog-close']){
    assert.ok(rules.includes(`body[data-mode=day] #share-dialog ${selector}:hover`));
  }
});

test('stronger globe pulse preserves smoothing, hover protection and reduced motion',async()=>{
  const source=await readFile(new URL('../public/globe.js',import.meta.url),'utf8');
  assert.match(source,/playing&&!globeHovered&&!reducedMotion\?/);
  assert.match(source,/\)\*9\.5:0/);
  assert.match(source,/Math\.min\(13,animate\.smoothedPulse\*styleProfile\.pulse\)/);
  assert.match(source,/\?35:150/);
  assert.match(source,/Math\.exp\(-dt\/pulseDuration\)/);
});