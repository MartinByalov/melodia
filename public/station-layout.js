import * as THREE from 'three';

export function pointGrowth(altitude){return 1+Math.min(3.5,Math.max(0,Math.log2(3.2/Math.max(.00001,altitude)))*.34);}

// One-time geographic separation; no camera-dependent work or per-frame uploads.
export function spreadStationMarkers(markers,spacing=.0005){
  const grid=new Map(),resume=new Map(),up=new THREE.Vector3(0,1,0),east=new THREE.Vector3(),north=new THREE.Vector3(),candidate=new THREE.Vector3();
  const minimumSq=spacing*spacing;
  // Cells are twice the spacing, so a point checks 8 cells instead of 27, and small integer keys are used (collisions only add comparisons).
  const cell=spacing*2;
  const cellKey=(x,y,z)=>(Math.imul(x,73856093)^Math.imul(y,19349663)^Math.imul(z,83492791))&0x3fffffff;
  function occupied(point){
    const fx=point.x/cell,fy=point.y/cell,fz=point.z/cell;
    const x=Math.floor(fx),y=Math.floor(fy),z=Math.floor(fz);
    const sx=fx-x<.5?-1:1,sy=fy-y<.5?-1:1,sz=fz-z<.5?-1:1;
    for(let i=0;i<2;i++){
      const a=i?x+sx:x;
      for(let j=0;j<2;j++){
        const b=j?y+sy:y;
        for(let k=0;k<2;k++){
          const bucket=grid.get(cellKey(a,b,k?z+sz:z));
          if(bucket)for(const normal of bucket)if(normal.distanceToSquared(point)<minimumSq)return true;
        }
      }
    }
    return false;
  }
  for(const marker of markers){
    const origin=marker.geoNormal;candidate.copy(origin);
    if(occupied(candidate)){
      east.crossVectors(up,origin);
      if(east.lengthSq()<1e-10)east.set(1,0,0);else east.normalize();
      north.crossVectors(origin,east).normalize();
      // Markers that share a spot resume the spiral where the previous one stopped, which keeps crowded cities from going quadratic.
      const spot=cellKey(Math.floor(origin.x/cell),Math.floor(origin.y/cell),Math.floor(origin.z/cell));
      const first=resume.get(spot)||1;
      let attempt=first;
      for(;attempt<first+512;attempt++){
        const radius=spacing*1.4*Math.sqrt(attempt),angle=attempt*2.39996323;
        candidate.copy(origin).addScaledVector(east,Math.cos(angle)*radius).addScaledVector(north,Math.sin(angle)*radius).normalize();
        if(!occupied(candidate))break;
      }
      resume.set(spot,attempt);
    }
    marker.normal.copy(candidate);marker.root.position.copy(candidate).multiplyScalar(1.00004);
    marker.root.quaternion.setFromUnitVectors(up,candidate);marker.inverseRotation.copy(marker.root.quaternion).invert();marker.root.updateMatrix();
    const key=cellKey(Math.floor(candidate.x/cell),Math.floor(candidate.y/cell),Math.floor(candidate.z/cell));
    if(!grid.has(key))grid.set(key,[]);grid.get(key).push(marker.normal);
  }
}