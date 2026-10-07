import test from 'node:test';
import assert from 'node:assert/strict';
import { boundaryLines } from '../public/city-boundaries.js';

test('OSM boundaries preserve separate ways and deduplicate shared members', () => {
  const member={type:'way',ref:1,role:'outer',geometry:[{lat:42,lon:23},{lat:43,lon:24}]};
  assert.deepEqual(boundaryLines({elements:[{type:'relation',members:[member,member,{...member,ref:2,role:'admin_centre'}]}]}),[[[23,42],[24,43]]]);
});
test('clipped OSM geometry never connects across missing coordinates', () => {
  const geometry=[{lat:1,lon:2},{lat:2,lon:3},null,{lat:3,lon:4},{lat:4,lon:5}];
  assert.deepEqual(boundaryLines({elements:[{type:'way',id:2,geometry}]}),[[[2,1],[3,2]],[[4,3],[5,4]]]);
  assert.deepEqual(boundaryLines({}),[]);
});