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
  assert.match(app,/\$\('#share-coffee'\)\.addEventListener\('click',\(\)=>\{[\s\S]*?window\.open\('https:\/\/ko-fi\.com\/eon','_blank','noopener,noreferrer'\);\s*\}\);/);
  assert.doesNotMatch(app,/\$\('#help'\)/);
  assert.doesNotMatch(app,/Support link is not configured yet/);
});

test('the header has no coffee button; support stays in About and Share',async()=>{
  const [html,info]=await Promise.all(['index.html','site-info.js'].map(file=>readFile(new URL('../public/'+file,import.meta.url),'utf8')));
  assert.doesNotMatch(html,/id="help"|coffee-button/);
  assert.match(html,/id="share-coffee"/);
  assert.match(info,/id="about-coffee"/);
});
