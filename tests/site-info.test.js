import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {openSiteDialog} from '../public/site-info.js';

test('footer information stays in dialogs with credits and copyright',async()=>{
  const html=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const source=await readFile(new URL('../public/site-info.js',import.meta.url),'utf8');
  assert.doesNotMatch(html,/POWERED BY RADIO-BROWSER/);
  for(const key of ['about','credits','privacy'])assert.ok(html.includes(`data-info="${key}"`));
  assert.match(html,/id="copyright-year"/);
  assert.match(source,/© OpenStreetMap contributors/);
  assert.match(source,/openSiteDialog\(dialog\)/);
  assert.match(html,/id="copyright-year">2026<\/span> melodia\.lol\. All rights reserved\./);
  assert.match(source,/melodia\.lol\. All rights reserved\./);
  assert.match(source,/title:'About'/);
  assert.match(html,/<dialog id="info-dialog" aria-label="About">/);
  assert.doesNotMatch(html,/id="info-title"/);
  assert.match(source,/dialog\.setAttribute\('aria-label',section.title\)/);
  assert.match(source,/melodia-reduce-effects/);
  assert.match(source,/globe\?\.setReducedEffects\(effective\)/);
  const dialog=html.match(/<dialog id="info-dialog"[\s\S]*?<\/dialog>/)?.[0];
  assert.ok(dialog);
  assert.ok(dialog.indexOf('<nav class="info-tabs"')<dialog.indexOf('<div id="info-content"'));
  assert.doesNotMatch(dialog,/<h2/);
  assert.doesNotMatch(dialog,/data-reduce-effects/);
  assert.match(html,/<footer>[\s\S]*?data-reduce-effects[\s\S]*?<\/footer>/);
});

test('Share and Info switch both ways without blocking mobile player controls',()=>{
  const calls=[];
  const makeDialog=name=>({open:false,close(){this.open=false;calls.push(`${name}:close`);},show(){this.open=true;calls.push(`${name}:show`);},showModal(){this.open=true;calls.push(`${name}:modal`);}});
  const info=makeDialog('info'),share=makeDialog('share');
  const originalDocument=Object.getOwnPropertyDescriptor(globalThis,'document');
  const originalMatchMedia=Object.getOwnPropertyDescriptor(globalThis,'matchMedia');
  let mobile=true;
  Object.defineProperty(globalThis,'document',{configurable:true,value:{querySelectorAll:()=>[info,share]}});
  Object.defineProperty(globalThis,'matchMedia',{configurable:true,value:()=>({matches:mobile})});
  try{
    openSiteDialog(share);openSiteDialog(info);openSiteDialog(share);
    assert.deepEqual(calls,['share:show','share:close','info:show','info:close','share:show']);
    assert.equal(info.open,false);assert.equal(share.open,true);
    openSiteDialog(share);assert.equal(calls.length,5);
    mobile=false;openSiteDialog(info);
    assert.deepEqual(calls.slice(-2),['share:close','info:modal']);
  }finally{
    if(originalDocument)Object.defineProperty(globalThis,'document',originalDocument);else delete globalThis.document;
    if(originalMatchMedia)Object.defineProperty(globalThis,'matchMedia',originalMatchMedia);else delete globalThis.matchMedia;
  }
});

test('removed feedback and artwork credits do not remain in site information',async()=>{
  const [html,source,css]=await Promise.all(['index.html','site-info.js','styles.css'].map(name=>readFile(new URL(`../public/${name}`,import.meta.url),'utf8')));
  assert.doesNotMatch(html,/data-info="feedback"|>Feedback</);
  assert.doesNotMatch(source,/feedback|mailto:|byalov\.v\.martin@gmail\.com/i);
  assert.doesNotMatch(source,/Simple Icons|support button artwork|Brand marks/);
  assert.doesNotMatch(css,/#feedback-text|#email-feedback|#copy-feedback/);
  for(const credit of ['Radio Browser','OpenStreetMap contributors','Natural Earth','Three.js','HLS.js'])assert.ok(source.includes(credit));
});

test('Sources & Credits centers unbulleted entries with names above descriptions',async()=>{
  const [source,css]=await Promise.all(['site-info.js','styles.css'].map(name=>readFile(new URL(`../public/${name}`,import.meta.url),'utf8')));
  const credits=source.match(/credits:\{title:'Sources & Credits',html:'([^']*)'\}/)?.[1];
  assert.ok(credits);
  assert.doesNotMatch(credits,/<ul>|<li>/);
  assert.equal((credits.match(/class="credit-entry"/g)||[]).length,5);
  assert.match(credits,/class="credit-name"[^>]*>Radio Browser<\/a><p>Community-maintained station directory/);
  assert.match(credits,/class="credit-name"[^>]*>© OpenStreetMap contributors<\/a><p>Local administrative boundaries/);
  for(const url of ['https://www.radio-browser.info/','https://www.openstreetmap.org/copyright','https://www.naturalearthdata.com/about/terms-of-use/','vendor/LICENSE','vendor/hls-LICENSE.txt'])assert.ok(credits.includes(url));
  assert.match(css,/#info-dialog #info-content\[data-section=credits\]\{text-align:center;justify-content:flex-start;padding-top:16px\}/);
  assert.match(css,/#info-dialog \.credit-name\{display:block;font-weight:700\}/);
});

test('information dialog has a star field and scroll-safe vertically centered content',async()=>{
  const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.match(css,/#info-dialog,body\[data-mode=day\] #info-dialog\{background-color:#080e1b;background-image:radial-gradient/);
  assert.match(css,/#info-dialog\[open\]\{display:flex;flex-direction:column;height:min\(540px,90dvh\)\}/);
  assert.match(css,/#info-dialog #info-content\{flex:1;min-height:0;overflow-y:auto;display:flex;flex-direction:column;justify-content:safe center/);
  assert.match(css,/#info-dialog\[open\],#share-dialog\[open\]\{[^}]*height:calc\(100dvh - var\(--embed-player-height,120px\)\)/);
  assert.match(css,/#info-dialog,body\[data-mode=day\] #info-dialog\{[^}]*padding:48px 32px 32px/);
  assert.match(css,/@media\(max-width:760px\)\{#info-dialog,body\[data-mode=day\] #info-dialog\{padding:calc\(88px \+ env\(safe-area-inset-top,0px\)\)/);
});

test('information prose uses full sentences rather than semicolons',async()=>{
  const source=await readFile(new URL('../public/site-info.js',import.meta.url),'utf8');
  const sections=[...source.matchAll(/(?:about|credits|privacy):\{title:'[^']+',html:'([^']*)'\}/g)];
  assert.equal(sections.length,3);
  for(const [,html] of sections)assert.doesNotMatch(html.replace(/<[^>]+>/g,''),/;/);
  for(const [,message] of source.matchAll(/status\.textContent='([^']*)'/g))assert.doesNotMatch(message,/;/);
});

test('About places support after its prose and copyright in a separate bottom row',async()=>{
  const [source,css]=await Promise.all(['site-info.js','styles.css'].map(name=>readFile(new URL(`../public/${name}`,import.meta.url),'utf8')));
  assert.match(source,/their respective owners\.<\/p><span class="about-support-divider" aria-hidden="true"><\/span><button id="about-coffee" class="coffee-link" type="button"><span class="coffee-cup" aria-hidden="true">♥<\/span>Buy me a coffee!<\/button>/);
  assert.match(css,/#info-dialog #about-coffee\{align-self:center;flex-shrink:0;margin:0\}/);
  assert.match(source,/content\.dataset\.section=opener\.dataset\.info/);
  assert.match(source,/support\.append\(content\.querySelector\('#about-coffee'\)\);content\.append\(support\)/);
  assert.match(css,/#info-dialog #info-content\[data-section=about\]\{text-align:center/);
  assert.match(css,/#info-dialog \.about-support\{flex:1 0 88px;display:flex;align-items:center;justify-content:center\}/);
  assert.match(css,/#info-dialog \.info-copyright\{flex-shrink:0;margin:0;/);
  assert.match(source,/<p>One planet\.<br>Infinite vibes\.<br>Discover live radio/);
  assert.match(source,/<p class="about-project">Melodia is an independent creative project\.<br>Its original concept[^<]*<br>Radio broadcasts/);
  assert.match(css,/#info-dialog \.about-support-divider\{align-self:center;width:36px;height:1px;flex-shrink:0;margin:20px 0;background:#fff\}/);
  assert.match(css,/#info-dialog \.about-project\{margin-bottom:0;flex-shrink:0\}/);
  assert.match(css,/\.coffee-link,#info-dialog #about-coffee,#share-dialog #share-coffee\{[^}]*background:#299bd0;color:#fff/);
  assert.match(css,/\.coffee-cup\{[^}]*background:#fff;color:#e13947/);
  assert.match(css,/\.coffee-cup:after\{[^}]*border:2px solid #fff/);
  assert.match(source,/copyright\.className='info-copyright'/);
  assert.match(source,/dialog\.append\(copyright\)/);
  assert.doesNotMatch(source,/content\.append\(copyright\)/);
  assert.match(source,/copyright\.hidden=opener\.dataset\.info!=='about'/);
  assert.match(source,/closest\('#about-coffee'\)\)document\.querySelector\('#help'\)\.click\(\)/);
  assert.match(css,/#info-dialog \.info-copyright\{flex-shrink:0;[^}]*text-align:center/);
  assert.match(css,/#info-dialog \.dialog-close\{[^}]*border:1px solid var\(--panel-edge,#475569\);border-radius:8px/);
  assert.match(css,/#info-dialog \.dialog-close,#share-dialog \.dialog-close\{top:calc\(env\(safe-area-inset-top,0px\) \+ 1px \+ \(58px - var\(--mobile-square-size,40px\)\)\/2\);right:13px;[^}]*width:var\(--mobile-square-size,40px\)/);
});

test('wordmark, dialog and favorites stay centered and readable in both modes',async()=>{
  const [css,app]=await Promise.all(['styles.css','app.js'].map(name=>readFile(new URL(`../public/${name}`,import.meta.url),'utf8')));
  assert.match(css,/\.brand-icon\{line-height:1;display:inline-flex;align-items:center/);
  assert.match(css,/\.brand-word\{line-height:1;display:inline-flex;align-items:center\}/);
  assert.match(css,/#info-dialog \.info-tabs button\{padding:12px 16px;font-size:15px;min-height:44px\}/);
  assert.match(css,/#info-dialog \.info-tabs\{margin:16px 0;justify-content:center\}/);
  assert.match(css,/#info-dialog,body\[data-mode=day\] #info-dialog\{[^}]*color:#fff/);
  assert.doesNotMatch(css,/body\[data-favorites-only=true\]/);
  assert.match(app,/document\.body\.dataset\.favoritesOnly=String\(favorites\)/);
});

test('selected information button keeps its accent color until another section is selected',async()=>{
  const [source,css]=await Promise.all(['site-info.js','styles.css'].map(name=>readFile(new URL(`../public/${name}`,import.meta.url),'utf8')));
  assert.match(source,/dialog\.querySelectorAll\('\.info-tabs button\[data-info\]'\)\.forEach\(button=>\{/);
  assert.match(source,/button\.setAttribute\('aria-pressed',String\(button\.dataset\.info===opener\.dataset\.info\)\)/);
  assert.match(css,/#info-dialog \.info-tabs button\[aria-pressed=true\]\{color:var\(--accent\);border-color:var\(--accent\);background:rgba\(var\(--accent-rgb\),\.15\)\}/);
});

test('mobile information opens from the player after Share instead of floating over the header',async()=>{
  const [html,css,app]=await Promise.all(['index.html','styles.css','app.js'].map(name=>readFile(new URL(`../public/${name}`,import.meta.url),'utf8')));
  assert.match(html,/<button id="mobile-info"[^>]*data-info="about"/);
  assert.match(app,/bottom\.append\(left,\$\('#favorite'\),\$\('#mode-toggle'\),\$\('#share'\),\$\('#mobile-info'\)\)/);
  assert.match(css,/body\[data-mobile-player=true\] \.mobile-player-bottom #mobile-info\{display:inline-flex/);
  assert.doesNotMatch(css,/#mobile-info\{display:flex;position:fixed/);
  assert.doesNotMatch(css,/body\[data-catalog-open=true\] #mobile-info\{display:none\}/);
  assert.match(css,/body\[data-embed=true\] #mobile-info\{display:none!important\}/);
});