import * as THREE from 'three';

// Small instanced quads in the existing render pass, not animated CSS surfaces.
export function createGlobeBackground(scene) {
  const uniforms = { time: { value: 0 }, resolution: { value: new THREE.Vector2(1, 1) }, accent: { value: new THREE.Color('#62efc5') }, energy: { value: 0 }, motion: { value: 1 } };
  const objects = [];
  uniforms.colorful={value:1};
  function geometry(count) {
    const base = new THREE.PlaneGeometry(2, 2), result = new THREE.InstancedBufferGeometry();
    result.index = base.index; result.setAttribute('position', base.attributes.position); result.instanceCount = count;
    return result;
  }
  const starGeometry = geometry(420), stars = new Float32Array(420 * 4), rhythms = new Float32Array(420 * 2);
  let seed = 7342;
  const random = () => { seed = (Math.imul(seed, 1664525) + 1013904223) >>> 0; return seed / 4294967296; };
  for (let i = 0; i < 420; i++) {
    stars.set([random() * 2 - 1, random() * 2 - 1, 1.2 + random() * 2.4, random()], i * 4);
    rhythms.set([random() * Math.PI * 2, .35 + random() * .55], i * 2);
  }
  starGeometry.setAttribute('star', new THREE.InstancedBufferAttribute(stars, 4));
  starGeometry.setAttribute('twinkle', new THREE.InstancedBufferAttribute(rhythms, 2));
  const starMaterial = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthTest: true, depthWrite: false,
    vertexShader: `attribute vec4 star;attribute vec2 twinkle;uniform float time;uniform vec2 resolution;varying vec2 local;varying float light;varying float tint;
      void main(){local=position.xy;light=.25+.75*pow(.5+.5*sin(time*twinkle.y+twinkle.x),2.0);tint=star.w;
      float depth=.3+star.w*.7;
      vec2 drift=vec2(-time*.008,time*.0025)*depth;
      vec2 center=mod(star.xy+drift+1.08,2.16)-1.08;
      gl_Position=vec4(center+position.xy*star.z*2.0/resolution, 1.0,1.0);}`,
    fragmentShader: `varying vec2 local;varying float light;varying float tint;
      void main(){float radius=length(local);float aa=max(fwidth(radius),.001);float core=1.0-smoothstep(.32-aa,.32+aa,radius);
      float crossGlow=pow(max(0.0,1.0-abs(local.x)),8.0)*pow(max(0.0,1.0-abs(local.y)),2.0)+pow(max(0.0,1.0-abs(local.y)),8.0)*pow(max(0.0,1.0-abs(local.x)),2.0);
      float alpha=(core*.8+crossGlow*.22)*light;if(alpha<.005)discard;gl_FragColor=vec4(mix(vec3(.68,.79,1.0),vec3(1.0,.89,.74),tint),alpha);
      #include <colorspace_fragment>
      }`});
  const glowGeometry = geometry(7);
  glowGeometry.setAttribute('glowId', new THREE.InstancedBufferAttribute(new Float32Array([0, 1, 2, 3, 4, 5, 6]), 1));
  const glowMaterial = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthTest: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float glowId;uniform float time;varying vec2 local;varying float id;
      void main(){local=position.xy;id=glowId;float phase=time*.12+glowId*2.0943951;
      vec2 center=vec2(sin(phase)*.78,cos(phase*.73+glowId)*.68);
      if(glowId>2.5){float corner=glowId-3.0;center=vec2(mod(corner,2.0)<.5?-.92:.92,corner<1.5?-.92:.92);center+=vec2(sin(phase),cos(phase))*.06;}
      gl_Position=vec4(center+position.xy*vec2(.95,1.05),1.0,1.0);}`,
    fragmentShader: `uniform vec3 accent;uniform float energy,colorful;varying vec2 local;varying float id;
      void main(){float r=dot(local,local);if(r>1.0)discard;float alpha=pow(1.0-r,2.0)*(.065+energy*.012);
      float palette=mod(id,3.0);vec3 color=palette<.5?accent:palette<1.5?vec3(.45,.25,.9):vec3(.18,.48,.9);gl_FragColor=vec4(color,alpha);
      gl_FragColor=vec4(mix(accent,color,colorful),alpha*mix(.65,1.0,colorful));
      #include <colorspace_fragment>
      }`});
  const meteorGeometry = geometry(4);
  meteorGeometry.setAttribute('meteorId', new THREE.InstancedBufferAttribute(new Float32Array([0, 1, 2, 3]), 1));
  const meteorMaterial = new THREE.ShaderMaterial({
    uniforms, transparent: true, depthTest: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: `attribute float meteorId;uniform float time,motion;uniform vec2 resolution;varying vec2 local;varying float visibility;
      float randomValue(float seed){return fract(sin(seed*127.1+311.7)*43758.5453);}
      void main(){local=position.xy;float period=96.0;float slot=time+meteorId*24.0;float cycle=floor(slot/period);float seed=cycle*17.0+meteorId*71.0;
      float delay=4.0+randomValue(seed+1.0)*8.0;float age=mod(slot,period)-delay;float duration=7.0+randomValue(seed+2.0)*3.0;
      float progress=age/duration;visibility=motion*step(age,duration)*smoothstep(0.0,.12,progress)*(1.0-smoothstep(.7,1.0,progress));
      vec2 origin=vec2(randomValue(seed+3.0)*1.5-.75,randomValue(seed+4.0)*1.25-.3);
      float angle=-2.65+randomValue(seed+5.0)*2.15;vec2 direction=vec2(cos(angle),sin(angle));
      vec2 head=origin+direction*progress*.85;vec2 side=vec2(-direction.y,direction.x);
      vec2 pixels=direction*(position.x-1.0)*28.0+side*position.y*.8;
      gl_Position=vec4(head+pixels*2.0/resolution,1.0,1.0);}`,
    fragmentShader: `varying vec2 local;varying float visibility;
      void main(){float along=local.x*.5+.5;float width=mix(.12,.7,along);float edge=1.0-smoothstep(width-fwidth(local.y),width+fwidth(local.y),abs(local.y));
      float alpha=visibility*edge*pow(along,1.8);if(alpha<.002)discard;gl_FragColor=vec4(mix(vec3(.35,.65,1.0),vec3(1.0),along),alpha);
      #include <colorspace_fragment>
      }`});
  for (const [g, m, order] of [[glowGeometry, glowMaterial, -101], [starGeometry, starMaterial, -100], [meteorGeometry, meteorMaterial, -99]]) {
    const object = new THREE.Mesh(g, m); object.frustumCulled = false; object.matrixAutoUpdate = false; object.renderOrder = order; scene.add(object); objects.push(object);
  }
  return {
    update(time, width, height, reduced, energy) { uniforms.time.value = reduced ? 0 : time; uniforms.motion.value = reduced ? 0 : 1; uniforms.resolution.value.set(Math.max(1, width), Math.max(1, height)); uniforms.energy.value = energy; },
    setColor(color) { uniforms.accent.value.set(color); },
    setVisualProfile(profile){uniforms.colorful.value=profile.colors;},
    setVisible(visible) { for (const object of objects) object.visible = visible; },
    dispose() { for (const object of objects) { scene.remove(object); object.geometry.dispose(); object.material.dispose(); } }
  };
}