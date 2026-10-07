import test from 'node:test';
import assert from 'node:assert/strict';
import { rhythmProfile, syntheticLevel } from '../public/rhythm.js';
test('genre fallback is deterministic, varied per station, bounded and rhythmic', () => {
  const a=rhythmProfile('techno','station-a'), b=rhythmProfile('lo-fi','station-b');
  assert.deepEqual(a,rhythmProfile('techno','station-a'));
  assert.ok(a.bpm>b.bpm);
  assert.notDeepEqual(a,rhythmProfile('techno','station-c'));
  const values=Array.from({length:200},(_,i)=>syntheticLevel(a,i*.05));
  assert.ok(values.every(n=>Number.isFinite(n)&&n>=0&&n<=1));
  assert.ok(Math.max(...values)-Math.min(...values)>.3);
});