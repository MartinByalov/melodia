const sections={
  about:{title:'About',html:'<p>One planet.<br>Infinite vibes.<br>Discover live radio around the world, save your favorites and explore music through an audio-reactive globe.</p><p class="about-project">Melodia is an independent creative project.<br>Its original concept and visual experience belong to its creator.<br>Radio broadcasts and third-party assets belong to their respective owners.</p><span class="about-support-divider" aria-hidden="true"></span><button id="about-coffee" class="coffee-link" type="button"><span class="coffee-cup" aria-hidden="true">♥</span>Buy me a coffee!</button>'},
  credits:{title:'Sources & Credits',html:'<div class="credit-entry"><a class="credit-name" href="https://www.radio-browser.info/" target="_blank" rel="noopener noreferrer">Radio Browser</a><p>Community-maintained station directory. Audio is delivered by individual broadcasters.</p></div><div class="credit-entry"><a class="credit-name" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a><p>Local administrative boundaries via Overpass. The data is licensed under the Open Database License.</p></div><div class="credit-entry"><a class="credit-name" href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener noreferrer">Natural Earth</a><p>Public-domain geographic data.</p></div><div class="credit-entry"><span class="credit-name">Three.js</span><p>WebGL rendering, MIT license. <a href="vendor/LICENSE" target="_blank" rel="noopener noreferrer">License</a>.</p></div><div class="credit-entry"><span class="credit-name">HLS.js</span><p>Streaming playback, Apache-2.0. <a href="vendor/hls-LICENSE.txt" target="_blank" rel="noopener noreferrer">License</a>.</p></div>'},
  privacy:{title:'Privacy & Favorites',html:'<p>Favorites and effect preferences are stored in this browser using localStorage. There is no account or cloud backup. Clearing site data removes these preferences.</p><p>Loading the directory and map boundaries contacts Radio Browser and Overpass. Listening connects directly to the broadcaster and its CDN. These services can receive your IP address and request information.</p><p>Sharing opens the selected external service. Embed previews load another instance of melodia. Audio analysis runs locally in your browser.</p><p>Hosting and third-party services may keep their own request logs. This notice describes the current app. It does not describe their separate policies.</p><p>Broadcasters and rights holders can <a href="broadcasters.html">report a station</a> for correction or removal using their email app.</p>'}
};

export function openSiteDialog(dialog){
  for(const other of document.querySelectorAll('#info-dialog,#share-dialog,#station-dialog')){
    if(other!==dialog&&other.open)other.close();
  }
  if(dialog.open)return;
  if(matchMedia('(max-width:1024px), (max-width:1366px) and (pointer:coarse)').matches)dialog.show();
  else dialog.showModal();
}

export function setupSiteInfo(globe){
  const dialog=document.querySelector('#info-dialog'),content=document.querySelector('#info-content');
  const mobileInfo=document.querySelector('#mobile-info');
  dialog.addEventListener('close',()=>mobileInfo.setAttribute('aria-expanded',String(dialog.open)));
  const copyright=document.createElement('p');copyright.className='info-copyright';copyright.hidden=true;
  copyright.textContent=`© ${new Date().getFullYear()} melodia.lol. All rights reserved.`;dialog.append(copyright);
  document.querySelector('#copyright-year').textContent=new Date().getFullYear();
  const media=matchMedia('(prefers-reduced-motion: reduce)');
  let reduced=false;
  try{reduced=localStorage.getItem('melodia-reduce-effects')==='true';}catch{/* Optional storage. */}
  function apply(){
    const effective=reduced||media.matches;
    document.body.dataset.reduceEffects=String(effective);globe?.setReducedEffects(effective);
    document.querySelectorAll('button[data-reduce-effects]').forEach(button=>{button.setAttribute('aria-pressed',String(effective));button.textContent=effective?'Effects reduced':'Reduce effects';});
  }
  apply();media.addEventListener('change',apply);
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    for(const open of document.querySelectorAll('#info-dialog[open],#share-dialog[open],#station-dialog[open]'))open.close();
  });
  document.addEventListener('click',event=>{
    const opener=event.target.closest('[data-info]');
    if(opener){
      const section=sections[opener.dataset.info];if(!section)return;
      dialog.setAttribute('aria-label',section.title);content.innerHTML=section.html;
      content.dataset.section=opener.dataset.info;
      dialog.querySelectorAll('.info-tabs button[data-info]').forEach(button=>{
        button.setAttribute('aria-pressed',String(button.dataset.info===opener.dataset.info));
      });
      if(opener.dataset.info==='about'){
        const support=document.createElement('div');support.className='about-support';
        support.append(content.querySelector('#about-coffee'));content.append(support);
      }
      copyright.hidden=opener.dataset.info!=='about';
      openSiteDialog(dialog);
      mobileInfo.setAttribute('aria-expanded',String(dialog.open));
    }
    if(event.target.closest('button[data-reduce-effects]')){
      reduced=!reduced;try{localStorage.setItem('melodia-reduce-effects',String(reduced));}catch{/* Optional storage. */}apply();
    }
    if(event.target.closest('#about-coffee'))document.querySelector('#help').click();
  });
}