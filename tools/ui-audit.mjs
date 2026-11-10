// UI audit: starts the site and a headless browser on free ports, walks every layout in night and day mode and prints what is wrong. Exit code 1 when anything fails.
// Usage: npm run audit   (set BROWSER to the path of Chrome or Edge when it is not found)
import { spawn, spawnSync } from 'node:child_process';
import { existsSync, mkdtempSync, rmSync } from 'node:fs';
import { createServer } from 'node:net';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const root = fileURLToPath(new URL('..', import.meta.url));
const candidates = [process.env.BROWSER, 'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Microsoft/Edge/Application/msedge.exe', 'C:/Program Files/Google/Chrome/Application/chrome.exe', '/usr/bin/google-chrome', '/usr/bin/chromium', '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome'].filter(Boolean);
const browserPath = candidates.find(existsSync);
if (!browserPath) { console.error('No Chrome or Edge found. Set BROWSER to its path.'); process.exit(2); }

const freePort = () => new Promise(resolve => { const s = createServer(); s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); }); });
const wait = ms => new Promise(r => setTimeout(r, ms));
const children = [];
// Headless Edge and Chrome can start a process outside the tree of the one launched, so everything that uses an audit profile folder is stopped too.
function stopAuditBrowsers() {
  if (process.platform === 'win32') spawnSync('powershell', ['-NoProfile', '-Command', "Get-CimInstance Win32_Process | Where-Object { $_.CommandLine -like '*melodia-audit-*' -and $_.ProcessId -ne $PID } | ForEach-Object { Stop-Process -Id $_.ProcessId -Force -ErrorAction SilentlyContinue }"], { stdio: 'ignore' });
  else spawnSync('pkill', ['-f', 'melodia-audit-'], { stdio: 'ignore' });
}
function stopAll() {
  for (const child of children) {
    if (!child.pid) continue;
    if (process.platform === 'win32') spawnSync('taskkill', ['/PID', String(child.pid), '/T', '/F'], { stdio: 'ignore' });
    else { try { process.kill(-child.pid); } catch { try { child.kill(); } catch { /* Already gone. */ } } }
  }
  stopAuditBrowsers();
}
process.on('exit', stopAll);
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => { stopAll(); process.exit(130); });

stopAuditBrowsers();
const sitePort = await freePort(), debugPort = await freePort();
const profile = mkdtempSync(join(tmpdir(), 'melodia-audit-'));
const server = spawn(process.execPath, ['server.js'], { cwd: root, env: { ...process.env, PORT: String(sitePort) }, stdio: 'ignore' });
children.push(server);
const browser = spawn(browserPath, ['--headless=new', `--remote-debugging-port=${debugPort}`, `--user-data-dir=${profile}`, '--no-first-run', '--disable-gpu-vsync', 'about:blank'], { stdio: 'ignore', detached: process.platform !== 'win32' });
children.push(browser);

async function until(fn, seconds, label) { for (let i = 0; i < seconds * 4; i++) { try { const v = await fn(); if (v) return v; } catch { /* Not ready yet. */ } await wait(250); } throw new Error('Timed out: ' + label); }
await until(async () => (await fetch(`http://127.0.0.1:${sitePort}/`)).ok, 30, 'site');
const tab = await until(async () => (await (await fetch(`http://127.0.0.1:${debugPort}/json/list`)).json()).find(t => t.type === 'page'), 30, 'browser');
const socket = new WebSocket(tab.webSocketDebuggerUrl);
await new Promise((ok, bad) => { socket.addEventListener('open', ok, { once: true }); socket.addEventListener('error', bad, { once: true }); });
let nextId = 0; const pending = new Map();
socket.addEventListener('message', event => { const m = JSON.parse(event.data); if (m.id && pending.has(m.id)) { const { resolve, reject } = pending.get(m.id); pending.delete(m.id); m.error ? reject(new Error(JSON.stringify(m.error))) : resolve(m.result); } });
const send = (method, params = {}) => new Promise((resolve, reject) => { const id = ++nextId; pending.set(id, { resolve, reject }); socket.send(JSON.stringify({ id, method, params })); });
const evaluate = async expression => { const r = await send('Runtime.evaluate', { expression, returnByValue: true, awaitPromise: true }); if (r.exceptionDetails) throw new Error(JSON.stringify(r.exceptionDetails).slice(0, 400)); return r.result.value; };

// Everything that is measured runs inside the page and returns a list of problems.
const CHECKS = String.raw`(async()=>{
const problems=[];
const visible=e=>{const b=e.getBoundingClientRect(),c=getComputedStyle(e);return b.width>0&&b.height>0&&c.visibility!=='hidden'&&c.display!=='none'};
const label=e=>e.id||e.dataset.info||e.className.toString().split(' ')[0]||e.tagName;
const probe=document.createElement('div');probe.style.cssText='position:fixed;left:-99px;top:0;background:var(--accent);color:var(--on-accent)';document.body.append(probe);
const accent=getComputedStyle(probe).backgroundColor,onAccent=getComputedStyle(probe).color;probe.remove();
const wait=ms=>new Promise(r=>setTimeout(r,ms));

// The cover has the same visual space to the player edge and the track text.
const cover=document.querySelector('.player-left .album'),trackInfo=document.querySelector('.player-left .track-info');
if(cover&&trackInfo&&visible(cover)){
  const a=cover.getBoundingClientRect(),p=document.querySelector('.player').getBoundingClientRect(),t=trackInfo.getBoundingClientRect();
  const left=a.left-p.left,right=t.left-a.right;
  if(Math.abs(left-right)>1)problems.push('cover spacing differs: left '+left.toFixed(1)+' px, right '+right.toFixed(1)+' px');
}

// Phones never show the live feed, even when a notice is pending.
const phoneLayout=document.body.dataset.mobilePlayer==='true'||document.body.dataset.landscapePhone==='true';
const feed=document.querySelector('#globe-status'),homepage=document.querySelector('#station-homepage'),notice=document.querySelector('#player-notice');
if(feed&&homepage&&notice){
  const state=[feed.hidden,homepage.hidden,notice.hidden];
  feed.hidden=false;homepage.hidden=false;notice.hidden=true;
  if(phoneLayout){
    if(visible(feed))problems.push('phone live feed must be hidden');
    notice.hidden=false;
    if(visible(feed))problems.push('phone live feed must stay hidden for notices');
  }else if(!visible(feed)||!visible(homepage)||feed.getBoundingClientRect().width<40)problems.push('desktop live feed is hidden or has no readable space');
  [feed.hidden,homepage.hidden,notice.hidden]=state;
}

// 1. The drawn shape of every icon sits in the middle of its button.
const rotate=document.querySelector('#rotate');
if(document.body.dataset.mobilePlayer==='true'||document.body.dataset.landscapePhone==='true'){
  rotate.click();
  if(rotate.getAttribute('aria-pressed')!=='true'||rotate.title!=='Resume globe rotation')problems.push('phone globe pause does not activate');
  rotate.click();
  if(rotate.getAttribute('aria-pressed')!=='false')problems.push('phone globe rotation does not resume');
  const heart=document.querySelector('#favorite'),old=heart.getAttribute('aria-pressed');heart.setAttribute('aria-pressed','false');
  const a=getComputedStyle(rotate),b=getComputedStyle(heart),rs=rotate.querySelector('svg').getBoundingClientRect(),hs=heart.querySelector('svg').getBoundingClientRect();
  if(a.color!==b.color||a.opacity!=='1'||rs.width!==hs.width||rs.height!==hs.height)problems.push('globe pause icon must match the unselected heart color, opacity and size');
  heart.setAttribute('aria-pressed',old);
}
const canvasCache=new Map();
async function optical(svg){
  const key=svg.outerHTML;if(canvasCache.has(key))return canvasCache.get(key);
  const clone=svg.cloneNode(true);clone.setAttribute('width','384');clone.setAttribute('height','384');clone.setAttribute('xmlns','http://www.w3.org/2000/svg');clone.removeAttribute('class');clone.removeAttribute('style');
  const xml=new XMLSerializer().serializeToString(clone).replace(/currentColor/g,'#000');
  const img=new Image();await new Promise((ok,bad)=>{img.onload=ok;img.onerror=bad;img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(xml)});
  const c=document.createElement('canvas');c.width=384;c.height=384;const g=c.getContext('2d');g.drawImage(img,0,0);const d=g.getImageData(0,0,384,384).data;
  let sx=0,sy=0,sw=0,minx=1e9,maxx=-1,miny=1e9,maxy=-1;
  for(let y=0;y<384;y++)for(let x=0;x<384;x++){const a=d[(y*384+x)*4+3];if(a>20){sw+=a;sx+=a*x;sy+=a*y;minx=Math.min(minx,x);maxx=Math.max(maxx,x);miny=Math.min(miny,y);maxy=Math.max(maxy,y)}}
  const vb=svg.viewBox.baseVal,u=384/vb.width;
  // The drawn shape (its box) must be in the middle: this is what the eye checks first, and the icons were measured high or low by it.
  const result=sw?{x:((minx+maxx+1)/2-192)/u,y:((miny+maxy+1)/2-192)/u}:{x:0,y:0};
  canvasCache.set(key,result);return result;
}
for(const button of document.querySelectorAll('header button, .player button, .mobile-tools button, .mobile-player-bottom button')){
  // The Play triangle is centred by its centroid on purpose, so it is the one exception.
  if(!visible(button)||button.id==='play')continue;const svg=[...button.children].find(c=>c.tagName==='svg');if(!svg||button.textContent.trim()||!svg.viewBox.baseVal.width)continue;
  const o=await optical(svg),b=button.getBoundingClientRect(),s=svg.getBoundingClientRect(),scale=s.width/svg.viewBox.baseVal.width;
  const dx=s.left+s.width/2+o.x*scale-(b.left+b.width/2),dy=s.top+s.height/2+o.y*scale-(b.top+b.height/2);
  if(Math.abs(dx)>.8||Math.abs(dy)>.8)problems.push('icon not centred in '+label(button)+': '+dx.toFixed(2)+', '+dy.toFixed(2)+' px');
}

// 2. Pressed or open buttons look like Play.
for(const [selector,attribute] of [['#mobile-info','aria-expanded'],['#share','aria-expanded'],['#reduce-effects','aria-pressed'],['#catalog-toggle','aria-expanded'],['#favorites','aria-expanded']]){
  const e=document.querySelector(selector);if(!e||!visible(e))continue;
  const old=e.getAttribute(attribute);e.setAttribute(attribute,'true');await wait(30);
  const c=getComputedStyle(e);
  if(c.backgroundColor!==accent||c.color!==onAccent)problems.push('pressed '+selector+' is not the Play look: bg '+c.backgroundColor+' color '+c.color);
  if(old===null)e.removeAttribute(attribute);else e.setAttribute(attribute,old);
}
const heart=document.querySelector('#favorite');
if(heart&&visible(heart)){const old=heart.getAttribute('aria-pressed');heart.setAttribute('aria-pressed','true');await wait(30);
  if(getComputedStyle(heart).color!=='rgb(220, 53, 69)')problems.push('favorite heart is not red when added: '+getComputedStyle(heart).color);
  heart.setAttribute('aria-pressed',old);}

// 3. The heart and the tools in the phone bottom row are separated by equal gaps.
const row=[...document.querySelectorAll('.mobile-player-bottom #favorite, .mobile-tools button')].filter(visible).map(e=>e.getBoundingClientRect());
if(row.length>2){const gaps=row.slice(1).map((b,i)=>b.left-row[i].right);if(Math.max(...gaps)-Math.min(...gaps)>.6)problems.push('uneven gaps in the bottom row: '+gaps.map(g=>g.toFixed(1)).join(', '));}

// 4. Dialogs: the title is on the row of the X, text and divider fit.
async function openDialog(name,open,selector){
  document.querySelectorAll('dialog[open]').forEach(d=>d.close());
  try{open();}catch(e){problems.push(name+' could not be opened: '+e.message);return}
  await wait(400);const d=document.querySelector(selector+'[open]');if(!d){problems.push(name+' did not open');return}
  const x=d.querySelector('.dialog-close'),h=[...d.querySelectorAll('h2')].find(visible);
  if(x&&h){const xb=x.getBoundingClientRect(),hb=h.getBoundingClientRect();const dy=(hb.top+hb.height/2)-(xb.top+xb.height/2);if(Math.abs(dy)>1.5)problems.push(name+' title is '+dy.toFixed(1)+' px off the X row')}
  if(d.scrollWidth>d.clientWidth+1)problems.push(name+' scrolls sideways');
  const phoneTabs=[...d.querySelectorAll('.info-tabs button')].filter(visible);
  const sideways=matchMedia('(orientation:landscape) and (max-height:500px)').matches;
  if(name==='info'&&phoneTabs.length&&x&&(innerWidth<=760||sideways)){
    const xr=x.getBoundingClientRect(),xcy=xr.top+xr.height/2,tab=k=>d.querySelector('.info-tabs [data-info='+k+']').getBoundingClientRect();
    for(const k of ['about','privacy','requests']){const r=tab(k);if(Math.abs(r.top+r.height/2-xcy)>2)problems.push('info tab '+k+' is not on the row of the X');}
    if(Math.abs(tab('about').height-xr.height)>1)problems.push('info tabs are not as high as the X button');
    const c=tab('credits'),a=tab('about');
    if(sideways){if(Math.abs(c.top+c.height/2-xcy)>2)problems.push('Sources & Credits tab is not on the row of the X');}
    else if(c.top<a.bottom-1)problems.push('Sources & Credits should be on the second row');
  }
  for(const b of d.querySelectorAll('.copy-button, #copy-link, #embed-toggle'))if(visible(b)){const r=getComputedStyle(b);if(r.borderTopWidth!=='1px'||parseFloat(r.height)<39.5)problems.push(name+' button '+label(b)+' differs: '+r.height)}
  for(const b of d.querySelectorAll('.copy-button, #copy-link, #embed-toggle'))if(visible(b)){const wide=Math.min(260,b.parentElement.clientWidth),w=b.getBoundingClientRect().width;if(Math.abs(w-wide)>1.5)problems.push(name+' button '+label(b)+' is '+w.toFixed(0)+' px wide, expected '+wide.toFixed(0)+' px (the QR code width)')}
}
const infoOpener=document.querySelector('#mobile-info')&&visible(document.querySelector('#mobile-info'))?document.querySelector('#mobile-info'):document.querySelector('footer [data-info=about]');
await openDialog('info',()=>infoOpener.click(),'#info-dialog');
await wait(200);
const skyCanvas=document.querySelector('#info-dialog .dialog-sky');
let lostSkyContexts=0;
skyCanvas?.addEventListener('webglcontextlost',()=>lostSkyContexts++);
for(let cycle=0;cycle<5;cycle++){
  document.querySelector('#info-dialog').close();await wait(400);infoOpener.click();await wait(400);
  if(skyCanvas&&document.querySelector('#info-dialog .dialog-sky')!==skyCanvas)problems.push('About recreated its WebGL canvas');
}
if(lostSkyContexts)problems.push('About lost '+lostSkyContexts+' WebGL contexts during reopening');
const divider=document.querySelector('.about-support-divider'),coffee=document.querySelector('#about-coffee'),copyright=document.querySelector('.info-copyright');
if(divider&&coffee&&copyright){
  const a=divider.getBoundingClientRect(),b=coffee.getBoundingClientRect(),c=copyright.getBoundingClientRect();
  const offset=(b.top+b.bottom)/2-(a.bottom+c.top)/2;
  if(Math.abs(offset)>1)problems.push('About coffee button is '+offset.toFixed(1)+' px off the midpoint between divider and copyright');
  if(copyright.textContent!=='© '+new Date().getFullYear()+' melodia.lol All rights reserved.')problems.push('About copyright text differs');
}
await openDialog('share',()=>document.querySelector('#share').click(),'#share-dialog');
await openDialog('artist',()=>{const b=document.querySelector('#station-info');b.disabled=false;b.click()},'#station-dialog');
const artistDialog=document.querySelector('#station-dialog'),lastFact=document.querySelector('#station-facts p:last-child'),copyTrack=document.querySelector('#copy-stream');
if(lastFact&&copyTrack){
  artistDialog.scrollTop=0;
  const a=lastFact.getBoundingClientRect(),b=copyTrack.getBoundingClientRect(),d=artistDialog.getBoundingClientRect();
  const bottom=Math.max(d.bottom-parseFloat(getComputedStyle(artistDialog).borderBottomWidth||0),d.top+artistDialog.scrollHeight);
  const offset=(b.top+b.bottom)/2-(a.bottom+bottom)/2;
  if(Math.abs(offset)>1.5)problems.push('artist copy button is '+offset.toFixed(1)+' px off the midpoint between last fact and bottom');
}
await openDialog('favorites',()=>{const b=document.querySelector('#favorites-share');b.removeAttribute('hidden');b.click()},'#favorites-dialog');
const actions=document.querySelector('#favorites-download').closest('.fav-actions'),qr=document.querySelector('#favorites-qr'),note=document.querySelector('#favorites-qr-note');
if(!visible(qr))problems.push('favorites QR code is missing');
else if(actions.getBoundingClientRect().bottom>qr.getBoundingClientRect().top||qr.getBoundingClientRect().bottom>note.getBoundingClientRect().top)problems.push('favorites order must be actions, QR code, scanning instructions');
document.querySelectorAll('dialog[open]').forEach(d=>d.close());

// Pressing Info or Share again closes the window it opened (where the window is not modal, so the button can be pressed).
for(const [selector,dialogId,applies] of [['#mobile-info','#info-dialog',true],['#share','#share-dialog',matchMedia('(max-width:1024px)').matches]]){
  const button=document.querySelector(selector),target=document.querySelector(dialogId);
  if(!applies||!button||!visible(button))continue;
  target.close();button.click();await wait(300);const opened=target.open;button.click();await wait(300);
  if(!opened||target.open||button.getAttribute('aria-expanded')!=='false')problems.push(selector+' does not close its window when pressed again');
  target.close();
}

// The Reset button on phones pauses the rotation and shows Play inside the arrow while it is paused.
{const r=document.querySelector('#rotate');
  if(r&&visible(r)&&(innerWidth<=760||matchMedia('(orientation:landscape) and (max-height:500px)').matches)){
    const paused=()=>r.getAttribute('aria-pressed')==='true',play=()=>Boolean(r.querySelector('path[d^="M10.5 8.8"]')),bars=()=>Boolean(r.querySelector('path[d^="M10 9v6"]'));
    if(paused())r.click();await wait(150);
    if(paused()||!bars())problems.push('Reset button should show the pause bars while the globe turns');
    r.click();await wait(150);
    if(!paused()||!play())problems.push('Reset button should show Play inside the arrow while paused');
    r.click();await wait(150);
    if(paused()||!bars())problems.push('Pressing the Reset button again should resume the rotation');
  }}

// 5. No message is painted over the globe.
if(document.querySelector('#world-status'))problems.push('#world-status overlay exists: messages must go to the player line');
return problems})()`;

const LAYOUTS = [['desktop 1440x900', 1440, 900, false], ['tablet 1024x768', 1024, 768, false], ['landscape phone 796x388', 796, 388, true], ['portrait phone 390x844', 390, 844, true]];
await send('Runtime.enable'); await send('Page.enable');
await send('Page.addScriptToEvaluateOnNewDocument', { source: `localStorage.setItem('melodia-favorites',JSON.stringify([{a:'603037',t:'1',n:'Audit song'}]))` });
const failures = []; let checked = 0;
try {
  for (const [name, width, height, mobile] of LAYOUTS) {
    await send('Emulation.setDeviceMetricsOverride', { width, height, deviceScaleFactor: 1, mobile });
    await send('Emulation.setTouchEmulationEnabled', { enabled: mobile });
    await send('Page.navigate', { url: `http://127.0.0.1:${sitePort}/?artist=stm&id=603037&t=${Date.now()}` });
    await until(() => evaluate(`document.body.dataset.loading==='false'`), 90, 'page ' + name);
    await wait(1500);
    for (const mode of ['night', 'day']) {
      await evaluate(`document.body.dataset.mode=${JSON.stringify(mode)}`); await wait(300);
      const problems = await evaluate(CHECKS);
      checked++;
      for (const problem of problems) failures.push(`${name}, ${mode}: ${problem}`);
    }
  }
} finally { stopAll(); try { rmSync(profile, { recursive: true, force: true }); } catch { /* The temporary profile may still be locked. */ } }
console.log(`UI audit: ${checked} layout and mode combinations checked, ${failures.length} problem${failures.length === 1 ? '' : 's'}.`);
for (const failure of failures) console.log('  FAIL ' + failure);
process.exit(failures.length ? 1 : 0);
