const tabs=await(await fetch('http://localhost:9223/json/list')).json();
const tab=tabs.find(t=>t.type==='page'&&t.url.includes('localhost:3000'));
if(!tab)throw new Error('Browser tab not found');
const socket=new WebSocket(tab.webSocketDebuggerUrl);
await new Promise(r=>socket.addEventListener('open',r,{once:true}));
let id=0;const pending=new Map();
socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(pending.has(message.id)){pending.get(message.id)(message);pending.delete(message.id);}});
const command=(method,params={})=>new Promise(resolve=>{const n=++id;pending.set(n,resolve);socket.send(JSON.stringify({id:n,method,params}));});
async function evaluate(expression){const response=await command('Runtime.evaluate',{expression,returnByValue:true});if(response.result.exceptionDetails)throw new Error(JSON.stringify(response.result.exceptionDetails));return response.result.result.value;}
try{
  await command('Page.reload',{ignoreCache:true});
  await new Promise(r=>setTimeout(r,1500));
  for(const width of [1440,390]){
    await command('Emulation.setDeviceMetricsOverride',{width,height:1000,deviceScaleFactor:1,mobile:width===390});
    for(const mode of ['day','night']){
      console.log(await evaluate(`(()=>{document.body.dataset.mode='${mode}';document.querySelector('#catalog').hidden=false;const dialog=document.querySelector('#share-dialog');if(!dialog.open)dialog.showModal();const copy=document.querySelector('#copy-link'),close=dialog.querySelector('.dialog-close'),catalog=document.querySelector('#catalog-close');if(copy.textContent!=='Copy Link'||getComputedStyle(copy).color!==('${mode}'==='day'?'rgb(21, 25, 36)':'rgb(255, 255, 255)'))throw new Error('Copy style');for(const property of ['width','height','borderRadius','borderTopWidth','fontSize','color']){if(getComputedStyle(close)[property]!==getComputedStyle(catalog)[property])throw new Error('Close mismatch: '+property);}const rect=close.getBoundingClientRect();return {mode:'${mode}',width:innerWidth,closeSize:getComputedStyle(close).width,x:rect.x+rect.width/2,y:rect.y+rect.height/2};})()`));
      const point=await evaluate(`(()=>{const r=document.querySelector('#share-dialog .dialog-close').getBoundingClientRect();return {x:r.x+r.width/2,y:r.y+r.height/2};})()`);
      await command('Input.dispatchMouseEvent',{type:'mouseMoved',...point});
      await evaluate(`(()=>{const close=document.querySelector('#share-dialog .dialog-close'),probe=document.createElement('span');probe.style.color='var(--accent)';document.body.append(probe);const expected=getComputedStyle(probe).color;probe.remove();if(!close.matches(':hover')||getComputedStyle(close).color!==expected||getComputedStyle(close).borderRadius!=='8px')throw new Error('Close hover');document.querySelector('#share-dialog').close();})()`);
    }
  }
}finally{
  await command('Emulation.clearDeviceMetricsOverride');
  await evaluate(`document.querySelector('#catalog').hidden=true`);
  socket.close();
}