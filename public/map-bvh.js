// Worker-safe static BVH and texture packing. No geometry simplification.
export function buildMapBatch(chunks, maxTextureSize=4096) {
  const ranges=new Uint32Array(chunks.length*2),leaves=[];
  let segmentCount=0,maxRadius=0;
  for(let id=0;id<chunks.length;id++){
    const positions=chunks[id];
    if(positions.length%6)throw new Error('Incomplete map segment');
    ranges[id*2]=segmentCount;ranges[id*2+1]=positions.length/6;
    segmentCount+=positions.length/6;
    if(!positions.length)continue;
    const bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
    for(let i=0;i<positions.length;i+=3){
      maxRadius=Math.max(maxRadius,Math.hypot(positions[i],positions[i+1],positions[i+2]));
      for(let axis=0;axis<3;axis++){
      bounds[axis]=Math.min(bounds[axis],positions[i+axis]);
      bounds[axis+3]=Math.max(bounds[axis+3],positions[i+axis]);
    }
    }
    leaves.push({bounds,chunk:id});
  }
  // Segment IDs must be exact in a float vertex attribute.
  if(segmentCount>8388608)throw new Error('Map exceeds exact texture address range');
  const width=Math.min(maxTextureSize,Math.max(1,segmentCount*2));
  const height=Math.max(1,Math.ceil(segmentCount*2/width));
  if(height>maxTextureSize)throw new Error('Map exceeds GPU texture capacity');
  const textureData=new Float32Array(width*height*4);
  let texel=0;
  for(const positions of chunks)for(let i=0;i<positions.length;i+=3){
    textureData[texel*4]=positions[i];textureData[texel*4+1]=positions[i+1];textureData[texel*4+2]=positions[i+2];texel++;
  }
  const nodes=[];
  function build(items){
    const index=nodes.length,bounds=[Infinity,Infinity,Infinity,-Infinity,-Infinity,-Infinity];
    for(const item of items)for(let axis=0;axis<3;axis++){
      bounds[axis]=Math.min(bounds[axis],item.bounds[axis]);bounds[axis+3]=Math.max(bounds[axis+3],item.bounds[axis+3]);
    }
    const node={bounds,chunk:-1,left:-1,right:-1};nodes.push(node);
    if(items.length===1){node.chunk=items[0].chunk;return index;}
    let axis=0;for(let a=1;a<3;a++)if(bounds[a+3]-bounds[a]>bounds[axis+3]-bounds[axis])axis=a;
    items.sort((a,b)=>(a.bounds[axis]+a.bounds[axis+3])-(b.bounds[axis]+b.bounds[axis+3]));
    const middle=Math.floor(items.length/2);
    node.left=build(items.slice(0,middle));node.right=build(items.slice(middle));
    return index;
  }
  const root=leaves.length?build(leaves):-1;
  return {ranges,nodes,root,textureData,width,height,segmentCount,maxRadius};
}

// Necessary (not sufficient) condition for visibility above an opaque unit sphere.
// Expanding the endpoint radius by the line-cap margin deliberately retains
// uncertain horizon segments; only definitely hidden BVH nodes are removed.
export function mapHorizonConstant(distance, radius) {
  return -(1-Math.sqrt(Math.max(0,(distance*distance-1)*(radius*radius-1))));
}

export function queryMapBVH(batch, planes, margin=0, result=[]) {
  result.length=0;let visited=0;
  function visit(index){
    visited++;
    const node=batch.nodes[index],b=node.bounds;
    for(const plane of planes){
      const n=plane.normal;
      const x=n.x>=0?b[3]+margin:b[0]-margin;
      const y=n.y>=0?b[4]+margin:b[1]-margin;
      const z=n.z>=0?b[5]+margin:b[2]-margin;
      if(n.x*x+n.y*y+n.z*z+plane.constant<0)return;
    }
    if(node.chunk!==-1){result.push(node.chunk);return;}
    visit(node.left);visit(node.right);
  }
  if(batch.root!==-1)visit(batch.root);
  return visited;
}

export function writeVisibleSegmentIds(batch, chunks, target) {
  let count=0;
  for(const chunk of chunks){
    const start=batch.ranges[chunk*2],end=start+batch.ranges[chunk*2+1];
    if(count+end-start>target.length)throw new Error('Visible segment buffer too small');
    for(let id=start;id<end;id++)target[count++]=id;
  }
  return count;
}