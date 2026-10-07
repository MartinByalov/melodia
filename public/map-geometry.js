import { Vector3 } from './vendor/three.module.js';

function direction(lat, lon) {
  const p=lat*Math.PI/180,l=lon*Math.PI/180;
  return new Vector3(Math.cos(p)*Math.cos(l),Math.sin(p),-Math.cos(p)*Math.sin(l));
}

// Preserve every source edge and the existing spherical subdivision exactly.
export function buildMapPositions(data, kind) {
  const detailed=kind==='detail',district=kind==='district';
  const step=district?Math.PI/24000:detailed?Math.PI/12000:.008;
  const radius=district?1.000025:detailed?1.00001:1.0001;
  const positions=[],edges=detailed?new Set():null;
  const previous=new Vector3(),next=new Vector3();
  for(const feature of data.features){
    const geometry=feature.geometry;
    if(!geometry)continue;
    const lines=district
      ? geometry.type==='LineString'?[geometry.coordinates]:geometry.type==='MultiLineString'?geometry.coordinates:[]
      : geometry.type==='Polygon'?geometry.coordinates:geometry.type==='MultiPolygon'?geometry.coordinates.flat():[];
    for(const line of lines)for(let i=1;i<line.length;i++){
      const a=line[i-1],b=line[i];
      if(edges){const edge=[a.join(','),b.join(',')].sort().join('|');if(edges.has(edge))continue;edges.add(edge);}
      const from=direction(a[1],a[0]),to=direction(b[1],b[0]);
      const steps=Math.max(1,Math.ceil(from.angleTo(to)/step));
      previous.copy(from).multiplyScalar(radius);
      for(let j=1;j<=steps;j++){
        next.copy(from).lerp(to,j/steps).normalize().multiplyScalar(radius);
        positions.push(previous.x,previous.y,previous.z,next.x,next.y,next.z);
        previous.copy(next);
      }
    }
  }
  return new Float32Array(positions);
}

// Partition only: no simplification, resampling, or removal of source segments.
export function partitionMapPositions(positions, cellSize=.08) {
  const cells=new Map();
  for(let i=0;i<positions.length;i+=6){
    const x=Math.floor((positions[i]+positions[i+3])*.5/cellSize);
    const y=Math.floor((positions[i+1]+positions[i+4])*.5/cellSize);
    const z=Math.floor((positions[i+2]+positions[i+5])*.5/cellSize);
    const key=`${x},${y},${z}`;
    let cell=cells.get(key);if(!cell){cell=[];cells.set(key,cell);}
    for(let j=0;j<6;j++)cell.push(positions[i+j]);
  }
  return Array.from(cells.values(),cell=>new Float32Array(cell));
}