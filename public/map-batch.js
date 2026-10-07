import * as THREE from 'three';
import { LineSegmentsGeometry } from './vendor/LineSegmentsGeometry.js';
import { LineSegments2 } from './vendor/LineSegments2.js';
import { queryMapBVH, writeVisibleSegmentIds, mapHorizonConstant } from './map-bvh.js';

// One instanced fat-line draw per map layer. The original LineMaterial handles
// line width, round caps, clipping, depth and color; only endpoint lookup changes.
export function createMapBatch(batch, sourceMaterial) {
  const texture=new THREE.DataTexture(batch.textureData,batch.width,batch.height,THREE.RGBAFormat,THREE.FloatType);
  texture.minFilter=THREE.NearestFilter;texture.magFilter=THREE.NearestFilter;
  texture.generateMipmaps=false;texture.needsUpdate=true;
  const material=sourceMaterial.clone();
  material.uniforms.mapEndpoints={value:texture};
  material.uniforms.mapTextureSize={value:new THREE.Vector2(batch.width,batch.height)};
  material.vertexShader=material.vertexShader.replace(
    'attribute vec3 instanceStart;',
    `attribute float segmentId;
     uniform sampler2D mapEndpoints;
     uniform vec2 mapTextureSize;
     vec3 mapEndpoint(float address){
       vec2 texel=vec2(mod(address,mapTextureSize.x),floor(address/mapTextureSize.x));
       return texture2D(mapEndpoints,(texel+.5)/mapTextureSize).xyz;
     }`
  ).replace('attribute vec3 instanceEnd;','').replace(
    'void main() {',
    'void main() { vec3 instanceStart=mapEndpoint(segmentId*2.0); vec3 instanceEnd=mapEndpoint(segmentId*2.0+1.0);'
  );
  const geometry=new LineSegmentsGeometry();
  const ids=new THREE.InstancedBufferAttribute(new Float32Array(batch.segmentCount),1);
  ids.setUsage(THREE.DynamicDrawUsage);geometry.setAttribute('segmentId',ids);geometry.instanceCount=0;
  const object=new LineSegments2(geometry,material);
  object.frustumCulled=false;object.matrixAutoUpdate=false;object.visible=false;
  const chunks=[],previous=[],matrix=new THREE.Matrix4(),nextMatrix=new THREE.Matrix4();
  const horizon=new THREE.Plane(),planes=[];
  let lastMargin=-1,initialized=false,visited=0,uploads=0;
  return {
    object,
    update(camera,frustum,viewportHeight){
      if(!object.visible)return;
      // Conservative cap/width allowance in world units at the farthest endpoint.
      const margin=Math.max(.00001,(camera.position.length()+1.01)*Math.tan(camera.fov*Math.PI/360)*material.linewidth*4/Math.max(1,viewportHeight));
      nextMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse);
      if(initialized&&matrix.equals(nextMatrix)&&lastMargin===margin)return;
      matrix.copy(nextMatrix);lastMargin=margin;initialized=true;
      horizon.normal.copy(camera.position);
      horizon.constant=mapHorizonConstant(camera.position.length(),batch.maxRadius+margin);
      planes.length=0;for(const plane of frustum.planes)planes.push(plane);planes.push(horizon);
      visited=queryMapBVH(batch,planes,margin,chunks);
      if(chunks.length===previous.length&&chunks.every((id,i)=>id===previous[i]))return;
      const count=writeVisibleSegmentIds(batch,chunks,ids.array);
      geometry.instanceCount=count;
      if(count){ids.clearUpdateRanges();ids.addUpdateRange(0,count);ids.needsUpdate=true;uploads++;}
      previous.length=0;for(const id of chunks)previous.push(id);
    },
    setColor(color){material.color.copy(color);},
    get stats(){return {chunks:chunks.length,visited,segments:geometry.instanceCount,uploads};},
    dispose(){geometry.dispose();material.dispose();texture.dispose();}
  };
}