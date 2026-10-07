// Isolated WebGL benchmark: never run two globes on top of each other.
const tabs=await(await fetch('http://localhost:9223/json/list')).json();
const tab=tabs.find(t=>t.type==='page'&&t.url.includes('localhost:3000'));
if(!tab)throw new Error('Browser tab not found');
const socket=new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((resolve,reject)=>{socket.addEventListener('open',resolve,{once:true});socket.addEventListener('error',reject,{once:true});});
let id=0;const pending=new Map(),shaderErrors=[];
socket.addEventListener('message',event=>{
  const message=JSON.parse(event.data),request=pending.get(message.id);
  if(message.method==='Log.entryAdded'&&message.params.entry.level==='error'&&/shader|webgl|gl_invalid/i.test(message.params.entry.text))shaderErrors.push(message.params.entry.text);
  if(!request)return;
  pending.delete(message.id);
  if(message.error)request.reject(new Error(JSON.stringify(message.error)));else request.resolve(message.result);
});
function command(method,params={}){return new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});socket.send(JSON.stringify({id:next,method,params}));});}
try{
  await command('Log.enable');
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await command('Page.navigate',{url:'http://localhost:3000/tools/performance-scene.html'});
  await new Promise(resolve=>setTimeout(resolve,1000));
  const result=await command('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{
    const {createGlobe}=await import('./globe.js');
    const {normalizeStation}=await import('./radio.js');
    const THREE=await import('three');
    const {createMapBatch}=await import('./map-batch.js');
    const {buildMapBatch}=await import('./map-bvh.js');
    const {LineSegments2}=await import('./vendor/LineSegments2.js');
    const {LineSegmentsGeometry}=await import('./vendor/LineSegmentsGeometry.js');
    const {LineMaterial}=await import('./vendor/LineMaterial.js');
    const testRenderer=new THREE.WebGLRenderer({antialias:false});testRenderer.setSize(400,300);
    const target=new THREE.WebGLRenderTarget(400,300),testCamera=new THREE.PerspectiveCamera(40,4/3,.00001,100);
    const material=new LineMaterial({color:0x62efc5,linewidth:2.3,depthWrite:false});
    const chunks=[new Float32Array([-.2,0,1,.2,.1,1]),new Float32Array([0,-.3,1,0,.3,1]),new Float32Array([10,10,0,11,10,0])];
    const reference=new THREE.Scene(),batched=new THREE.Scene();
    for(const chunk of chunks){const geometry=new LineSegmentsGeometry();geometry.setPositions(chunk);reference.add(new LineSegments2(geometry,material));}
    const batch=createMapBatch(buildMapBatch(chunks),material);batched.add(batch.object);batch.object.visible=true;
    const frustum=new THREE.Frustum(),projection=new THREE.Matrix4(),a=new Uint8Array(400*300*4),b=new Uint8Array(a.length);
    let pixelDifference=0;
    for(const distance of [4.2,1.2,1.005]){
      testCamera.position.set(0,0,distance);testCamera.lookAt(0,0,0);testCamera.updateMatrixWorld();
      frustum.setFromProjectionMatrix(projection.multiplyMatrices(testCamera.projectionMatrix,testCamera.matrixWorldInverse));
      batch.update(testCamera,frustum,300);
      testRenderer.setRenderTarget(target);testRenderer.render(reference,testCamera);testRenderer.readRenderTargetPixels(target,0,0,400,300,a);
      testRenderer.render(batched,testCamera);testRenderer.readRenderTargetPixels(target,0,0,400,300,b);
      for(let i=0;i<a.length;i++)if(a[i]!==b[i])pixelDifference++;
      const uploads=batch.stats.uploads;batch.update(testCamera,frustum,300);
      if(batch.stats.uploads!==uploads)throw new Error('Stationary camera reuploaded segment IDs');
    }
    batch.dispose();reference.traverse(object=>object.geometry?.dispose());material.dispose();target.dispose();testRenderer.dispose();
    if(pixelDifference)throw new Error('Batched/reference pixel mismatch: '+pixelDifference);
    const host=document.querySelector('#globe');
    const stations=(await(await fetch('./assets/stations.json')).json()).map(normalizeStation).filter(Boolean);
    const globe=createGlobe(host,()=>{});globe.setStations(stations);globe.setPlaying(true);
    globe.setAudioReaction({available:true,signal:.65});globe.setAmplitude(.65);
    const until=performance.now()+30000;
    while(host.dataset.districtBoundaries!=='loaded'||host.dataset.detailMap!=='loaded'){
      if(performance.now()>until)throw new Error('Map load timed out');
      await new Promise(resolve=>setTimeout(resolve,100));
    }
    globe.setAudioReaction({available:true,signal:0});globe.setAmplitude(0);
    await new Promise(resolve=>setTimeout(resolve,300));
    if(host.dataset.audioReaction!=='current-stream'||host.dataset.pulsing!=='false')throw new Error('Real silence incorrectly triggered fallback pulse');
    globe.setAudioReaction({available:true,signal:.65});globe.setAmplitude(.65);
    const results=[];
    for(const [name,altitude] of [['overview',3.2],['region',.2],['city',.005]]){
      globe.reset();globe.zoom(altitude/3.2);
      await new Promise(resolve=>setTimeout(resolve,1200));
      const intervals=[];let previous=performance.now();const end=previous+3000;
      await new Promise(resolve=>{function sample(now){intervals.push(now-previous);previous=now;if(now<end)requestAnimationFrame(sample);else resolve();}requestAnimationFrame(sample);});
      intervals.sort((a,b)=>a-b);
      const mean=intervals.reduce((a,b)=>a+b,0)/intervals.length;
      results.push({name,frames:intervals.length,meanMs:+mean.toFixed(2),p95Ms:+intervals[Math.floor(intervals.length*.95)].toFixed(2),maxMs:+intervals.at(-1).toFixed(2),fps:+(1000/mean).toFixed(1),...host.dataset});
    }
    const gl=host.querySelector('canvas').getContext('webgl2');
    const debug=gl.getExtension('WEBGL_debug_renderer_info');
    const gpu=debug?gl.getParameter(debug.UNMASKED_RENDERER_WEBGL):'unavailable';
    globe.dispose();return {gpu,pixelDifference,results};
  })()`});
  if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));
  if(shaderErrors.length)throw new Error(shaderErrors.join('\n'));
  console.log(JSON.stringify(result.result.value,null,2));
}finally{
  await command('Page.navigate',{url:'http://localhost:3000/'});
  socket.close();
}