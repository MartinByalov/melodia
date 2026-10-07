import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';

test('share copy label is text-only and share close uses the common icon button',async()=>{
  const source=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  assert.match(source,/<button id="copy-link" class="copy-button">Copy Link<\/button>/);
  assert.match(source,/<dialog id="share-dialog"><button class="dialog-close icon-button"/);
});

test('day share text and icons stay dark including hover and focus',async()=>{
  const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.match(css,/body\[data-mode=day\] #share-dialog #copy-link:focus-visible\{color:#151924\}/);
  assert.match(css,/body\[data-mode=day\] #share-dialog #share-description\{color:#151924\}/);
  assert.match(css,/body\[data-mode=day\] #catalog-close:focus-visible\{background:#cbd5e1;color:#151924\}/);
  assert.match(css,/\.discover-panel #random svg\{width:16px;height:16px\}/);
  assert.match(css,/\.country-trigger,\.station-filters select,body\[data-mode=day\] \.station-filters select\{background-image:/);
});