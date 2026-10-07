import test from 'node:test';
import assert from 'node:assert/strict';
import { wavePath } from '../public/player-wave.js';

test('player waves expand with bass and deform with actual samples',()=>{
  const quiet=wavePath(null,0,0,0);
  const loud=wavePath(new Float32Array([0,.8,-.5,.2]),.8,.9,1);
  assert.ok(quiet.startsWith('M24.00'));
  assert.ok(loud.startsWith('M2.40'));
  assert.notEqual(loud,wavePath(null,.8,.9,1));
  assert.equal(loud.match(/[MC]/g).length,121);
  assert.ok(!loud.includes('L'));
  assert.ok(!loud.includes('NaN'));
});

test('opposing waves mirror around the player center',()=>{
  const values=path=>[...path.matchAll(/(-?[\d.]+) (-?[\d.]+)/g)].map(m=>[Number(m[1]),Number(m[2])]);
  const a=values(wavePath(null,.7,.6,1));
  const b=values(wavePath(null,.7,.6,1,true));
  a.forEach((point,i)=>{assert.equal(point[0],b[i][0]);assert.ok(Math.abs(point[1]+b[i][1]-36)<.02);});
});