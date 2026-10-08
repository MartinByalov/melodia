// Sample animation frame intervals in the same browser used by browser-check.js.
const tabs=await(await fetch('http://localhost:9223/json/list')).json();
const tab=tabs.find(t=>t.type==='page'&&t.url.includes('localhost:3000'));
if(!tab)throw new Error('Browser tab not found');
const socket=new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let id=0;const pending=new Map(),shaderErrors=[];
socket.addEventListener('message',e=>{const message=JSON.parse(e.data);if(message.method==='Log.entryAdded'&&/shader|webgl|gl_invalid/i.test(message.params.entry.text)&&message.params.entry.level==='error')shaderErrors.push(message.params.entry.text);if(pending.has(message.id)){pending.get(message.id)(message.result);pending.delete(message.id);}});
function command(method,params={}){return new Promise(resolve=>{const next=++id;pending.set(next,resolve);socket.send(JSON.stringify({id:next,method,params}));});}
await command('Log.enable');
await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
await command('Page.reload',{ignoreCache:true});
await new Promise(resolve=>setTimeout(resolve,9000));
const result=await command('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{
  const {createGlobe}=await import('./globe.js');
  const host=document.createElement('div');host.style.cssText='position:fixed;inset:72px 0 120px;z-index:4';document.body.append(host);
  const data=await(await fetch('./assets/stations.json')).json();
  const {normalizeStation,supportsHLS}=await import('./radio.js');
  const allowHLS=supportsHLS();
  const globe=createGlobe(host,()=>{});globe.setStations(data.map(station=>normalizeStation(station,false,allowHLS)).filter(Boolean));globe.setPlaying(true);
  await new Promise(r=>setTimeout(r,4000));
  const intervals=[];let previous=performance.now();const until=previous+4000;
  await new Promise(resolve=>{function sample(now){intervals.push(now-previous);previous=now;if(now<until)requestAnimationFrame(sample);else resolve();}requestAnimationFrame(sample);});
  intervals.sort((a,b)=>a-b);const mean=intervals.reduce((a,b)=>a+b,0)/intervals.length;
   const result={frames:intervals.length,meanMs:+mean.toFixed(2),p95Ms:+intervals[Math.floor(intervals.length*.95)].toFixed(2),estimatedFps:+(1000/mean).toFixed(1),drawCalls:host.dataset.drawCalls,updateMs:host.dataset.updateMs,renderSubmissionMs:host.dataset.renderMs,triangles:host.dataset.triangles,stations:host.dataset.stationCount};
  globe.dispose();host.remove();return result;
})()`});
socket.close();
if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));
if(shaderErrors.length)throw new Error(shaderErrors.join('\n'));
console.log(JSON.stringify(result.result.value));