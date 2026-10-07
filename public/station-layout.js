import * as THREE from 'three';

export function pointGrowth(altitude){return 1+Math.min(3.5,Math.max(0,Math.log2(3.2/Math.max(.00001,altitude)))*.34);}

// One-time geographic separation; no camera-dependent work or per-frame uploads.
export function spreadStationMarkers(markers,spacing=.0005){
  const grid=new Map(),up=new THREE.Vector3(0,1,0),east=new THREE.Vector3(),north=new THREE.Vector3(),candidate=new THREE.Vector3();
  const minimumSq=spacing*spacing;
  const cellKey=(x,y,z)=>`${x}:${y}:${z}`;
  function occupied(point){
    const x=Math.floor(point.x/spacing),y=Math.floor(point.y/spacing),z=Math.floor(point.z/spacing);
    for(let a=x-1;a<=x+1;a++)for(let b=y-1;b<=y+1;b++)for(let c=z-1;c<=z+1;c++){
      const bucket=grid.get(cellKey(a,b,c));
      if(bucket)for(const normal of bucket)if(normal.distanceToSquared(point)<minimumSq)return true;
    }
    return false;
  }
  for(const marker of markers){
    const origin=marker.geoNormal;candidate.copy(origin);
    if(occupied(candidate)){
      east.crossVectors(up,origin);
      if(east.lengthSq()<1e-10)east.set(1,0,0);else east.normalize();
      north.crossVectors(origin,east).normalize();
      for(let attempt=1;attempt<=512;attempt++){
        const radius=spacing*1.4*Math.sqrt(attempt),angle=attempt*2.39996323;
        candidate.copy(origin).addScaledVector(east,Math.cos(angle)*radius).addScaledVector(north,Math.sin(angle)*radius).normalize();
        if(!occupied(candidate))break;
      }
    }
    marker.normal.copy(candidate);marker.root.position.copy(candidate).multiplyScalar(1.00004);
    marker.root.quaternion.setFromUnitVectors(up,candidate);marker.inverseRotation.copy(marker.root.quaternion).invert();marker.root.updateMatrix();
    const key=cellKey(Math.floor(candidate.x/spacing),Math.floor(candidate.y/spacing),Math.floor(candidate.z/spacing));
    if(!grid.has(key))grid.set(key,[]);grid.get(key).push(marker.normal);
  }
}