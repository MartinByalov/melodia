import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {SITE_URL,CONTACT_EMAIL,shareBase} from '../public/site.js';

test('shared links use the canonical address on both melodia.lol hosts',()=>{
  for(const hostname of ['www.melodia.lol','melodia.lol','WWW.MELODIA.LOL'])assert.equal(shareBase({hostname,origin:'https://'+hostname,pathname:'/'}),'https://www.melodia.lol/');
  assert.equal(SITE_URL,'https://www.melodia.lol/');
});
test('local development keeps its own address, and look-alike hosts are not treated as the site',()=>{
  assert.equal(shareBase({hostname:'localhost',origin:'http://localhost:3000',pathname:'/'}),'http://localhost:3000/');
  assert.equal(shareBase({hostname:'evil-melodia.lol.example.com',origin:'https://evil-melodia.lol.example.com',pathname:'/x'}),'https://evil-melodia.lol.example.com/x');
  assert.equal(shareBase({hostname:'notmelodia.lol',origin:'https://notmelodia.lol',pathname:'/'}),'https://notmelodia.lol/');
});
test('the custom domain file, canonical link and contact address agree with the site address',async()=>{
  const [cname,html,info]=await Promise.all([readFile(new URL('../CNAME',import.meta.url),'utf8'),readFile(new URL('../public/index.html',import.meta.url),'utf8'),readFile(new URL('../public/site-info.js',import.meta.url),'utf8')]);
  assert.equal(cname.trim(),new URL(SITE_URL).hostname);
  assert.match(html,new RegExp('<link rel="canonical" href="'+SITE_URL.replace(/[.*+?^${}()|[\]\\\/]/g,'\\$&')+'">'));
  assert.ok(info.includes('mailto:'+CONTACT_EMAIL),'the contact section uses the contact address');
  assert.match(CONTACT_EMAIL,/^contact@melodia\.lol$/);
});
test('share links, embed code and favorites links all go through the canonical base',async()=>{
  const [app,ui]=await Promise.all([readFile(new URL('../public/app.js',import.meta.url),'utf8'),readFile(new URL('../public/favorites-ui.js',import.meta.url),'utf8')]);
  assert.match(app,/stationUrl\(shareBase\(\),selected\)/);
  assert.equal((app.match(/embedCode\(shareBase\(\),selected\)/g)||[]).length,2);
  assert.doesNotMatch(app,/embedCode\(location\.href/);
  assert.match(ui,/const baseUrl = \(\) => shareBase\(\)/);
});
