import * as THREE from 'three';

// Static station attributes; camera-facing dots and radial rays are computed on GPU.
export function createStationGPU(scene, markers) {
  const uniforms={time:{value:0},scale:{value:1},growth:{value:1},distance:{value:4.2},selected:{value:-1},hovered:{value:-1},amplitude:{value:0},reduced:{value:0},reveal:{value:0},cameraRight:{value:new THREE.Vector3()},cameraUp:{value:new THREE.Vector3()},viewDirection:{value:new THREE.Vector3()},audio:{value:Array.from({length:6},()=>new THREE.Vector2(-1,0))}};
  uniforms.currentAudio={value:0};
  uniforms.themeColor={value:new THREE.Color('#62efc5')};
  uniforms.styleEffects={value:new THREE.Vector2(1,1)};
  uniforms.styleTravel={value:new THREE.Vector2(0,1)};
  uniforms.worm={value:0};
  uniforms.rayScene={value:new THREE.Vector2(0,0)};
  const shared=`
    attribute vec3 stationNormal;
    attribute vec3 stationColor;
    attribute vec3 rhythm;
    attribute float stationId;
    uniform float time, scale, growth, distance, selected, hovered, amplitude, reduced, reveal, currentAudio;
    uniform vec3 cameraRight, cameraUp, viewDirection;
    uniform vec3 themeColor;
    uniform vec2 styleEffects;
    uniform vec2 styleTravel;
    uniform float worm;
    uniform vec2 rayScene;
    uniform vec2 audio[6];
    varying vec3 tint;
    varying vec2 dotUv;
    varying float filled;
    float level(){
      float beat=time*rhythm.x/120.0+rhythm.y;
      float wave=.5+.5*cos(beat*6.2831853);
      float kick=pow(wave,mix(3.0,2.0,rhythm.z));
      float accent=(sin(beat*6.2831853)+1.0)*.06;
      float phrase=.7+.3*sin(beat*.3926991+rhythm.y*6.0);
      float value=min(1.0,.08+kick*phrase*.72+accent);
      for(int i=0;i<6;i++){if(abs(audio[i].x-stationId)<.1)value=audio[i].y;}
      return value;
    }
  `;
  const attributes={};
  for(const [name,size] of [['stationNormal',3],['stationColor',3],['rhythm',3],['stationId',1]])attributes[name]=new THREE.InstancedBufferAttribute(new Float32Array(markers.length*size),size);
  for(let i=0;i<markers.length;i++){
    const m=markers[i];
    attributes.stationNormal.setXYZ(i,m.normal.x,m.normal.y,m.normal.z);
    attributes.stationColor.setXYZ(i,m.color.r,m.color.g,m.color.b);
    attributes.rhythm.setXYZ(i,m.profile.bpm,m.profile.phase,m.profile.soft?1:0);
    attributes.stationId.setX(i,m.index);
  }
  function mesh(ray){
    const base=new THREE.PlaneGeometry(ray?.0036:.015,ray?1:.015,1,ray?6:1);
    const geometry=new THREE.InstancedBufferGeometry();geometry.index=base.index;geometry.attributes.position=base.attributes.position;geometry.attributes.uv=base.attributes.uv;geometry.instanceCount=markers.length;
    for(const [name,attribute] of Object.entries(attributes))geometry.setAttribute(name,attribute);
    const material=new THREE.ShaderMaterial({uniforms,side:THREE.DoubleSide,transparent:!ray,depthTest:ray,depthWrite:false,vertexShader:shared+`
      void main(){
        tint=stationColor;dotUv=uv;
        bool isSelected=abs(stationId-selected)<.1;
        filled=(isSelected||abs(stationId-hovered)<.1)?1.0:0.0;
        float facing=dot(stationNormal,viewDirection);
        if(facing<1.0/distance${ray?'-.12':''}){gl_Position=vec4(2.0,2.0,2.0,1.0);return;}
        vec3 world=stationNormal*1.00004;
        ${ray?`
          float localLevel=level();
          float cycle=.5+.5*sin(time*rhythm.x/120.0*6.2831853+rhythm.y*6.2831853);
          float gate=pow(cycle,mix(2.4,1.6,rhythm.z));
          float signal=currentAudio>.5?min(1.0,amplitude*1.25)*mix(.25,1.0,gate):localLevel*gate;
          signal=mix(signal,.3,reduced);
          float zoomBoost=1.0+1.2*smoothstep(1.6,5.5,distance-1.0);
          float height=signal*(isSelected?.44:.32)*zoomBoost*scale*reveal;
          height*=styleEffects.x;
          float travel=.5+.5*sin(time*styleTravel.y+stationNormal.y*9.0+stationNormal.x*5.0);
          height*=mix(1.0,travel,styleTravel.x*(1.0-reduced));
          // Per-instance color: each entire ray stays solid, while the wave travels spatially.
          float colorTime=mod(time/3.0,48.0);
          float waveMix=smoothstep(14.0,17.0,colorTime)*(1.0-smoothstep(25.0,29.0,colorTime));
          float wavePhase=(colorTime-14.0)*.16+dot(stationNormal,vec3(.65,.45,.6))*.55;
          vec3 waveColor=.5+.5*cos(6.2831853*(wavePhase+vec3(0.0,.333333,.666667)));
          tint=mix(mix(themeColor,stationColor,styleEffects.y),waveColor,waveMix*(1.0-reduced)*styleEffects.y);
          vec3 side=cross(stationNormal,viewDirection);
          if(length(side)<.0001)side=cameraRight;else side=normalize(side);
          world+=stationNormal*(position.y+.5)*height+side*position.x*scale;
          float along=position.y+.5;
          float bend=sin(along*8.0-time*1.6+rhythm.y*6.2831853)-sin(-time*1.6+rhythm.y*6.2831853);
          float shape=rayScene.x<1.5?bend*along*.12:rayScene.x<2.5?sin(along*3.14159265)*.25:sin(along*9.0-time+rhythm.y*6.0)*along*.15;
          if(rayScene.x>3.5)shape=rayScene.x<4.5?sin(along*3.14159265)*sin(time*.7+rhythm.y*6.0)*.28:sin(along*12.0+rhythm.y*6.0-time*.8)*along*.09;
          vec3 tangent=normalize(cross(stationNormal,side));
          float depthShape=0.0;
          if(rayScene.x>6.5&&rayScene.x<7.5){
            // Hook: straight stem with a curved tip.
            float tip=smoothstep(.35,1.0,along);
            shape=tip*tip*.32*sin(time*.45+rhythm.y*6.0);
          }else if(rayScene.x<8.5&&rayScene.x>7.5){
            // S-shaped ribbon anchored at the sphere.
            shape=sin(along*6.2831853)*along*.2*cos(time*.5+rhythm.y*6.0);
          }else if(rayScene.x<9.5&&rayScene.x>8.5){
            // Angular lightning, sampled by the existing six segments.
            float zig=1.0-4.0*abs(fract(along*3.0+.25)-.5);
            shape=zig*along*.14*(.65+amplitude*.35);
          }else if(rayScene.x<10.5&&rayScene.x>9.5){
            // Conical spiral grows wider toward its tip.
            float phase=time*.7+rhythm.y*6.0;
            shape=(sin(along*6.2831853+phase)-sin(phase))*along*.18;
            depthShape=(cos(along*6.2831853+phase)-cos(phase))*along*.18;
          }else if(rayScene.x<11.5&&rayScene.x>10.5){
            // Umbrella fan, bent mostly at the top.
            shape=pow(along,3.0)*.38;
            depthShape=sin(rhythm.y*6.0+time*.3)*along*along*.12;
          }else if(rayScene.x>11.5){
            // Travelling crescent; small arc with slow lateral sway.
            shape=sin(along*3.14159265)*.28;
            depthShape=sin(time*.4+rhythm.y*6.0)*along*.12;
          }
          world+=side*shape*height*worm*(1.0-reduced);
          world+=tangent*depthShape*height*worm*(1.0-reduced);
          if(rayScene.x>2.5&&rayScene.x<3.5)world+=tangent*(cos(along*9.0-time+rhythm.y*6.0)-cos(-time+rhythm.y*6.0))*along*height*.1*worm*(1.0-reduced);
        `:`world+=(cameraRight*position.x+cameraUp*position.y)*scale*growth*(isSelected?1.6:1.0);`}
        gl_Position=projectionMatrix*viewMatrix*vec4(world,1.0);
      }`,fragmentShader:`varying vec3 tint;varying vec2 dotUv;varying float filled;
      void main(){float alpha=1.0;${ray?'':`
        float radius=length(dotUv-.5);
        float aa=max(fwidth(radius),.0001);
        alpha=1.0-smoothstep(.5-aa,.5,radius);
        if(filled<.5)alpha*=smoothstep(.366667-aa*.5,.366667+aa*.5,radius);
        if(alpha<=0.0)discard;
      `}gl_FragColor=vec4(tint,alpha);
      #include <tonemapping_fragment>
      #include <colorspace_fragment>
      }`});
    const object=new THREE.Mesh(geometry,material);object.frustumCulled=false;object.renderOrder=ray?0:10;scene.add(object);return object;
  }
  const dots=mesh(false),rays=mesh(true);
  let rayVisibility=false,previousTime=null,raysEnabled=true;
  const smoothedAudio=new Map();
  return {
    setColor(color){uniforms.themeColor.value.set(color);},
    setScene(mode,mix){uniforms.rayScene.value.set(mode,mix);},
    setVisualProfile(profile){raysEnabled=profile.style!=='talk';if(!raysEnabled){rays.visible=false;rayVisibility=false;}uniforms.styleEffects.value.set(profile.ray,profile.colors);uniforms.styleTravel.value.set(profile.rayTravel??0,profile.raySpeed??1);},
    setDiagnosticHidden(hidden){if(hidden){rayVisibility=rays.visible;dots.visible=false;rays.visible=false;}else{dots.visible=true;rays.visible=rayVisibility;}},
    update(camera,time,scale,growth,selected,hovered,amplitude,playing,reduced,levels,currentAudio=false,planetHovered=false){
      const dt=previousTime===null?0:Math.min(.1,Math.max(0,time-previousTime));previousTime=time;
      const smoothing=1-Math.exp(-dt/(amplitude>uniforms.amplitude.value ? .07 : .18));
      if(uniforms.selected.value!==selected)uniforms.amplitude.value=0;
      uniforms.amplitude.value+=(amplitude-uniforms.amplitude.value)*smoothing;
      uniforms.currentAudio.value=currentAudio?1:0;
      const wormTarget=playing&&!planetHovered&&!reduced&&uniforms.rayScene.value.x>.5?uniforms.rayScene.value.y:0;
      uniforms.worm.value+=(wormTarget-uniforms.worm.value)*(1-Math.exp(-dt/.25));
      uniforms.reveal.value=reduced?(playing?1:0):uniforms.reveal.value+((playing?1:0)-uniforms.reveal.value)*(1-Math.exp(-dt/.45));
      uniforms.time.value=time;uniforms.scale.value=scale;uniforms.growth.value=growth;uniforms.distance.value=camera.position.length();uniforms.selected.value=selected;uniforms.hovered.value=hovered;uniforms.reduced.value=reduced?1:0;
      uniforms.cameraRight.value.setFromMatrixColumn(camera.matrixWorld,0);uniforms.cameraUp.value.setFromMatrixColumn(camera.matrixWorld,1);uniforms.viewDirection.value.copy(camera.position).normalize();
      for(const index of smoothedAudio.keys())if(!levels.has(index))smoothedAudio.delete(index);
      let i=0;for(const [index,value] of levels){if(i===6)break;const previous=smoothedAudio.get(index)??value;const next=previous+(value-previous)*smoothing;smoothedAudio.set(index,next);uniforms.audio.value[i++].set(index,next);}while(i<6)uniforms.audio.value[i++].set(-1,0);
      rays.visible=playing&&raysEnabled;
    },
    dispose(){for(const object of [dots,rays]){scene.remove(object);object.geometry.dispose();object.material.dispose();}}
  };
}