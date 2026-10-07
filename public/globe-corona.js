import * as THREE from 'three';

export function createGlobeCorona(scene,count=1200){
  const base=new THREE.PlaneGeometry(.002,1,1,3),geometry=new THREE.InstancedBufferGeometry();
  geometry.index=base.index;geometry.attributes.position=base.attributes.position;geometry.instanceCount=count;
  const normals=new Float32Array(count*3);
  for(let i=0;i<count;i++){
    const y=1-2*(i+.5)/count,r=Math.sqrt(1-y*y),angle=i*2.39996323;
    normals.set([r*Math.cos(angle),y,r*Math.sin(angle)],i*3);
  }
  geometry.setAttribute('rayNormal',new THREE.InstancedBufferAttribute(normals,3));
  const uniforms={time:{value:0},mixAmount:{value:0},signal:{value:0},scale:{value:1},color:{value:new THREE.Color('#62efc5')},view:{value:new THREE.Vector3()}};
  const material=new THREE.ShaderMaterial({uniforms,side:THREE.DoubleSide,depthWrite:false,
    vertexShader:`attribute vec3 rayNormal;uniform float time,mixAmount,signal,scale;uniform vec3 view;
      void main(){vec3 side=cross(rayNormal,view);if(length(side)<.0001)side=vec3(1.0,0.0,0.0);else side=normalize(side);
      float wave=.55+.45*sin(time*.8+rayNormal.y*8.0+rayNormal.x*4.0);
      float height=(.04+signal*.24)*wave*scale*mixAmount;
      vec3 p=rayNormal*(1.00004+(position.y+.5)*height)+side*position.x*scale*mixAmount;
      gl_Position=projectionMatrix*viewMatrix*vec4(p,1.0);}`,
    fragmentShader:`uniform vec3 color;void main(){gl_FragColor=vec4(color,1.0);
      #include <colorspace_fragment>
      }`});
  const object=new THREE.Mesh(geometry,material);object.frustumCulled=false;object.visible=false;scene.add(object);base.dispose();
  return {
    update(camera,time,mix,signal,color,visible){uniforms.time.value=time;uniforms.mixAmount.value=mix;uniforms.signal.value=Math.min(1,Math.max(0,signal));uniforms.color.value.set(color);uniforms.view.value.copy(camera.position).normalize();uniforms.scale.value=Math.min(1,Math.max(.0002,(camera.position.length()-1)/1.6));object.visible=visible&&mix>.001;},
    dispose(){scene.remove(object);geometry.dispose();material.dispose();}
  };
}