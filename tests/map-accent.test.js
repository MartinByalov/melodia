import test from 'node:test';
import assert from 'node:assert/strict';
import {createMapAccent} from '../public/map-accent.js';

test('measured audio peaks trigger a bounded accent then return to the theme',()=>{
  const accent=createMapAccent();
  assert.equal(accent.update(0,.5,true),null);
  assert.equal(accent.update(1,.8,true),0);
  assert.ok(Math.abs(accent.update(9,.8,true)-.5)<1e-9);
  assert.equal(accent.update(18,.8,true),null);
  assert.equal(accent.update(65,.8,true),null); // Sustained volume cannot retrigger.
  accent.update(66,.2,true);
  assert.equal(accent.update(67,.8,true),0);
});
test('cooldown, pause, unavailable audio and reduced motion prevent repeated flashes',()=>{
  const accent=createMapAccent();
  assert.equal(accent.update(0,.9,false),null);
  assert.equal(accent.update(1,.9,true),0);
  accent.update(2,.2,true);
  assert.equal(accent.update(20,.9,true),null);
  assert.equal(accent.update(59,.9,true),null);
  assert.equal(accent.update(62,.9,true),0);
  assert.equal(accent.update(63,.9,false),null);
  accent.reset();assert.equal(accent.update(64,.9,true),0);
});