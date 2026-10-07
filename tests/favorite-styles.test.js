import test from 'node:test';
import assert from 'node:assert/strict';
import { favoriteStyles, DEFAULT_STYLES } from '../public/favorite-styles.js';

test('header defaults return when favorites are empty or unavailable',()=>{
  assert.deepEqual(favoriteStyles([],new Set()),DEFAULT_STYLES);
  assert.deepEqual(favoriteStyles([{id:'a',tags:'jazz'}],new Set(['missing'])),DEFAULT_STYLES);
});

test('favorite styles rank by station frequency, keep specific styles and ignore nonfavorites',()=>{
  const stations=[{id:'a',tags:'jazz'},{id:'b',tags:'jazz'},{id:'c',tags:'synthwave electronic'},{id:'d',tags:'classical'},{id:'e',tags:'techno'}];
  assert.deepEqual(favoriteStyles(stations,new Set(['a','b','c','d'])),['jazz','classical','electronic','synthwave','lofi']);
  assert.deepEqual(favoriteStyles(stations,new Set(['e'])),['techno','synthwave','lofi','jazz','rock']);
  assert.deepEqual(favoriteStyles(stations,new Set()),DEFAULT_STYLES);
});

test('header limits preferred styles to five and does not double-count duplicate stations',()=>{
  const stations=['jazz','rock','classical','chill','pop','electronic','techno'].map((tags,i)=>({id:String(i),tags}));
  const ids=new Set(stations.map(s=>s.id));
  const result=favoriteStyles(stations,ids);
  assert.equal(result.length,5);
  assert.equal(new Set(result).size,5);
  assert.deepEqual(favoriteStyles([...stations,stations[0]],ids),result);
});

test('one preferred style fills the first slot and retains four defaults',()=>{
  assert.deepEqual(favoriteStyles([{id:'a',tags:'classical'}],new Set(['a'])),['classical','synthwave','lofi','techno','jazz']);
});

test('favorite stations contribute secondary Pop and chart aliases to header styles',()=>{
  for(const tags of ['rock,classic rock,pop','hits','top40','top 40','charts']){
    const result=favoriteStyles([{id:'a',tags}],new Set(['a']));
    assert.ok(result.includes('pop'),tags);assert.equal(result.length,5);
  }
});