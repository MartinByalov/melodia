import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';

test('favorite removal mode is limited to Favorites with explicit pressed state',async()=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  const body=app.match(/function setFavoriteRemovalMode\(enabled\)\{([\s\S]*?)\n\}/)[1];
  for(const favoritesOnly of [false,true])for(const enabled of [false,true]){
    const attributes={},button={setAttribute:(k,v)=>{attributes[k]=v;}};
    const context={favoritesOnly,enabled,$:()=>button};
    vm.runInNewContext(body,context);
    assert.equal(context.favoriteRemovalMode,favoritesOnly&&enabled);
    assert.equal(button.hidden,!favoritesOnly);
    assert.equal(attributes['aria-pressed'],String(favoritesOnly&&enabled));
  }
});

test('removal uses a sibling button, persists favorites and leaves playback untouched',async()=>{
  const app=await readFile(new URL('../public/app.js',import.meta.url),'utf8');
  assert.match(app,/if\(favoritesOnly&&favoriteRemovalMode\)/);
  assert.match(app,/item\.append\(row,remove\)/);
  const removal=app.match(/remove\.addEventListener\('click',\(\)=>\{([\s\S]*?)\n      \}\);/)[1];
  assert.match(removal,/favoriteIds\.delete\(s\.id\);saveFavorites\(\);updateFavorites\(\);renderList\(limit\)/);
  assert.doesNotMatch(removal,/choose\(|resetAudio|pause\(/);
});