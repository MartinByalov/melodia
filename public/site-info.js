const sections={
  about:{title:'About',html:'<p>One planet.<br>Infinite vibes.<br>Discover independent music from artists around the world, save your favorites and explore it on an audio-reactive globe.</p><p class="about-project">Melodia is an independent creative project.<br>Its original concept and visual experience belong to its creator.<br>The music belongs to its artists and is shared under the Creative Commons license shown with each track.</p><span class="about-support-divider" aria-hidden="true"></span><button id="about-coffee" class="coffee-link" type="button"><span class="coffee-cup" aria-hidden="true">♥</span>Buy me a coffee!</button>'},
  credits:{title:'Sources & Credits',html:'<div class="credit-entry"><a class="credit-name" href="https://www.jamendo.com/" target="_blank" rel="noopener noreferrer">Jamendo</a><p>Independent artists, their locations and music, shared under Creative Commons licenses. Audio is delivered by Jamendo.</p></div><div class="credit-entry"><a class="credit-name" href="https://www.geonames.org/" target="_blank" rel="noopener noreferrer">GeoNames</a><p>Place names and coordinates used to locate artists who gave only a city, licensed under CC BY 4.0.</p></div><div class="credit-entry"><a class="credit-name" href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer">© OpenStreetMap contributors</a><p>Local administrative boundaries. The data is licensed under the Open Database License.</p></div><div class="credit-entry"><a class="credit-name" href="https://www.naturalearthdata.com/about/terms-of-use/" target="_blank" rel="noopener noreferrer">Natural Earth</a><p>Public-domain geographic data.</p></div><div class="credit-entry"><span class="credit-name">Three.js</span><p>WebGL rendering, MIT license. <a href="vendor/LICENSE" target="_blank" rel="noopener noreferrer">License</a>.</p></div><div class="credit-entry"><span class="credit-name">qrcode-generator</span><p>QR codes for sharing favorites, MIT license. <a href="vendor/qrcode-LICENSE.txt" target="_blank" rel="noopener noreferrer">License</a>.</p></div>'},
  requests:{title:'Contact',html:'<p>Melodia lists independent artists from Jamendo, where they published their music under Creative Commons licenses. Tracks play directly from Jamendo and Melodia does not host or relay the audio. Artists can change or withdraw their music, location and profile on Jamendo at any time.</p><p>To request a correction or removal, email <a href="mailto:contact@melodia.lol?subject=Melodia%20artist%20request">contact@melodia.lol</a>. Please include:</p><ul><li>The artist name and its Melodia link, including the Jamendo artist ID if you have it.</li><li>What should be corrected or removed, for example a wrong location.</li><li>How we can verify your connection to the artist or the rights at issue. Please do not send sensitive documents.</li></ul><p>The email link opens your email app. Melodia does not send the message for you, so please send it from there.</p><p>We review requests and can remove an artist from Melodia’s catalogue. Removal from Melodia does not remove the artist from Jamendo.</p>'},
  privacy:{title:'Privacy & Favorites',html:'<p>Favorites are saved as songs, and they and your effect preferences are stored in this browser using localStorage. There is no account or cloud backup. Clearing site data removes them, so use Save in Favorites to keep a copy as a file, a link or a QR code. A link or QR code contains only song numbers.</p><p>Choosing an artist asks Jamendo for their tracks and picture, and listening connects directly to Jamendo’s servers. These services can receive your IP address and request information.</p><p>Sharing opens the selected external service. Embed previews load another instance of melodia. Audio analysis runs locally in your browser.</p><p>Hosting and third-party services may keep their own request logs. This notice describes the current app. It does not describe their separate policies.</p><p>Artists and rights holders can request a correction or removal under <button type="button" class="text-link" data-info="requests">Contact</button>.</p>'}
};

export function openSiteDialog(dialog){
  for(const other of document.querySelectorAll('#info-dialog,#share-dialog,#station-dialog,#favorites-dialog')){
    if(other!==dialog&&other.open)other.close();
  }
  if(dialog.open)return;
  if(matchMedia('(max-width:1024px), (max-width:1366px) and (pointer:coarse)').matches)dialog.show();
  else dialog.showModal();
}

export function setupSiteInfo(globe){
  const dialog=document.querySelector('#info-dialog'),content=document.querySelector('#info-content'),title=document.querySelector('#info-title');
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
    document.querySelectorAll('button[data-reduce-effects]').forEach(button=>{
      const label=effective?'Effects reduced':'Reduce effects';
      button.setAttribute('aria-pressed',String(effective));
      if('iconOnly' in button.dataset){button.title=label;button.setAttribute('aria-label',label);}else button.textContent=label;
    });
  }
  apply();media.addEventListener('change',apply);
  document.addEventListener('keydown',event=>{
    if(event.key!=='Escape')return;
    for(const open of document.querySelectorAll('#info-dialog[open],#share-dialog[open],#station-dialog[open],#favorites-dialog[open]'))open.close();
  });
  document.addEventListener('click',event=>{
    const opener=event.target.closest('[data-info]');
    if(opener){
      const section=sections[opener.dataset.info];if(!section)return;
      dialog.setAttribute('aria-label',section.title);title.textContent=section.title;content.innerHTML=section.html;
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
    if(event.target.closest('#about-coffee'))window.open('https://ko-fi.com/eon','_blank','noopener,noreferrer');
  });
}