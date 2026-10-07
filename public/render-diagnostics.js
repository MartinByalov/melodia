// Opt-in measurements of actual renderer submissions, not an unrelated RAF loop.
export function createRenderDiagnostics(container, renderer) {
  if(new URLSearchParams(location.search).get('perf')!=='1')return null;
  const wrapper=document.createElement('div'),panel=document.createElement('pre');
  panel.setAttribute('role','status');
  panel.style.cssText='position:fixed;left:12px;top:100px;z-index:100;max-width:calc(100vw - 24px);padding:12px;background:#080b14ed;color:#e6ebf1;border:1px solid #62efc5;white-space:pre-wrap;font:12px/1.5 monospace;pointer-events:none';
  wrapper.id='render-diagnostics';
  wrapper.style.cssText=panel.style.cssText;
  wrapper.style.pointerEvents='auto';
  wrapper.style.maxHeight='calc(100dvh - 112px)';wrapper.style.overflow='auto';
  panel.style.cssText='margin:0;white-space:pre-wrap';
  wrapper.append(panel);document.body.append(wrapper);
  const controls=document.createElement('div'),select=document.createElement('select'),button=document.createElement('button'),results=document.createElement('pre');
  controls.style.cssText='display:flex;gap:8px;margin-top:8px';
  const modes=[['normal','Всичко'],['no-css','Без CSS ефекти'],['no-atmosphere','Без атмосфера'],['no-stations','Без точки/rays'],['no-borders','Без граници'],['empty','Само WebGL clear'],['no-webgl','Без WebGL']];
  for(const [value,label] of modes){const option=document.createElement('option');option.value=value;option.textContent=label;select.append(option);}
  controls.style.flexWrap='wrap';
  select.style.cssText='background:#141924;color:white;pointer-events:auto';
  button.id='render-autotest';button.type='button';button.textContent='▶ Автотест ~50 s';
  button.style.cssText='background:#234538;color:white;padding:8px 12px;border:1px solid #62efc5;border-radius:6px;cursor:pointer;pointer-events:auto;min-height:36px';
  controls.append(select,button);wrapper.append(controls,results);
  const isolationStyle=document.createElement('style');document.head.append(isolationStyle);
  let mode='normal',running=false,disposed=false,measurement=[];
  function changeMode(value){
    mode=value;select.value=value;
    isolationStyle.textContent=value==='no-css'?'body *,body *::before,body *::after{animation:none!important;transition:none!important;backdrop-filter:none!important}.ambient{visibility:hidden!important}':'';
    measurement=[];previous=0;samples.length=0;windowStart=performance.now();
  }
  select.addEventListener('change',()=>changeMode(select.value));
  const sleep=ms=>new Promise(resolve=>setTimeout(resolve,ms));
  button.addEventListener('click',async()=>{
    if(running)return;running=true;button.disabled=true;select.disabled=true;results.textContent='Не сменяй таба по време на теста.\n';
    try{
      for(const [value,label] of modes){
        if(disposed)break;changeMode(value);await sleep(1500);measurement=[];await sleep(5500);
        if(disposed)break;
        const intervals=measurement.slice().sort((a,b)=>a-b);
        if(!intervals.length){results.textContent+=label+': няма кадри\n';continue;}
        const mean=intervals.reduce((sum,n)=>sum+n,0)/intervals.length;
        results.textContent+=`${label}: ${(1000/mean).toFixed(1)} FPS, p95 ${intervals[Math.floor(intervals.length*.95)].toFixed(1)} ms\n`;
      }
    }finally{changeMode('normal');running=false;button.disabled=false;select.disabled=false;}
  });
  const gl=renderer.getContext(),extension=gl.getExtension('WEBGL_debug_renderer_info');
  const gpu=extension?gl.getParameter(extension.UNMASKED_RENDERER_WEBGL):gl.getParameter(gl.RENDERER);
  const samples=[];
  let previous=0,windowStart=performance.now();
  panel.textContent='Измерване на реалните кадри…\nGPU: '+gpu;
  return {
    get mode(){return mode;},
    frame(){
      const now=performance.now();
      if(previous){samples.push(now-previous);if(running)measurement.push(now-previous);}previous=now;
      if(now-windowStart<1000||!samples.length)return;
      samples.sort((a,b)=>a-b);
      const mean=samples.reduce((sum,n)=>sum+n,0)/samples.length;
      const p95=samples[Math.floor(samples.length*.95)],max=samples.at(-1);
      panel.textContent=`Рендер: BVH batch + horizon / native RAF\nРежим: ${mode} | ${mode==='no-webgl'?'RAF':'Render'} FPS: ${(1000/mean).toFixed(1)} | p95: ${p95.toFixed(1)} ms | max: ${max.toFixed(1)} ms\nDraw calls: ${renderer.info.render.calls} | triangles: ${renderer.info.render.triangles}\nCPU update: ${container.dataset.updateMs||'—'} ms | submit: ${container.dataset.renderMs||'—'} ms\nCanvas: ${gl.drawingBufferWidth} × ${gl.drawingBufferHeight} | DPR: ${devicePixelRatio}\nPlaying: ${container.dataset.playing} | rays: ${container.dataset.rays}\nGPU: ${gpu}`;
      samples.length=0;windowStart=now;
    },
    reset(){previous=0;samples.length=0;windowStart=performance.now();},
    dispose(){disposed=true;wrapper.remove();isolationStyle.remove();}
  };
}