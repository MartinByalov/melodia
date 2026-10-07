import * as THREE from 'three';

// Static country mask: polygon holes remain holes; animated colors are GPU-only.
export function createRegionColors(scene,geometry){
  const canvas=document.createElement('canvas');canvas.width=1024;canvas.height=512;
  const ctx=canvas.getContext('2d');
  const texture=new THREE.CanvasTexture(canvas);texture.minFilter=THREE.LinearFilter;texture.generateMipmaps=false;
  const uniforms={mask:{value:texture},time:{value:0},strength:{value:0},beat:{value:0},diversity:{value:1},theme:{value:new THREE.Color('#62efc5')}};
  const material=new THREE.ShaderMaterial({uniforms,transparent:true,depthWrite:false,polygonOffset:true,polygonOffsetFactor:-1,polygonOffsetUnits:-1,
    vertexShader:`varying vec2 regionUv;void main(){regionUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.0);}`,
    fragmentShader:`uniform sampler2D mask;uniform float time,strength,diversity,beat;uniform vec3 theme;varying vec2 regionUv;
      void main(){vec4 region=texture2D(mask,regionUv);if(region.a<.01||strength<.001)discard;
      float wave=.5+.5*sin(time*.2+regionUv.x*9.0+region.r*6.2831853);
      vec3 palette=.52+.48*cos(6.2831853*(region.r+time*.006+beat*.025+vec3(0.0,.333333,.666667)));
      vec3 color=mix(theme,palette,diversity*.85);
      gl_FragColor=vec4(color,region.a*strength*(.4+wave*.6)*(.92+beat*.08));
      #include <colorspace_fragment>
      }`});
  const object=new THREE.Mesh(geometry,material);object.scale.setScalar(1.000005);object.renderOrder=1;object.visible=false;scene.add(object);
  let disposed=false,ready=false;
  const abort=new AbortController();
  fetch(new URL('./assets/countries.geojson',import.meta.url),{signal:abort.signal}).then(r=>{if(!r.ok)throw new Error('Country mask unavailable');return r.json();}).then(data=>{
    if(disposed)return;
    data.features.forEach((feature,index)=>{
      const g=feature.geometry;
      const polygons=g?.type==='Polygon'?[g.coordinates]:g?.type==='MultiPolygon'?g.coordinates:[];
      ctx.fillStyle=`rgb(${32+(index*73)%220},0,0)`;
      for(const polygon of polygons){
        const rings=polygon.map(ring=>{
          let previous=ring[0]?.[0]??0;
          return ring.map(([lon,lat])=>{while(lon-previous>180)lon-=360;while(lon-previous< -180)lon+=360;previous=lon;return [(lon+180)/360*1024,(90-lat)/180*512];});
        });
        for(const shift of [-1024,0,1024]){
          ctx.beginPath();
          for(const ring of rings){ring.forEach(([x,y],i)=>i?ctx.lineTo(x+shift,y):ctx.moveTo(x+shift,y));ctx.closePath();}
          ctx.fill('evenodd');
        }
      }
    });
    texture.needsUpdate=true;ready=true;
  }).catch(()=>{});
  return {
    update(time,color,strength,visible,diversity=1,beat=0){uniforms.time.value=time;uniforms.theme.value.set(color);uniforms.strength.value=strength;uniforms.diversity.value=diversity;uniforms.beat.value=Math.max(0,Math.min(1,beat));object.visible=ready&&visible&&strength>.001;},
    dispose(){disposed=true;abort.abort();scene.remove(object);texture.dispose();material.dispose();}
  };
}