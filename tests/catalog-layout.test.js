import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import vm from 'node:vm';
import { STYLE_LABELS } from '../public/favorite-styles.js';

test('style filter keeps All styles first and sorts every other option alphabetically by label',async()=>{
  const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const statement=source.split('\n').find(line=>line.startsWith("$('#genre-filter').replaceChildren"));
  let options;
  vm.runInNewContext(statement,{
    STYLE_LABELS,
    $:()=>({replaceChildren(...children){options=children;}}),
    document:{createElement:()=>({})}
  });
  assert.equal(options[0].value,'all');
  assert.equal(options[0].textContent,'All styles');
  const labels=options.slice(1).map(option=>option.textContent);
  assert.deepEqual(labels,[...labels].sort((a,b)=>a.localeCompare(b,'en')));
  assert.equal(options.length,Object.keys(STYLE_LABELS).length);
  assert.equal(new Set(options.map(option=>option.value)).size,options.length);
});

test('Favorites and Stations share theme surfaces and readable controls at every viewport size',async()=>{
  const styles=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.match(styles,/\.discover-panel,[^{]*body\[data-mode=day\] \.discover-panel,[^{]*\{background:var\(--panel-surface\);border-color:var\(--panel-edge\)\}/);
  assert.match(styles,/:root\{--panel-surface:#151924;/);
  assert.match(styles,/body\[data-mode=day\]\{--panel-surface:#e6ebf1;/);
  assert.match(styles,/footer\{[^}]*background:var\(--panel-surface\)/);
  assert.doesNotMatch(styles,/\[data-favorites-only=true\][^{]*\.discover-panel/);
});

test('favorite without selection is silent and day directory actions have hover and focus colors',async()=>{
  const [app,css]=await Promise.all([
    readFile(new URL('../public/app.js',import.meta.url),'utf8'),
    readFile(new URL('../public/styles.css',import.meta.url),'utf8')
  ]);
  assert.doesNotMatch(app,/Choose a station first/);
  const handler=app.match(/\$\('#favorite'\)\.addEventListener\('click', \(\) => \{([\s\S]*?)\n\}\);/)[1];
  vm.runInNewContext(`(()=>{${handler}})()`,{selected:null});
  for(const id of ['clear-filters','random'])for(const state of ['hover','focus-visible']){
    assert.ok(css.includes(`body[data-mode=day] .discover-panel #${id}:${state}`));
  }
  assert.match(css,/#random:focus-visible\{color:var\(--accent\);background:#cbd5e1;border-color:var\(--accent\)\}/);
});

test('day genre hover, focus and selected colors follow the station theme',async()=>{
  const styles=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.match(styles,/body\[data-mode=day\] \.header-genres button:hover,body\[data-mode=day\] \.header-genres button:focus-visible\{color:var\(--accent\)\}/);
  assert.match(styles,/body\[data-mode=day\] \.header-genres button.selected\{color:var\(--accent\)\}/);
});

test('header icons and favorite count use neutral mode colors and invert on selected backgrounds',async()=>{
  const styles=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.match(styles,/body\[data-mode=day\] \.header-right\{--header-control-color:#151924\}/);
  assert.match(styles,/body\[data-mode=night\] \.header-right\{--header-control-color:#e6ebf1\}/);
  assert.match(styles,/#favorites\[aria-expanded=true\]\{--control-ink:#e6ebf1\}/);
  assert.match(styles,/#favorites\[aria-expanded=true\]\{--control-ink:#151924\}/);
  assert.match(styles,/body\[data-mode\] \.header-right #favorites #fav-count\{color:inherit\}/);
});

test('favorites toggles closed and switches from Stations without closing the panel',async()=>{
  const source=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const handler=source.match(/\$\('#favorites'\)\.addEventListener\('click', \(\) => \{([\s\S]*?)\n\}\);/)[1];
  for(const hidden of [true,false])for(const favoritesOnly of [true,false]){
    const panel={hidden};let nextFavorites=favoritesOnly;
    const context={favoritesOnly,$:()=>panel,showDirectory:value=>{nextFavorites=value;},openCatalog:open=>{panel.hidden=!open;}};
    vm.runInNewContext(handler,context);
    assert.equal(panel.hidden,!hidden&&favoritesOnly);
    assert.equal(nextFavorites,true);
  }
});

test('night header backgrounds distinguish selected and closed menus',async()=>{
  const styles=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  for(const id of ['catalog-toggle','favorites']){
    assert.match(styles,new RegExp(`body\\[data-mode=night\\] \\.header-right #${id}\\[aria-expanded=true\\]\\{background:#e3e8f0`));
    assert.match(styles,new RegExp(`body\\[data-mode=night\\] \\.header-right #${id},[^\\n]*\\{background:#151924`));
  }
});

test('day selected menus and moon button use the dark background',async()=>{
  const styles=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  for(const id of ['catalog-toggle','favorites']){
    assert.match(styles,new RegExp(`body\\[data-mode=day\\] \\.header-right #${id}\\[aria-expanded=true\\]\\{background:#151924`));
  }
  assert.match(styles,/body\[data-mode=day\] \.header-right #mode-toggle\{background:#151924;color:#e6ebf1/);
  assert.match(styles,/body\[data-mode=day\] \.header-right #mode-toggle:focus-visible\{background:#151924;color:#fff/);
});

test('clear precedes surprise in filters and favorite edit occupies the All stations row',async()=>{
  const source=await readFile(new URL('../public/index.html',import.meta.url),'utf8');
  const filters=source.match(/<div class="station-filters">([\s\S]*?)<\/div>/)[1];
  assert.match(filters,/id="clear-filters"/);
  assert.match(filters,/id="random"/);
  assert.ok(filters.indexOf('id="random"')>filters.indexOf('id="genre-filter"'));
  assert.ok(filters.indexOf('id="clear-filters"')>filters.indexOf('id="genre-filter"'));
  assert.ok(filters.indexOf('id="clear-filters"')<filters.indexOf('id="random"'));
  assert.match(source,/<div class="catalog-actions"><button id="explore">All stations<\/button><button[^>]*id="favorite-edit"[^>]*hidden/);
  assert.equal((source.match(/id="clear-filters"/g)||[]).length,1);
});

test('country dropdown is bounded to the panel and supports keyboard selection',async()=>{
  const source=await readFile(new URL('../public/country-menu.js',import.meta.url),'utf8');
  const styles=await readFile(new URL('../public/styles.css',import.meta.url),'utf8');
  assert.match(source,/panelRect\.bottom-rect\.bottom-12/);
  assert.match(source,/Math\.min\(260/);
  assert.match(source,/setAttribute\('role','listbox'\)/);
  assert.match(source,/select\.dispatchEvent\(new Event\('change'/);
  for(const key of ['ArrowDown','ArrowUp','Home','End','Escape'])assert.ok(source.includes(`'${key}'`));
  assert.match(styles,/\.country-options\{[^}]*width:100%;[^}]*overflow-y:auto;overflow-x:hidden/);
});