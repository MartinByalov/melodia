import { buildMapPositions, partitionMapPositions } from './map-geometry.js';
import { buildMapBatch } from './map-bvh.js';

self.onmessage=async({data:{kind,url,maxTextureSize}})=>{
  try{
    const response=await fetch(url);
    if(!response.ok)throw new Error('Map unavailable');
    const data=await response.json();
    const positions=buildMapPositions(data,kind);
    const chunks=kind==='overview'?[positions]:partitionMapPositions(positions);
    if(kind==='overview')self.postMessage({kind,chunks,features:data.features.length},chunks.map(chunk=>chunk.buffer));
    else{
      const batch=buildMapBatch(chunks,maxTextureSize);
      self.postMessage({kind,batch,features:data.features.length},[batch.textureData.buffer,batch.ranges.buffer]);
    }
  }catch(error){self.postMessage({kind,error:error.message});}
};