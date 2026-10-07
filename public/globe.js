import * as THREE from 'three';
import { TrackballControls } from './vendor/TrackballControls.js';
import { LineSegments2 } from './vendor/LineSegments2.js';
import { LineSegmentsGeometry } from './vendor/LineSegmentsGeometry.js';
import { LineMaterial } from './vendor/LineMaterial.js';
import { stationColorHSL } from './radio.js';
import { rhythmProfile, syntheticLevel } from './rhythm.js';
import { createStationGPU } from './station-gpu.js';
import { createMapBatch } from './map-batch.js';
import { createRenderDiagnostics } from './render-diagnostics.js';
import { createGlobeBackground } from './globe-background.js';
import { createGlobeIdle, verticalDriftBounds } from './globe-idle.js';
import { createMapAccent } from './map-accent.js';
import { createGlobeEntrance } from './globe-entrance.js';
import { createLoadingReveal } from './loading-reveal.js';
import { installMapWave } from './map-wave.js';
import { createRegionColors } from './region-colors.js';
import { createEffectScenes } from './effect-scenes.js';
import { createGlobeCorona } from './globe-corona.js';
import { spreadStationMarkers, pointGrowth as markerGrowth } from './station-layout.js';

// Same east-negative-Z geographic convention as latest/scripts/map-globe-surface.js.
export function direction(lat, lon) {
  const p = lat * Math.PI / 180, l = lon * Math.PI / 180;
  return new THREE.Vector3(Math.cos(p) * Math.cos(l), Math.sin(p), -Math.cos(p) * Math.sin(l));
}
export function createGlobe(container, onSelect) {
  const scene = new THREE.Scene();
  const emptyScene=new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(40, 1, .00001, 100);
  const start = direction(23, 25).multiplyScalar(4.2);
  camera.position.copy(start);
  const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true, powerPreference: 'high-performance' });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 1.25));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  container.appendChild(renderer.domElement);
  const diagnostics=createRenderDiagnostics(container,renderer);
  const controls = new TrackballControls(camera, renderer.domElement);
  controls.staticMoving = true; controls.noPan = true; controls.noZoom = true;
  controls.minDistance = 1.0008; controls.maxDistance = 6.5; controls.autoRotateSpeed = .25;
  controls.zoomSpeed = .65;
  controls.enableZoom = false;
  function zoom(factor) {
    const distance=camera.position.length();
    const next=THREE.MathUtils.clamp(1+(distance-1)*factor,controls.minDistance,innerWidth<=760?9.5:controls.maxDistance);
    camera.position.setLength(next);controls.update();
  }
  renderer.domElement.addEventListener('wheel',event=>{event.preventDefault();zoom(Math.exp(Math.sign(event.deltaY)*.15));},{passive:false});
  let pinchDistance=0;
  renderer.domElement.addEventListener('touchstart',event=>{if(event.touches.length===2)pinchDistance=Math.hypot(event.touches[0].clientX-event.touches[1].clientX,event.touches[0].clientY-event.touches[1].clientY);},{passive:true});
  renderer.domElement.addEventListener('touchmove',event=>{if(event.touches.length!==2)return;const distance=Math.hypot(event.touches[0].clientX-event.touches[1].clientX,event.touches[0].clientY-event.touches[1].clientY);if(pinchDistance&&distance)zoom(pinchDistance/distance);pinchDistance=distance;},{passive:true});
  controls.autoRotate = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  scene.add(new THREE.AmbientLight(0xffffff, 2));
  const key = new THREE.DirectionalLight(0xe8faff, 2.4); key.position.set(3, 5, 4); scene.add(key);
  const fill = new THREE.DirectionalLight(0xb6c7ed, 1.5); fill.position.set(-3, -1, -3); scene.add(fill);
  const earth = new THREE.Mesh(new THREE.SphereGeometry(1, 512, 256), new THREE.MeshBasicMaterial({ color: 0x020305, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 2 }));
  scene.add(earth);
  const nightEarthMaterial=earth.material;
  const effectScenes=createEffectScenes();
  const globeCorona=createGlobeCorona(scene);
  let effectState={ray:0,surface:0,map:0,mix:0};
  const entranceEarthMaterial=new THREE.ShaderMaterial({
    uniforms:{color:{value:new THREE.Color('#62efc5')},baseColor:{value:new THREE.Color('#020305')},hatch:{value:1}},
    vertexShader:`varying vec2 tileUv;varying vec3 viewNormal,viewPosition;
      void main(){tileUv=uv;vec4 p=modelViewMatrix*vec4(position,1.0);viewNormal=normalize(normalMatrix*normal);viewPosition=-p.xyz;gl_Position=projectionMatrix*p;}`,
    fragmentShader:`uniform vec3 color,baseColor;uniform float hatch;varying vec2 tileUv;varying vec3 viewNormal,viewPosition;
      void main(){
      vec2 grid=tileUv*vec2(64.0,32.0),cell=floor(grid),local=fract(grid);
      vec2 edge=min(local,1.0-local),aa=max(fwidth(grid),vec2(.001));
      vec2 seam=smoothstep(vec2(.035)-aa,vec2(.035)+aa,edge);
      float tile=seam.x*seam.y;
      float variation=fract(sin(dot(cell,vec2(127.1,311.7)))*43758.5453);
      vec3 n=normalize(viewNormal),v=normalize(viewPosition);
      vec3 facet=normalize(n+vec3((variation-.5)*.16,(fract(variation*7.0)-.5)*.16,0.0));
      vec3 light=normalize(vec3(-.5,.7,1.0));
      float diffuse=max(dot(facet,light),0.0);
      float shine=pow(max(dot(facet,normalize(light+v)),0.0),48.0);
      vec3 scales=color*(.16+diffuse*.48+variation*.18)+vec3(shine*.45);
      vec3 tiled=mix(color*.025,scales,tile);
      gl_FragColor=vec4(mix(baseColor,tiled,hatch),1.0);
      #include <colorspace_fragment>
      }`,polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:2});
  const entranceEarthColor=new THREE.Color('#62efc5');
  const entranceDayColor=new THREE.Color('#b8c4cc');
  const dayEarthMaterial=new THREE.ShaderMaterial({
    uniforms:{interiorTint:{value:new THREE.Color('#62efc5')},interiorStrength:{value:0}},
    vertexShader:'varying vec3 n; varying vec3 v; void main(){vec4 p=modelViewMatrix*vec4(position,1.0);n=normalize(normalMatrix*normal);v=normalize(-p.xyz);gl_Position=projectionMatrix*p;}',
    fragmentShader:'uniform vec3 interiorTint;uniform float interiorStrength;varying vec3 n; varying vec3 v; void main(){float center=pow(max(dot(normalize(n),normalize(v)),0.0),.6);vec3 color=mix(vec3(.24,.31,.39),vec3(.72,.77,.80),center);color=mix(color,interiorTint,interiorStrength);gl_FragColor=vec4(color,1.0);}',
    polygonOffset:true,polygonOffsetFactor:1,polygonOffsetUnits:2
  });
  const status = document.querySelector('#player-message');
  const player=document.querySelector('.player');
  if(!player)throw new Error('Missing required .player element in index.html');
  const borderMaterial = new LineMaterial({ color: 0x62efc5, linewidth: 2.3, depthWrite: false });
  installMapWave(borderMaterial);
  let detailedBorders=null, overviewBorders=null;
  const overviewEarthGeometry=new THREE.SphereGeometry(1,96,64);
  const regionColors=createRegionColors(scene,overviewEarthGeometry);
  const detailedEarthGeometry=earth.geometry;
  const atmosphere = new THREE.Mesh(new THREE.SphereGeometry(1.04, 64, 48), new THREE.ShaderMaterial({
    uniforms: { glow: { value: new THREE.Color(0x55d9c8) } },
    vertexShader: 'varying vec3 n; varying vec3 v; void main(){ vec4 p=modelViewMatrix*vec4(position,1.0); n=normalize(normalMatrix*normal); v=normalize(-p.xyz); gl_Position=projectionMatrix*p; }',
    fragmentShader: 'varying vec3 n; varying vec3 v; uniform vec3 glow; void main(){ float rim=pow(1.0-abs(dot(n,v)),3.0); gl_FragColor=vec4(glow,rim*.28); }',
    transparent: true, side: THREE.BackSide, blending: THREE.AdditiveBlending, depthWrite: false
  })); scene.add(atmosphere);
  const background=createGlobeBackground(scene);
  const globeEntrance=createGlobeEntrance();
  let loadingWorld=true;
  const loadingReveal=createLoadingReveal(container);
  let styleProfile={pulse:1,ray:1,colors:1};
  container.dataset.background='gpu-stars-radiant';
  const ringMaterial = new THREE.MeshBasicMaterial({ color: 0x00dac5, side: THREE.DoubleSide, transparent: true, depthTest:false, depthWrite: false });
  const ring = new THREE.Mesh(new THREE.RingGeometry(.013, .016, 48), ringMaterial);
  ring.renderOrder=11;
  ring.rotation.x = -Math.PI / 2; ring.position.y = .004;
  let reducedMotion = matchMedia('(prefers-reduced-motion: reduce)').matches;
  let markers=[], active=null, selected=null, amplitude=0, frame=0, stationAmplitudes=new Map(), playing=false, globeHovered=false, rotationPaused=false;
  let stationGPU=null,audioReaction={available:false,signal:0};const markerById=new Map(),gpuLevels=new Map();
  const view=new THREE.Vector3(), projected=new THREE.Vector3(), axis=new THREE.Vector3();
  const defaultProfile=rhythmProfile('electronic','globe');
  const earthSphere=new THREE.Sphere(new THREE.Vector3(),1), surfacePoint=new THREE.Vector3();
  function markActive() {
    ring.removeFromParent();
    active=markers.find(m=>m.s.id===selected);
    if (active) { ringMaterial.color.copy(active.color); scene.add(active.root); active.root.add(ring); }
  }
  function setStations(stations) {
    stationGPU?.dispose();markerById.clear();
    ring.removeFromParent();if(active)scene.remove(active.root);markers = [];
    for (const s of stations) {
      if (!Number.isFinite(s.lat) || !Number.isFinite(s.lon)) continue;
      const index=markers.length;
      const normal=direction(s.lat,s.lon), root=new THREE.Group(); root.position.copy(normal.clone().multiplyScalar(1.00004)); root.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),normal);
      const hsl=stationColorHSL(s.id),color=new THREE.Color().setHSL(hsl.h,hsl.s,hsl.l,THREE.SRGBColorSpace);
      root.updateMatrix();root.matrixAutoUpdate=false;
      markers.push({s,root,normal,geoNormal:normal.clone(),color,inverseRotation:root.quaternion.clone().invert(),index,profile:rhythmProfile(s.tags,s.id)});
    }
    spreadStationMarkers(markers);
    markActive();
    for(const marker of markers)markerById.set(marker.s.id,marker);
    stationGPU=createStationGPU(scene,markers);
    stationGPU.setColor(outlineColor);
    stationGPU.setVisualProfile(styleProfile);
    container.dataset.rayColors=String(new Set(markers.map(marker=>marker.color.getHexString())).size);
  }
  const raycaster = new THREE.Raycaster(), pointer = new THREE.Vector2(), tooltip = document.querySelector('#tooltip');
  let down=null, hovered=null;
  function hit(event) {
    const r=renderer.domElement.getBoundingClientRect();pointer.set((event.clientX-r.left)/r.width*2-1,-(event.clientY-r.top)/r.height*2+1);raycaster.setFromCamera(pointer,camera);
    // Pick only visible dots. Rays do not need expensive triangle intersection.
    const distance=camera.position.length(),scale=Math.min(1,Math.max(.0002,(distance-1)/1.6)),growth=markerGrowth(distance-1);
    view.copy(camera.position).normalize();let best=null,bestDistance=Infinity;
    for(const marker of markers){
      if(marker.normal.dot(view)<=1/distance)continue;
      projected.copy(marker.root.position).project(camera);
      if(projected.z>1)continue;
      const x=(projected.x+1)*r.width/2+r.left,y=(1-projected.y)*r.height/2+r.top;
      const radius=.0075*scale*growth*(marker===active?1.6:1)*r.height/(2*Math.tan(camera.fov*Math.PI/360)*camera.position.distanceTo(marker.root.position));
      const delta=Math.hypot(event.clientX-x,event.clientY-y);
      if(delta<=Math.max(3,radius)&&delta<bestDistance){best=marker.s;bestDistance=delta;}
    }
    return best;
  }
  renderer.domElement.addEventListener('pointerdown',e=>{down={x:e.clientX,y:e.clientY};});
  renderer.domElement.addEventListener('pointerup',e=>{if(down&&Math.hypot(e.clientX-down.x,e.clientY-down.y)<6){const s=hit(e);if(s)onSelect(s);}down=null;});
  renderer.domElement.addEventListener('pointermove',e=>{
    idlePointer={clientX:e.clientX,clientY:e.clientY};
    pendingPointer={clientX:e.clientX,clientY:e.clientY};
    if(hovered){tooltip.textContent=hovered.name;tooltip.style.display='block';}else tooltip.style.display='none';
  });
  let pendingPointer=null,idlePointer=null;
  renderer.domElement.addEventListener('pointerleave',()=>{idlePointer=null;pendingPointer=null;hovered=null;globeHovered=false;tooltip.style.display='none';});
  renderer.domElement.addEventListener('dblclick',event=>{hit(event);if(raycaster.ray.intersectSphere(earthSphere,surfacePoint)){camera.position.copy(surfacePoint.normalize().multiplyScalar(camera.position.length()));controls.autoRotate=false;zoom(.55);}});
  const resize=()=>{const w=container.clientWidth,h=container.clientHeight;camera.aspect=w/h;camera.updateProjectionMatrix();renderer.setSize(w,h);controls.handleResize();};
  const resizeObserver=new ResizeObserver(resize);resizeObserver.observe(container);resize();
  const intro = document.querySelector('.intro');
  let mobileGlobeOffset=0,mobileGlobeTarget=0;
  const idleMotion=createGlobeIdle();
  const idleActivity=()=>idleMotion.activity(performance.now());
  const idleEvents=['pointerdown','wheel','keydown'];
  for(const event of idleEvents)document.addEventListener(event,idleActivity,{capture:true,passive:true});
  document.addEventListener('visibilitychange',idleActivity);
  const cityLayer = document.createElement('div'); cityLayer.className = 'city-layer'; container.append(cityLayer);
  const cityLabels = new Map();let visibleCityLabels=new Set();
  let cities=[], cityLevels=[];
  fetch(new URL('./assets/cities.json',import.meta.url)).then(r=>{if(!r.ok)throw new Error('Cities unavailable');return r.json();}).then(data=>{
    cities=data.map(c=>({...c,position:direction(c.lat,c.lon)})).sort((a,b)=>b.population-a.population);
    cityLevels=[.9,.15,.015].map(spacing=>{
      const cells=new Map(), result=[];
      for(const city of cities){
        const x=Math.floor(city.lon/spacing),y=Math.floor(city.lat/spacing);let crowded=false;
        for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++){
          if((cells.get(`${x+dx},${y+dy}`)||[]).some(other=>Math.abs(other.lat-city.lat)<spacing&&Math.abs(other.lon-city.lon)<spacing))crowded=true;
        }
        if(!crowded){result.push(city);const key=`${x},${y}`;if(!cells.has(key))cells.set(key,[]);cells.get(key).push(city);}
      }
      return result;
    });
    container.dataset.cities=String(cities.length);
  }).catch(()=>{container.dataset.cities='unavailable';});
  const municipalMaterial = new LineMaterial({ color: borderMaterial.color, linewidth: 1.6, depthWrite: false });
  installMapWave(municipalMaterial);
  let municipalLines=null;
  const mapBatches=[],mapFrustum=new THREE.Frustum(),mapMatrix=new THREE.Matrix4();
  let disposed=false;
  const mapWorker=new Worker(new URL('./map-worker.js',import.meta.url),{type:'module'});
  let resolveReady;
  const ready=new Promise(resolve=>{resolveReady=resolve;});
  const pendingMaps=new Set(['overview','detail','district']);
  let mapsFailed=false;
  function settleMap(kind,failed=false){
    mapsFailed ||= failed;pendingMaps.delete(kind);
    if(!pendingMaps.size)resolveReady(!mapsFailed);
  }
  mapWorker.onmessage=({data:{kind,chunks,batch,features,error}})=>{
    if(disposed)return;
    if(error){
      settleMap(kind,true);
      if(kind==='detail')status.textContent='Map could not load. Refresh the page.';
      if(kind==='district')container.dataset.districtBoundaries='unavailable';
      return;
    }
    let layer;
    if(batch){
      const mapBatch=createMapBatch(batch,kind==='district'?municipalMaterial:borderMaterial);
      mapBatches.push(mapBatch);layer=mapBatch.object;
    }else{
      const geometry=new LineSegmentsGeometry();geometry.setPositions(chunks[0]);
      layer=new LineSegments2(geometry,borderMaterial);
    }
    scene.add(layer);
    if(kind==='district'){
      municipalLines=layer;
      container.dataset.districtBoundaries='loaded';container.dataset.districts=String(features);
    }else{
      if(kind==='detail')detailedBorders=layer;else overviewBorders=layer;
      container.dataset.map='country-borders';if(kind==='detail')container.dataset.detailMap='loaded';
    }
    updateOverlay();updateCityBoundaries();
    settleMap(kind);
  };
  mapWorker.onerror=()=>{status.textContent='Map could not load. Refresh the page.';container.dataset.districtBoundaries='unavailable';mapsFailed=true;resolveReady(false);};
  for(const [kind,file] of [['overview','countries.geojson'],['detail','countries-detail.geojson'],['district','districts.geojson']]){
    mapWorker.postMessage({kind,url:new URL('./assets/'+file,import.meta.url).href,maxTextureSize:Math.min(4096,renderer.capabilities.maxTextureSize)});
  }
  function updateCityBoundaries(){if(municipalLines)municipalLines.visible=camera.position.length()<1.8;}
  let mapMode='night', outlineColor='#62efc5';
  const mapAccent=createMapAccent();
  const accentStops=['#46dcff','#a58bff','#ffc35c'].map(color=>new THREE.Color(color));
  const accentBase=new THREE.Color(),accentColor=new THREE.Color();
  let accentActive=false;
  let lastAccentHex='';
  function applyAccentTheme(color){
    background.setColor(color);stationGPU?.setColor(color);atmosphere.material.uniforms.glow.value.set(color);
    dayEarthMaterial.uniforms.interiorTint.value.set(color);
    const interior=(styleProfile.interior??.08)*(playing&&!reducedMotion?1:0);
    dayEarthMaterial.uniforms.interiorStrength.value=interior;
    nightEarthMaterial.color.set('#020305').lerp(accentBase.set(color),interior*.22);
    const hex=color instanceof THREE.Color?'#'+color.getHexString():color;
    if(hex!==lastAccentHex){lastAccentHex=hex;container.dispatchEvent(new CustomEvent('themeaccent',{detail:{color:hex}}));}
  }
  function mapColor(color){const c=new THREE.Color(color);if(mapMode==='day')c.multiplyScalar(.26);return c;}
  function applyMapPalette(){
    borderMaterial.color.copy(mapColor(outlineColor));municipalMaterial.color.copy(mapColor(outlineColor));
    for(const batch of mapBatches)batch.setColor(borderMaterial.color);
    if(active)ringMaterial.color.copy(active.color);
    container.dataset.renderedOutline='#'+borderMaterial.color.getHexString();
  }
  function updateMapAccent(time){
    const phase=mapAccent.update(time,Math.max(audioReaction.signal,(audioReaction.rhythm||0)*1.2),playing&&audioReaction.available&&!reducedMotion&&styleProfile.colors>0);
    const sceneFill=effectState.map===2?effectState.mix*(.12+.06*Math.sin(time*.7)):effectState.map===1?effectState.mix*.2:0;
    const showRegions=!loadingWorld;
    const regionBeat=audioReaction.available&&!reducedMotion?(audioReaction.rhythm||0):0;
    regionColors.update(time*(styleProfile.waveSpeed??1),outlineColor,phase===null?sceneFill:Math.max(sceneFill,Math.sin(phase*Math.PI)*.32),showRegions,styleProfile.colors>0?1:.15,regionBeat);
    const waveMaterials=[borderMaterial,municipalMaterial,...mapBatches.map(batch=>batch.object.material)];
    for(const material of waveMaterials){
      material.uniforms.waveStrength.value=phase===null?0:(styleProfile.wave??.65)*Math.sin(phase*Math.PI);
      material.uniforms.wavePhase.value=(phase??0)*2*(styleProfile.waveSpeed??1);
      material.uniforms.waveColor.value.copy(accentStops[Math.min(2,Math.floor((phase??0)*3))]);
      if(mapMode==='day')material.uniforms.waveColor.value.multiplyScalar(.26);
    }
    if(phase===null){if(accentActive){accentActive=false;applyMapPalette();}applyAccentTheme(outlineColor);return;}
    accentActive=true;accentBase.set(outlineColor);
    const position=phase*4,index=Math.floor(position),fraction=position-index;
    const from=index===0?accentBase:accentStops[index-1];
    const to=index===3?accentBase:accentStops[index];
    accentColor.copy(from).lerp(to,fraction*fraction*(3-2*fraction));
    applyAccentTheme(accentColor);
    regionColors.update(time*(styleProfile.waveSpeed??1),accentColor,Math.sin(phase*Math.PI)*.32,showRegions,styleProfile.colors>0?1:.15,regionBeat);
    if(mapMode==='day')accentColor.multiplyScalar(.26);
    borderMaterial.color.copy(accentColor);municipalMaterial.color.copy(accentColor);
    for(const batch of mapBatches)batch.setColor(accentColor);
  }
  function updateOverlay() {
    const distance=camera.position.length(), altitude=distance-1;
    const closeView=altitude<.5;
    earth.geometry=closeView?detailedEarthGeometry:overviewEarthGeometry;
    if(detailedBorders)detailedBorders.visible=closeView||!overviewBorders;
    if(overviewBorders)overviewBorders.visible=!closeView;
    container.dataset.altitude=altitude.toFixed(5);
    if (intro) {
      const rect=intro.getBoundingClientRect(), box=container.getBoundingClientRect();
      const radius=box.height/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*Math.tan(Math.asin(1/distance));
      const mobileIntro=innerWidth<=760||document.body.dataset.embed==='true';
      const playerTop=player.getBoundingClientRect().top;
      // On mobile and in embeds the sphere sits between the intro and player.
      // Solve for the intro's center halfway between the canvas top and sphere top.
      const introTop=mobileIntro?Math.max(18,(playerTop-box.top-2*radius-rect.height)/3):18;
      const textBottom=box.top+introTop+rect.height;
      const mobileSpace=playerTop-textBottom;
      const visible=mobileIntro
        ? mobileSpace/2-radius>16
        : box.left+box.width/2-radius>rect.right+24;
      mobileGlobeTarget=mobileIntro&&visible?(textBottom+playerTop)/2-(box.top+box.height/2):0;
      if(mobileIntro){
        intro.style.top=`${introTop}px`;
      }else intro.style.removeProperty('top');
      const showIntro=visible&&!(mobileIntro&&idleMotion.active);
      intro.classList.toggle('visible',showIntro); intro.setAttribute('aria-hidden',String(!showIntro));
    }
    cityLayer.hidden=altitude>.35;
    const nextLabels=new Set();
    if(cityLayer.hidden){for(const label of visibleCityLabels)label.hidden=true;visibleCityLabels=nextLabels;return;}
    view.copy(camera.position).normalize();
    const width=container.clientWidth,height=container.clientHeight;
    let labelCount=0;
    for(const city of cityLevels[altitude>.08?0:altitude>.015?1:2]||[]){
      if(city.position.dot(view)<=1/distance)continue;
      const p=projected.copy(city.position).multiplyScalar(1.00006).project(camera);
      if(Math.abs(p.x)>.93||Math.abs(p.y)>.88||p.z>1)continue;
      const x=(p.x+1)*width/2,y=(1-p.y)*height/2;
      // A label belongs to one geographic location, never a recycled screen slot.
      // Geographic spacing is stable while dragging; screen-space collision sorting is not.
      let label=cityLabels.get(city);
      if(!label){label=document.createElement('span');label.className='city-label';label.textContent=city.name;cityLabels.set(city,label);cityLayer.append(label);}
      label.style.transform=`translate(${x}px,${y}px) translate(-50%,-50%)`;if(label.hidden)label.hidden=false;nextLabels.add(label);
      if(++labelCount>=80)break;
    }
    for(const label of visibleCityLabels)if(!nextLabels.has(label))label.hidden=true;
    visibleCityLabels=nextLabels;
  }
  function animate(time=0){
    frame=requestAnimationFrame(animate);if(document.hidden||disposed){diagnostics?.reset();return;}
    const cpuStart=performance.now();
    const dt=Math.min(50,time-(animate.previousTime||time));animate.previousTime=time;
    const entranceScale=globeEntrance.update(dt/1000,loadingWorld,reducedMotion);
    effectState=effectScenes.update(dt/1000,playing&&!loadingWorld&&!reducedMotion);
    stationGPU?.setScene(effectState.ray,effectState.mix);
    globeCorona.update(camera,time/1000,effectState.ray===6?effectState.mix:0,audioReaction.signal,outlineColor,playing&&styleProfile.style!=='talk'&&!loadingWorld&&!reducedMotion&&!globeHovered);
    entranceEarthMaterial.uniforms.color.value.copy(entranceEarthColor);
    entranceEarthMaterial.uniforms.hatch.value=1-globeEntrance.completion;
    entranceEarthMaterial.uniforms.baseColor.value.copy(mapMode==='day'?entranceDayColor:nightEarthMaterial.color);
    if(pendingPointer){hovered=hit(pendingPointer);globeHovered=raycaster.ray.intersectsSphere(earthSphere);renderer.domElement.style.cursor=hovered?'pointer':'grab';tooltip.style.display=hovered?'block':'none';if(hovered)tooltip.textContent=hovered.name;pendingPointer=null;}
    if(idlePointer&&container.dataset.idleDrifting==='true'){
      const bounds=renderer.domElement.getBoundingClientRect();
      pointer.set((idlePointer.clientX-bounds.left)/bounds.width*2-1,-(idlePointer.clientY-bounds.top)/bounds.height*2+1);
      raycaster.setFromCamera(pointer,camera);
      if(raycaster.ray.intersectsSphere(earthSphere)){globeHovered=true;idleMotion.activity(time);}
    }
    const rhythm=audioReaction.available?(audioReaction.rhythm||0):0;
    const cadence=playing?Math.sin(time/1000*2*Math.PI/(styleProfile.period??5))*(styleProfile.cadence??0):0;
    const motion=(styleProfile.motion==='sway'?1+Math.sin(time/1700)*.45:styleProfile.motion==='beat'?1+rhythm*.8:1)*(1+cadence);
    if(!rotationPaused&&(controls.autoRotate||playing)&&!down&&!globeHovered&&!reducedMotion)camera.position.applyAxisAngle(axis.copy(camera.up).normalize(),-.00095*(dt/16.667)*Math.min(1,(camera.position.length()-1)/.5)*(styleProfile.rotation??1)*motion);
    controls.update();
    updateMapAccent(time/1000);
    const pulseTarget=playing&&!globeHovered&&!reducedMotion?(audioReaction.available?rhythm:syntheticLevel(active?.profile||defaultProfile,time/1000))*9.5:0;
    const pulseDuration=pulseTarget>(animate.smoothedPulse||0)?35:150;
    animate.smoothedPulse=(animate.smoothedPulse||0)+(pulseTarget-(animate.smoothedPulse||0))*(1-Math.exp(-dt/pulseDuration));
    const pulse=Math.min(13,animate.smoothedPulse*styleProfile.pulse);
    camera.fov=40-pulse;
    const near=Math.max(.00001,Math.min(.1,(camera.position.length()-1)*.1));
    if(camera.near!==near||animate.lastFov!==camera.fov){camera.near=near;camera.updateProjectionMatrix();animate.lastFov=camera.fov;}
    // Shift only the projection, not the canvas or station positions.
    // Raycasting uses the matching inverse matrix, keeping touch selection aligned.
    const mobileDrift=innerWidth<=760||document.body.dataset.embed==='true';
    const target=(mobileDrift&&!idleMotion.active?mobileGlobeTarget:0)*entranceScale;
    mobileGlobeOffset=reducedMotion?target:mobileGlobeOffset+(target-mobileGlobeOffset)*(1-Math.exp(-dt/220));
    const idleWidth=container.clientWidth,idleHeight=container.clientHeight;
    const globeRadius=idleHeight/(2*Math.tan(THREE.MathUtils.degToRad(camera.fov/2)))*Math.tan(Math.asin(1/camera.position.length()));
    // Mobile and embed drift between the header bottom and the measured player top.
    let verticalLimit=idleHeight/2-globeRadius;
    if(mobileDrift){
      const box=container.getBoundingClientRect();
      const center=box.top+idleHeight/2+mobileGlobeOffset;
      verticalLimit=verticalDriftBounds(document.querySelector('header').getBoundingClientRect().bottom,document.querySelector('.player').getBoundingClientRect().top,center,globeRadius);
    }
    const idleState=idleMotion.update(time,dt/1000,idleWidth/2-globeRadius,verticalLimit,
      loadingWorld||reducedMotion||globeHovered||!!down||document.body.dataset.catalogOpen==='true'||!!document.querySelector('dialog[open]'));
    camera.projectionMatrix.elements[8]=-2*idleState.x/Math.max(1,idleWidth);
    const projectionOffset=2*(mobileGlobeOffset+idleState.y)/Math.max(1,idleHeight);
    container.dataset.idleDrifting=String(idleState.active);
    if(camera.projectionMatrix.elements[9]!==projectionOffset){
      camera.projectionMatrix.elements[9]=projectionOffset;
      camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    }
    // Scale the existing globe projection, never station positions or the background.
    const projectionY=1/Math.tan(THREE.MathUtils.degToRad(camera.fov/2))*entranceScale;
    camera.projectionMatrix.elements[0]=projectionY/camera.aspect;
    camera.projectionMatrix.elements[5]=projectionY;
    camera.projectionMatrixInverse.copy(camera.projectionMatrix).invert();
    camera.updateMatrixWorld();
    const distance=camera.position.length(), altitude=distance-1;
    view.copy(camera.position).multiplyScalar(1/distance);
    const scale=Math.min(1,Math.max(.0002,altitude/1.6));
    const pointGrowth=markerGrowth(altitude);
    gpuLevels.clear();
    for(const [id,value] of stationAmplitudes){const marker=markerById.get(id);if(marker)gpuLevels.set(marker.index,value);}
    stationGPU?.update(camera,time/1000,scale,pointGrowth,active?.index??-1,markerById.get(hovered?.id)?.index??-1,amplitude,playing,reducedMotion,gpuLevels,audioReaction.available,globeHovered);
    if(hovered){const marker=markerById.get(hovered.id);if(marker){projected.copy(marker.root.position).project(camera);tooltip.style.left=((projected.x+1)*container.clientWidth/2)+'px';tooltip.style.top=((1-projected.y)*container.clientHeight/2-12)+'px';}}
    if(active){
      ring.visible=active.normal.dot(view)>1/distance;
      ring.quaternion.copy(active.inverseRotation).multiply(camera.quaternion);
      const pulse=reducedMotion ? 0 : (time%1600)/1600;
      const scale=Math.min(1,Math.max(.0002,(camera.position.length()-1)/1.6));
      const pointGrowth=markerGrowth(camera.position.length()-1);
      ring.scale.setScalar((1+pulse*1.6+amplitude*.5)*scale*pointGrowth);ring.position.y=.004*scale;
      ringMaterial.opacity=reducedMotion ? 1 : 1-pulse*.85;
    }
    if(time-(animate.overlayTime||-1000)>50){updateOverlay();animate.overlayTime=time;}
    updateCityBoundaries();
    mapFrustum.setFromProjectionMatrix(mapMatrix.multiplyMatrices(camera.projectionMatrix,camera.matrixWorldInverse));
    background.update(time/1000,container.clientWidth,container.clientHeight,reducedMotion,playing?audioReaction.signal:0);
    for(const batch of mapBatches)batch.update(camera,mapFrustum,container.clientHeight);
    controls.rotateSpeed=Math.max(.002,Math.min(1,(camera.position.length()-1)*.6));
    if(camera.position.length()<1.5)controls.autoRotate=false;
    const renderStart=performance.now();
    const diagnosticMode=diagnostics?.mode||'normal';
    const hidden=[];
    loadingReveal.update(time,loadingWorld,mobileGlobeOffset,reducedMotion);
    if(loadingWorld){
      hidden.push(detailedBorders,overviewBorders,municipalLines,ring);
      for(const batch of mapBatches)hidden.push(batch.object);
      stationGPU?.setDiagnosticHidden(true);
      cityLayer.hidden=true;
    }
    if(diagnosticMode==='no-atmosphere')hidden.push(atmosphere);
    if(diagnosticMode==='no-borders')hidden.push(detailedBorders,overviewBorders,municipalLines);
    if(diagnosticMode==='no-stations')stationGPU?.setDiagnosticHidden(true);
    const visibility=[...new Set(hidden.filter(Boolean))].map(object=>[object,object.visible]);
    for(const [object] of visibility)object.visible=false;
    const normalEarthMaterial=earth.material;
    if(loadingWorld||globeEntrance.completion<1)earth.material=entranceEarthMaterial;
    try{
      if(diagnosticMode!=='no-webgl')renderer.render(diagnosticMode==='empty'?emptyScene:scene,camera);
    }finally{
      earth.material=normalEarthMaterial;
      for(const [object,visible] of visibility)object.visible=visible;
      if(loadingWorld||diagnosticMode==='no-stations')stationGPU?.setDiagnosticHidden(false);
    }
    if(time-(animate.statsTime||0)>1000){container.dataset.drawCalls=String(renderer.info.render.calls);container.dataset.updateMs=(renderStart-cpuStart).toFixed(2);container.dataset.renderMs=(performance.now()-renderStart).toFixed(2);container.dataset.triangles=String(renderer.info.render.triangles);container.dataset.stationCount=String(markers.length);animate.statsTime=time;}
    for(const [key,value] of [['playing',String(playing)],['pulsing',String(pulseTarget>0)],['rays',String(playing&&styleProfile.style!=='talk'?markers.length:0)]])if(container.dataset[key]!==value)container.dataset[key]=value;
    diagnostics?.frame();
  }
  animate();
  return {
    setReducedEffects(value){reducedMotion=Boolean(value)||matchMedia('(prefers-reduced-motion: reduce)').matches;},
    ready,
    finishLoading(){loadingWorld=false;},
    setVisualProfile(profile){styleProfile=profile;effectScenes.reset(profile.style);stationGPU?.setVisualProfile(profile);background.setVisualProfile(profile);container.dataset.visualStyle=profile.style;},
    setStations,
    select(s){mapAccent.reset();accentActive=false;applyMapPalette();if(active)scene.remove(active.root);selected=s.id;markActive();controls.autoRotate=false;if(Number.isFinite(s.lat)&&Number.isFinite(s.lon))camera.position.copy(direction(s.lat,s.lon).multiplyScalar(camera.position.length()));controls.update();},
    setAmplitude(value){amplitude=value;},
    setAudioReaction(value){audioReaction={available:Boolean(value.available),signal:THREE.MathUtils.clamp(value.signal||0,0,1),rhythm:THREE.MathUtils.clamp(value.rhythm||0,0,1)};container.dataset.audioReaction=audioReaction.available?'current-stream':'genre-fallback';},
    setPlaying(value){playing=Boolean(value);if(!playing)amplitude=0;},
    setStationAmplitudes(values){stationAmplitudes=values;},
    getVisibleStations(limit=6){view.copy(camera.position).normalize();return markers.filter(m=>m.s.id!==selected&&m.normal.dot(view)>.5).sort((a,b)=>b.s.clicks-a.s.clicks).slice(0,limit).map(m=>m.s);},
    setColor(color){outlineColor=color;entranceEarthColor.set(color);background.setColor(color);stationGPU?.setColor(color);atmosphere.material.uniforms.glow.value.set(color);applyMapPalette();container.dataset.outlineColor=color;},
    setMode(mode){mapMode=mode;applyMapPalette();earth.material=mode==='day'?dayEarthMaterial:nightEarthMaterial;atmosphere.visible=true;container.dataset.mode=mode;},
    toggleRotate(){rotationPaused=!rotationPaused;if(!rotationPaused)controls.autoRotate=true;return !rotationPaused;},
    zoom,
    resetAxis(){const distance=camera.position.length();controls.reset();camera.position.copy(start).setLength(distance);camera.up.set(0,1,0);down=null;pendingPointer=null;hovered=null;globeHovered=false;tooltip.style.display='none';controls.update();camera.updateMatrixWorld();updateOverlay();},
    reset(){camera.up.set(0,1,0);camera.position.copy(start);controls.update();},
    get rotating(){return !rotationPaused&&(controls.autoRotate||playing);},
    dispose(){disposed=true;for(const event of idleEvents)document.removeEventListener(event,idleActivity,true);document.removeEventListener('visibilitychange',idleActivity);globeCorona.dispose();regionColors.dispose();loadingReveal.dispose();background.dispose();diagnostics?.dispose();mapWorker.terminate();stationGPU?.dispose();for(const batch of mapBatches){scene.remove(batch.object);batch.dispose();}cancelAnimationFrame(frame);resizeObserver.disconnect();controls.dispose();scene.traverse(object=>{object.geometry?.dispose();if(object.material){for(const material of Array.isArray(object.material)?object.material:[object.material])material.dispose();}});borderMaterial.dispose();municipalMaterial.dispose();detailedEarthGeometry.dispose();overviewEarthGeometry.dispose();dayEarthMaterial.dispose();nightEarthMaterial.dispose();entranceEarthMaterial.dispose();cityLayer.remove();renderer.dispose();renderer.domElement.remove();}
  };
}