import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('melodia branding places the theme dot on i and preserves saved preferences',async()=>{
  const [html,css,app,embed]=await Promise.all(['index.html','styles.css','app.js','embed.js'].map(name=>readFile(new URL(`../public/${name}`,import.meta.url),'utf8')));
  assert.match(html,/<title>melodia/);
  assert.match(html,/aria-label="melodia home"/);
  assert.match(html,/brand-letter-i">i<span class="brand-i-dot" aria-hidden="true">i<\/span>/);
  assert.match(css,/\.brand-i-dot\{[^}]*color:var\(--accent\)/);
  assert.match(css,/\.brand-i-dot\{[^}]*inset:0;[^}]*clip-path:inset\(0 0 65% 0\)/);
  assert.doesNotMatch(css,/\.brand-i-dot\{[^}]*translateX/);
  assert.doesNotMatch(html,/<span class="brand-light">jam/);
  assert.doesNotMatch(app+embed,/World Jam/);
  assert.match(app,/worldjam-favorites/);
});