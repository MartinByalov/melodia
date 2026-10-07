import {spawn} from 'node:child_process';

const server=spawn(process.execPath,['server.js'],{cwd:new URL('../',import.meta.url),env:{...process.env,PORT:'3001'},stdio:'ignore'});
let socket;
try{
  await new Promise(r=>setTimeout(r,1000));
  const tab=await(await fetch('http://localhost:9223/json/new?http://localhost:3001/',{method:'PUT'})).json();
  socket=new WebSocket(tab.webSocketDebuggerUrl);
  await new Promise(r=>socket.addEventListener('open',r,{once:true}));
  let id=0;const pending=new Map();
  socket.addEventListener('message',event=>{const message=JSON.parse(event.data);if(pending.has(message.id)){pending.get(message.id)(message);pending.delete(message.id);}});
  const command=(method,params={})=>new Promise(resolve=>{const current=++id;pending.set(current,resolve);socket.send(JSON.stringify({id:current,method,params}));});
  await new Promise(r=>setTimeout(r,1500));
  const result=await command('Runtime.evaluate',{awaitPromise:true,returnByValue:true,expression:`(async()=>{
    const {createHLSPlayback}=await import('/hls-playback.js');
    const {default:Hls}=await import('/vendor/hls.mjs');
    const playback=createHLSPlayback();const audio=new Audio();audio.crossOrigin='anonymous';audio.muted=true;
    const outcome=new Promise((resolve,reject)=>{
      const timer=setTimeout(()=>reject(new Error('HLS playback timeout')),25000);
      audio.addEventListener('playing',()=>{clearTimeout(timer);resolve({version:Hls.version,readyState:audio.readyState,source:audio.src});},{once:true});
      audio.addEventListener('error',()=>{clearTimeout(timer);reject(new Error('Media error'));},{once:true});
    });
    try{await playback.attach(audio,'https://test-streams.mux.dev/x36xhzz/x36xhzz.m3u8',()=>{});await audio.play();return await outcome;}
    finally{audio.pause();playback.destroy();audio.removeAttribute('src');audio.load();}
  })()`});
  if(result.result.exceptionDetails)throw new Error(JSON.stringify(result.result.exceptionDetails));
  console.log(JSON.stringify(result.result.result.value));
  await fetch(`http://localhost:9223/json/close/${tab.id}`);
}finally{socket?.close();server.kill();}