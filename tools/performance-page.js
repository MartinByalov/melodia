// Measure actual globe submissions in the full application, not just RAF callbacks.
const tabs=await(await fetch('http://localhost:9223/json/list')).json();
const tab=tabs.find(tab=>tab.type==='page'&&tab.url.includes('localhost:3000'));
if(!tab)throw new Error('Application tab not found');
const socket=new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(resolve=>socket.addEventListener('open',resolve,{once:true}));
let id=0;const pending=new Map();
socket.addEventListener('message',event=>{
  const message=JSON.parse(event.data),request=pending.get(message.id);
  if(!request)return;pending.delete(message.id);
  if(message.error)request.reject(new Error(JSON.stringify(message.error)));else request.resolve(message.result);
});
function command(method,params={}){return new Promise((resolve,reject)=>{const next=++id;pending.set(next,{resolve,reject});socket.send(JSON.stringify({id:next,method,params}));});}
async function evaluate(expression){
  const result=await command('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});
  if(result.exceptionDetails)throw new Error(JSON.stringify(result.exceptionDetails));return result.result.value;
}
let script;
try{
  await command('Page.enable');
  script=await command('Page.addScriptToEvaluateOnNewDocument',{source:`
    window.__renderTimes=[];
    const original=WebGL2RenderingContext.prototype.clear;
    WebGL2RenderingContext.prototype.clear=function(mask){
      if(this.canvas.parentElement?.id==='globe')window.__renderTimes.push(performance.now());
      return original.call(this,mask);
    };
  `});
  await command('Emulation.setDeviceMetricsOverride',{width:1440,height:1000,deviceScaleFactor:1,mobile:false});
  await command('Page.reload',{ignoreCache:true});
  await new Promise(resolve=>setTimeout(resolve,10000));
  await evaluate(`(()=>{if(!window.__renderTimes){window.__renderTimes=[];const original=WebGL2RenderingContext.prototype.clear;WebGL2RenderingContext.prototype.clear=function(mask){if(this.canvas.parentElement?.id==='globe')window.__renderTimes.push(performance.now());return original.call(this,mask);};}})()`);
  const idle=process.argv.includes('--idle');
  const scenarios=idle?[['idle',0],['idle-no-css',0]]:[['overview',0],['region',-18],['city',-25]];
  for(const [name,zoom] of scenarios){
    if(name==='idle-no-css')await evaluate(`(()=>{const style=document.createElement('style');style.textContent='*,*::before,*::after{animation:none!important;transition:none!important;backdrop-filter:none!important}';document.head.append(style);})()`);
    await evaluate(`(()=>{const canvas=document.querySelector('#globe canvas');for(let i=0;i<${Math.abs(zoom)};i++)canvas.dispatchEvent(new WheelEvent('wheel',{deltaY:-100,bubbles:true,cancelable:true}));window.__renderTimes.length=0;})()`);
    if(idle)await new Promise(resolve=>setTimeout(resolve,5000));
    else{
    // Continuous real pointer drag, delivered through Chromium's input pipeline.
    await command('Input.dispatchMouseEvent',{type:'mousePressed',x:760,y:460,button:'left',clickCount:1});
    for(let i=0;i<100;i++){
      await command('Input.dispatchMouseEvent',{type:'mouseMoved',x:760+Math.sin(i*.08)*160,y:460+Math.cos(i*.08)*70,button:'left',buttons:1});
      await new Promise(resolve=>setTimeout(resolve,30));
    }
    await command('Input.dispatchMouseEvent',{type:'mouseReleased',x:760,y:460,button:'left',clickCount:1});
    }
    console.log(name,await evaluate(`(()=>{
      const times=window.__renderTimes,intervals=times.slice(1).map((t,i)=>t-times[i]).sort((a,b)=>a-b);
      if(!intervals.length)throw new Error('No actual rendered frames captured');
      const mean=intervals.reduce((a,b)=>a+b,0)/intervals.length;
      return {frames:times.length,fps:+(1000/mean).toFixed(1),p95Ms:+intervals[Math.floor(intervals.length*.95)].toFixed(2),maxMs:+intervals.at(-1).toFixed(2),...document.querySelector('#globe').dataset};
    })()`));
  }
}finally{
  if(script)await command('Page.removeScriptToEvaluateOnNewDocument',{identifier:script.identifier});
  await command('Page.reload',{ignoreCache:true});socket.close();
}