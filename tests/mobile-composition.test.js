import test from 'node:test';
import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';

test('phone and tablet menus end at the actual player top and titles align with close',async()=>{
  const [css,app,info]=await Promise.all(['styles.css','app.js','site-info.js'].map(name=>readFile(new URL(`../public/${name}`,import.meta.url),'utf8')));
  assert.match(css,/@media\(max-width:1024px\), \(max-width:1366px\) and \(pointer:coarse\)/);
  assert.match(css,/bottom:var\(--menu-player-offset,120px\);max-height:none/);
  assert.match(css,/height:calc\(100dvh - var\(--menu-player-offset,120px\)\)/);
  assert.match(app,/innerHeight-rect.top/);
  assert.match(app,/window.addEventListener\('resize',measurePlayer\)/);
  assert.match(info,/matchMedia\('\(max-width:1024px\), \(max-width:1366px\) and \(pointer:coarse\)'\)/);
  assert.match(css,/\.discover-panel \.panel-top\{display:flex;align-items:center;justify-content:space-between\}/);
});

test('mobile directory title and close button align with the original header row',async()=>{
  const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.match(css,/body\[data-mobile-player=true\] \.discover-panel \.panel-top\{height:58px;min-height:58px;flex:0 0 58px;display:flex;align-items:center;justify-content:space-between;margin:0;padding:0\}/);
  assert.match(css,/body\[data-mobile-player=true\] \.discover-panel \.panel-top h2\{margin:0;line-height:1\.2\}/);
  assert.match(css,/border-radius:0;padding:env\(safe-area-inset-top,0px\) 12px 12px/);
  assert.match(css,/body\[data-mobile-player=true\] \.discover-panel #catalog-close\{position:static;margin:0\}/);
  assert.match(css,/#info-dialog \.dialog-close,#share-dialog \.dialog-close\{top:calc\(env\(safe-area-inset-top,0px\) \+ 1px \+ \(58px - var\(--mobile-square-size,40px\)\)\/2\);right:13px;width:var\(--mobile-square-size,40px\);height:var\(--mobile-square-size,40px\)/);
});

test('mobile menu and bottom player square buttons share the search button size',async()=>{
  const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.match(css,/body\[data-mobile-player=true\]\{--mobile-square-size:40px\}/);
  for(const selector of ['.mobile-header-actions #catalog-toggle','.discover-panel #catalog-close','.discover-panel #clear-filters','.discover-panel #random','.discover-panel #favorite-edit','.mobile-search-row #favorites','.player .mobile-player-bottom #favorite','.player .mobile-player-bottom #mode-toggle','.player .mobile-player-bottom #share','.player .mobile-player-bottom #mobile-info']){
    assert.ok(css.includes(`body[data-mobile-player=true] ${selector}`));
  }
  assert.match(css,/height:var\(--mobile-square-size\);min-width:var\(--mobile-square-size\)/);
});

test('mobile About and Share match Stations above the measured player and remain scrollable',async()=>{
  const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.match(css,/@media\(max-width:760px\)\{\s*#info-dialog\[open\],#share-dialog\[open\]\{position:fixed;inset:0 0 var\(--embed-player-height,120px\);margin:0;width:100%;max-width:none;height:calc\(100dvh - var\(--embed-player-height,120px\)\)/);
  assert.match(css,/#info-dialog\[open\],#share-dialog\[open\]\{[^}]*border:0;border-radius:0;box-shadow:none;overflow-y:auto/);
  assert.match(css,/#info-dialog::backdrop,#share-dialog::backdrop\{inset:0 0 var\(--embed-player-height,120px\);[^}]*backdrop-filter:none/);
  assert.doesNotMatch(css,/#share-dialog\{[^}]*height:100dvh/);
});

test('open mobile directory hides header and fills the area above the player',async()=>{
  const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.match(css,/body\[data-mobile-player=true\]\[data-catalog-open=true\] header\{visibility:hidden;pointer-events:none\}/);
  assert.match(css,/body\[data-mobile-player=true\]\[data-catalog-open=true\] \.discover-panel\{top:0;left:0;right:0;width:100%;max-width:none;bottom:var\(--embed-player-height,120px\);border-radius:0/);
});

test('mobile composition reuses controls in two rows and restores desktop on resize',async()=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/mobile\.addEventListener\('change',layout\)/);
  assert.match(app,/row\.append\(genres,actions\)/);
  assert.match(app,/row\.prepend\(\$\('\.brand'\)\)/);
  assert.match(app,/actions\.append\(\$\('#catalog-toggle'\)\)/);
  assert.match(app,/bottom\.append\(left,\$\('#favorite'\),\$\('#mode-toggle'\),\$\('#share'\),\$\('#mobile-info'\)\)/);
  assert.match(app,/\$\('footer'\)\.after\(\$\('#mobile-info'\)\)/);
  assert.match(app,/searchRow\.prepend\(\$\('#favorites'\)\)/);
  assert.match(app,/headerRight\.prepend\(\$\('#catalog-toggle'\),\$\('#favorites'\),\$\('#mode-toggle'\)\)/);
  assert.match(app,/top\.remove\(\);bottom\.remove\(\)/);
});

test('mobile intro stays visible at overview and mobile zoom out has a larger range',async()=>{
  const globe=await readFile(new URL('../public/globe.js',import.meta.url),'utf8');
  assert.match(globe,/innerWidth<=760\?9\.5:controls.maxDistance/);
  assert.match(globe,/const visible=mobileIntro\s*\? mobileSpace\/2-radius>16/);
  assert.match(globe,/\(textBottom\+playerTop\)\/2-\(box.top\+box.height\/2\)/);
  assert.match(globe,/const introTop=mobileIntro\?Math\.max\(18,\(playerTop-box\.top-2\*radius-rect\.height\)\/3\):18/);
  assert.match(globe,/const textBottom=box\.top\+introTop\+rect\.height/);
  assert.match(globe,/intro\.style\.top=`\$\{introTop\}px`/);
});

test('mobile genres fit whole labels and panels end at the measured player top',async()=>{
  const [app,css]=await Promise.all([readFile(new URL('../public/app.js',import.meta.url),'utf8'),readFile(new URL('../public/styles.css',import.meta.url),'utf8')]);
  assert.match(app,/if\(full\|\|next>available\)\{button.hidden=true;full=true;/);
  assert.match(app,/genreResizeObserver.observe\(genres\)/);
  assert.match(app,/genreMutationObserver.observe\(genres,\{childList:true\}\)/);
  assert.match(css,/\.intro\{inset:18px 12px auto;/);
  assert.match(css,/body\[data-mobile-player=true\] \.discover-panel\{bottom:calc\(var\(--embed-player-height,120px\) \+ var\(--directory-gap\)\)/);
});

test('mobile share actions share dimensions, close has hover, and both player modes have a divider',async()=>{
  const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.match(css,/body\[data-mobile-player=true\] \.mobile-player-bottom\{border-top:1px solid/);
  assert.match(css,/#share-dialog #copy-link,#share-dialog #embed-toggle,#share-dialog #share-coffee\{width:100%;height:44px;min-height:44px/);
  assert.match(css,/#share-dialog \.dialog-close:hover,#share-dialog \.dialog-close:focus-visible\{color:var\(--accent\);background:rgba/);
});

test('mobile player is edge-to-edge and hides moving text, waves and footer attribution',async()=>{
  const css=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.match(css,/left:0;right:0;bottom:0;width:100%;max-width:none;transform:none;border-radius:0/);
  assert.match(css,/body\[data-mobile-player=true\] \.player #globe-status,body\[data-mobile-player=true\] \.player \.visualizer\{display:none!important\}/);
  assert.match(css,/body\[data-mobile-player=true\] footer>span\{display:none\}/);
});

test('mobile genres lose underline and Share hides its coffee button',async()=>{
  const [css,html]=await Promise.all([readFile(new URL('../public/styles.css',import.meta.url),'utf8'),readFile(new URL('../public/index.html',import.meta.url),'utf8')]);
  assert.match(css,/\.header-genres button:after\{display:none!important\}/);
  assert.match(html,/id="share-coffee"/);
  assert.match(html,/src="assets\/buy-me-a-coffee.png"/);
  assert.ok(html.indexOf('id="share-coffee"')>html.indexOf('id="embed-options"'));
  assert.match(css,/#share-coffee\{display:none;/);
  assert.match(css,/#share-dialog #share-coffee\{display:none\}/);
  assert.doesNotMatch(css,/#(?:share-dialog #)?share-coffee\{display:(?:block|flex)/);
});