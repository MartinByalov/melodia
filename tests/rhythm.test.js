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
test('song speed shifts the tempo and the planet pulse swells smoothly',async()=>{
  const { pulseLevel } = await import('../public/rhythm.js');
  assert.ok(rhythmProfile('pop','s','veryhigh').bpm>rhythmProfile('pop','s','verylow').bpm);
  assert.deepEqual(rhythmProfile('pop','s',''),rhythmProfile('pop','s'));
  const profile=rhythmProfile('techno','s');
  let previous=pulseLevel(profile,0),biggest=0;
  for(let i=1;i<=400;i++){const value=pulseLevel(profile,i*.01);assert.ok(value>=0&&value<=1);biggest=Math.max(biggest,Math.abs(value-previous));previous=value;}
  assert.ok(biggest<.12);
});
