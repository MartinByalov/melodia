import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('social brands use filled local SVG and new networks have matching share targets',async()=>{
  const [html,app,css]=await Promise.all(['index.html','app.js','styles.css'].map(file=>readFile(new URL('../public/'+file,import.meta.url),'utf8')));
  for(const network of ['facebook','x','whatsapp','telegram','reddit']){
    const button=html.match(new RegExp(`<button data-network="${network}"[^>]*>(.*?)</button>`,'s'));
    assert.ok(button,network);
    assert.match(button[1],/fill="currentColor"/);
    assert.match(button[1],/<path d="/);
    assert.doesNotMatch(button[1],/https:|<script|stroke=/);
  }
  assert.match(app,/telegram: `https:\/\/t.me\/share\/url\?url=\$\{url\}&text=\$\{text\}`/);
  assert.match(app,/reddit: `https:\/\/www.reddit.com\/submit\?url=\$\{url\}&title=\$\{text\}&type=LINK`/);
  assert.match(css,/\.coffee-link,#info-dialog #about-coffee,#share-dialog #share-coffee\{[^}]*border:1px solid #2184b0/);
});

test('Share has mode-independent hover effects and accent-colored expanded Embed',async()=>{
  const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.match(css,/#share-dialog #embed-toggle\[aria-expanded=true\]\{color:var\(--accent\);background:rgba/);
  assert.match(css,/#share-dialog #share-coffee:active\{transform:scale\(\.98\)\}/);
  assert.match(css,/#share-dialog #share-coffee:hover,#share-dialog #share-coffee:focus-visible/);
});

test('coffee haptic feedback is optional and does not prevent the existing action',async()=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/navigator\.vibrate\?\.\(12\)/);
  assert.match(app,/catch\{\/\* Optional feedback must not block the button\. \*\/\}/);
  assert.match(app,/\$\('#help'\)\.click\(\)/);
  assert.match(app,/\$\('#help'\)\.addEventListener\('click', \(\) => \{ window\.open\('https:\/\/ko-fi\.com\/martinbyalov','_blank','noopener,noreferrer'\); \}\)/);
  assert.doesNotMatch(app,/Support link is not configured yet/);
});

test('header coffee keeps its icon and square shape with blue hover in both themes',async()=>{
  const [html,css]=await Promise.all(['index.html','styles.css'].map(file=>readFile(new URL('../public/'+file,import.meta.url),'utf8')));
  assert.match(html,/<button class="icon-button coffee-button" id="help"[^>]*aria-label="Buy me a Coffee"[^>]*><svg[^>]*>[\s\S]*?<\/svg><\/button>/);
  assert.match(css,/\.header-right #help\{box-sizing:border-box;width:40px!important;height:40px!important;min-width:40px!important;flex:0 0 40px/);
  assert.match(css,/\.header-right #help:hover,\.header-right #help:focus-visible\{background:#299bd0;color:#fff\}/);
  for(const mode of ['day','night'])assert.match(css,new RegExp(`body\\[data-mode=${mode}\\] \\.header-right #help:hover,body\\[data-mode=${mode}\\] \\.header-right #help:focus-visible\\{background:#299bd0;color:#fff\\}`));
  assert.doesNotMatch(css,/#help[^\n]*background:#ffce54/);
});