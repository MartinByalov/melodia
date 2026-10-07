import { readFile } from 'node:fs/promises';
import * as THREE from '../public/vendor/three.module.js';
const source=await readFile(new URL('../public/station-layout.js',import.meta.url),'utf8');
const module=await import('data:text/javascript;base64,'+Buffer.from(source.replace("from 'three'",`from '${new URL('../public/vendor/three.module.js',import.meta.url).href}'`)).toString('base64'));
const markers=Array.from({length:10000},(_,i)=>{
  const normal=new THREE.Vector3().setFromSphericalCoords(1,Math.acos(1-2*(i+.5)/10000),i*2.39996323);
  return {normal:normal.clone(),geoNormal:normal,root:new THREE.Group(),inverseRotation:new THREE.Quaternion()};
});
const start=performance.now();module.spreadStationMarkers(markers);
console.log({stations:markers.length,oneTimeMs:performance.now()-start,perFrameLayoutCalls:0});