import { createGlobe } from './globe.js';
import { createThemeFavicon } from './favicon.js';
import { StationRhythm } from './station-rhythm.js';
import { wavePath } from './player-wave.js';
import { AudioReactivity } from './audio-reactivity.js';
import { stationTheme } from './station-theme.js';
import { createCountryMenu } from './country-menu.js';
import { favoriteStyles, STYLE_LABELS } from './favorite-styles.js';
import { embedCode, embedUrl } from './embed.js';
import { loadInitialStations, apiRequest, normalizeStation, genreOf, matchesStation, supportsHLS, supportsNativeHLS } from './radio.js';
import { createHLSPlayback } from './hls-playback.js';
import { startupStation } from './startup-station.js';
import {visualProfile} from './visual-styles.js';
import {setupSiteInfo,openSiteDialog} from './site-info.js';

const $ = selector => document.querySelector(selector);
const themeFavicon=createThemeFavicon($('#theme-favicon'));
themeFavicon.update('#62efc5');
window.addEventListener('pagehide',()=>themeFavicon.dispose());
$('#genre-filter').replaceChildren(...Object.entries(STYLE_LABELS).sort(([a,labelA],[b,labelB])=>a==='all'?-1:b==='all'?1:labelA.localeCompare(labelB,'en')).map(([value,label])=>{const option=document.createElement('option');option.value=value;option.textContent=value==='all'?'All styles':label;return option;}));
document.body.dataset.embed=String(new URL(location.href).searchParams.get('embed')==='1');
if(document.body.dataset.embed==='true'){
  const player=$('.player'),top=document.createElement('div'),bottom=document.createElement('div');
  top.className='embed-player-top';bottom.className='embed-player-bottom';
  top.append($('#rotate'),$('#previous'),$('#play'),$('#next'),$('.volume'));
  bottom.append($('.player-left'),$('#share'));
  player.append(top,bottom,$('#globe-status'));
  $('#embed-toggle').hidden=true;
  $('#mute').addEventListener('click',()=>$('.volume').classList.toggle('volume-open'));
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('.volume'))$('.volume').classList.remove('volume-open');});
}
// Track the actual responsive player height, rather than duplicating layout sizes.
if(document.body.dataset.embed!=='true'){
  const mobile=matchMedia('(max-width:760px)'),player=$('.player'),controls=$('.play-controls'),right=$('.player-right'),left=$('.player-left'),header=$('header'),headerRight=$('.header-right'),genres=$('.header-genres');
  const row=document.createElement('div'),actions=document.createElement('div'),top=document.createElement('div'),bottom=document.createElement('div');
  row.className='mobile-header-row';actions.className='header-right mobile-header-actions';top.className='mobile-player-top';bottom.className='mobile-player-bottom';
  const searchRow=document.createElement('div'),searchBox=$('.search-box');
  searchRow.className='mobile-search-row';searchBox.before(searchRow);searchRow.append(searchBox);
  function layout(){
    document.body.dataset.mobilePlayer=String(mobile.matches);
    if(mobile.matches){
      row.append(genres,actions);actions.append($('#catalog-toggle'));header.append(row);
      row.prepend($('.brand'));
      top.append($('#rotate'),$('#previous'),$('#play'),$('#next'),$('.volume'));
      searchRow.prepend($('#favorites'));
      bottom.append(left,$('#favorite'),$('#mode-toggle'),$('#share'),$('#mobile-info'));player.append(top,bottom,$('#globe-status'));
    }else{
      header.prepend($('.brand')||row.querySelector('.brand'));
      header.insertBefore(genres,headerRight);headerRight.prepend($('#catalog-toggle'),$('#favorites'),$('#mode-toggle'));row.remove();
      controls.append($('#favorite'),$('#previous'),$('#play'),$('#next'),$('#rotate'));
      right.append($('#globe-status'),$('.volume'),$('#share'));$('footer').after($('#mobile-info'));player.prepend(left);top.remove();bottom.remove();
    }
  }
  mobile.addEventListener('change',layout);layout();
  function fitGenres(){
    const buttons=[...genres.querySelectorAll('button')];
    for(const button of buttons)button.hidden=false;
    if(!mobile.matches)return;
    const gap=parseFloat(getComputedStyle(genres).gap)||0,available=genres.clientWidth;
    let used=0,full=false;
    for(const button of buttons){
      const width=button.getBoundingClientRect().width,next=used+(used?gap:0)+width;
      if(full||next>available){button.hidden=true;full=true;}else used=next;
    }
  }
  const genreResizeObserver=new ResizeObserver(fitGenres);genreResizeObserver.observe(genres);
  const genreMutationObserver=new MutationObserver(fitGenres);genreMutationObserver.observe(genres,{childList:true});
  mobile.addEventListener('change',fitGenres);document.fonts.ready.then(fitGenres);
  $('#mute').addEventListener('click',()=>{if(mobile.matches)$('.volume').classList.toggle('volume-open');});
  document.addEventListener('pointerdown',event=>{if(!event.target.closest('.volume'))$('.volume').classList.remove('volume-open');});
}
function measurePlayer(){
  const rect=$('.player').getBoundingClientRect(),height=rect.height;
  document.documentElement.style.setProperty('--player-half-height',`${height/2}px`);
  document.documentElement.style.setProperty('--embed-player-height',`${height}px`);
  document.documentElement.style.setProperty('--menu-player-offset',`${Math.max(0,innerHeight-rect.top)}px`);
}
const playerHeightObserver=new ResizeObserver(measurePlayer);
playerHeightObserver.observe($('.player'));
window.addEventListener('resize',measurePlayer);
let nowPlaying='',playerMessage='';
$('#globe').addEventListener('themeaccent',event=>{
  const color=event.detail.color,hex=color.slice(1);
  themeFavicon.update(color,true);
  const channels=[0,2,4].map(offset=>parseInt(hex.slice(offset,offset+2),16));
  document.documentElement.style.setProperty('--accent',color);
  document.documentElement.style.setProperty('--accent-rgb',channels.join(','));
  document.documentElement.style.setProperty('--bg','#'+channels.map(value=>Math.round(6+value*.045).toString(16).padStart(2,'0')).join(''));
});
function setPlayerMessage(text){
  playerMessage=text;
  const label=playerMessage||nowPlaying;
  $('#player-message').textContent=label;
  $('#globe-status').hidden=!label;
}
const countryMenu=createCountryMenu($('#country-filter'),$('#catalog'));
const stationRhythm = new StationRhythm();
function openCatalog(open = true) {
  if(!open&&favoriteRemovalMode){setFavoriteRemovalMode(false);renderList();}
  $('#catalog').hidden = !open;
  document.body.dataset.catalogOpen=String(open);
  $('#catalog-toggle').setAttribute('aria-expanded', String(open&&!favoritesOnly));
  $('#favorites').setAttribute('aria-expanded', String(open&&favoritesOnly));
}
function showDirectory(favorites){
  if(favoritesOnly!==favorites){
    $('#search').value='';$('#country-filter').value='';countryMenu.sync();countryMenu.close();
  }
  favoritesOnly=favorites;
  document.body.dataset.favoritesOnly=String(favorites);
  setFavoriteRemovalMode(false);
  $('#favorites').classList.toggle('active',favorites);
  $('#explore').classList.toggle('active',!favorites);
  $('#list-title').textContent=favorites?'Your rhythm':'On the world stage';
  renderList();
}
let favoriteRemovalMode=false;
function setFavoriteRemovalMode(enabled){
  favoriteRemovalMode=enabled&&favoritesOnly;
  const button=$('#favorite-edit');
  button.hidden=!favoritesOnly;
  button.setAttribute('aria-pressed',String(favoriteRemovalMode));
  const label=favoriteRemovalMode?'Finish removing favorites':'Remove favorites';
  button.setAttribute('aria-label',label);button.title=label;
}
$('#favorite-edit').addEventListener('click',()=>{setFavoriteRemovalMode(!favoriteRemovalMode);renderList();});
function saveFavorites(){
  try { localStorage.setItem('worldjam-favorites', JSON.stringify([...favoriteIds])); } catch { toast('This browser cannot save favorites.'); }
}
$('#catalog-toggle').addEventListener('click', () => {
  const open=$('#catalog').hidden||favoritesOnly;
  showDirectory(false);openCatalog(open);
  if(open)$('#search').focus();
});
$('#catalog-close').addEventListener('click', () => openCatalog(false));
$('#favorites').addEventListener('click', () => {
  const open=$('#catalog').hidden||!favoritesOnly;
  showDirectory(true);openCatalog(open);
});
setInterval(() => { if (document.hidden) stationRhythm.sync([]); else stationRhythm.sync(globe?.getVisibleStations() || []); }, 5000);
document.addEventListener('visibilitychange', () => { if (document.hidden) stationRhythm.sync([]); });
window.addEventListener('pagehide', () => stationRhythm.disable());
const themes = {
  electronic: ['#62efc5', '98,239,197', 'NEON NIGHTS', '#080b14'],
  jazz: ['#efbc77', '239,188,119', 'GOLDEN HOUR', '#120e12'],
  rock: ['#f47d95', '244,125,149', 'ELECTRIC SOUL', '#130b15'],
  chill: ['#8bbdfb', '139,189,251', 'SLOW ORBIT', '#09101b'],
  pop: ['#cd9af6', '205,154,246', 'COLOR WAVES', '#100b1b'],
  classical: ['#dfd4af', '223,212,175', 'CELESTIAL HARMONY', '#111313']
};
let stations = [], filtered = [], selected = null, genre = 'all', favoritesOnly = false, audio = null;
let audioContext = null, analyser = null, bins = null, session = 0, fallback = false, loadingTimer = null;
let muted=false;
function syncVolume(){
  const silent=muted||Number($('#volume').value)===0;
  if(audio){audio.volume=Number($('#volume').value);audio.muted=muted;}
  $('#mute').setAttribute('aria-pressed',String(silent));
  $('#mute').setAttribute('aria-label',silent?'Unmute':'Mute');$('#mute').title=silent?'Unmute':'Mute';
  $('#mute').innerHTML=`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M11 4 6 8H3v8h3l5 4Z"/><path d="${silent?'m16 9 5 6m0-6-5 6':'M15 8a6 6 0 0 1 0 8M18 5a10 10 0 0 1 0 14'}"/></svg>`;
}
let favoriteIds;
try { const stored = JSON.parse(localStorage.getItem('worldjam-favorites') || '[]'); favoriteIds = new Set(Array.isArray(stored) ? stored.filter(x => typeof x === 'string') : []); } catch { favoriteIds = new Set(); }
let globe;
try { globe = createGlobe($('#globe'), s => choose(s)); } catch (e) { console.error(e); setPlayerMessage('3D view is unavailable. Listen from the station list.'); }
let displayMode='night';
setupSiteInfo(globe);
const modeToggle=$('#mode-toggle');
if(!modeToggle)throw new Error('Missing required #mode-toggle button in index.html');
function applyMode(){
  document.body.dataset.mode=displayMode;globe?.setMode(displayMode);
  modeToggle.innerHTML=`<svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${displayMode==='day'?'<path d="M20.5 14.2A8.5 8.5 0 0 1 9.8 3.5a8.5 8.5 0 1 0 10.7 10.7Z"/>':'<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M4.9 4.9l1.4 1.4m11.4 11.4 1.4 1.4M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'}</svg>`;
  modeToggle.setAttribute('aria-pressed',String(displayMode==='day'));
  modeToggle.setAttribute('aria-label',displayMode==='day'?'Switch to night mode':'Switch to day mode');
  document.querySelector('meta[name="theme-color"]').content=displayMode==='day'?'#f3f6fa':'#080b14';
}
modeToggle.addEventListener('click',()=>{displayMode=displayMode==='day'?'night':'day';applyMode();});
applyMode();
// All notifications share the player line; never show floating labels above it.
function toast(text) { setPlayerMessage(text); }
function setTheme(s) {
  // Filters must not overwrite the identity of the currently selected station.
  const station=s.id?s:selected;
  const key = genreOf((station||s).tags);
  const palette=station?stationTheme(station.id):{color:themes[key][0],rgb:themes[key][1],bg:themes[key][3]};
  const {color,rgb,bg}=palette;
  themeFavicon.update(color);
  document.body.dataset.theme = key;
  document.body.dataset.stationColor=station?color:'';
  document.documentElement.style.setProperty('--accent', color);
  document.documentElement.style.setProperty('--accent-rgb', rgb);
  document.documentElement.style.setProperty('--bg', bg);
  globe?.setColor(color);
  globe?.setVisualProfile(visualProfile((station||s).tags));
  $('#album').style.background = '#162736';
}
function updateFavorites() {
  updateHeaderStyles();
  $('#fav-count').textContent = favoriteIds.size;
  const favorite = selected && favoriteIds.has(selected.id);
  $('#favorite').innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="${favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>`;
  $('#favorite').setAttribute('aria-pressed', String(!!favorite));
  const label=favorite?'Remove from favorites':'Add to favorites';
  $('#favorite').title=label;$('#favorite').setAttribute('aria-label',label);
}
function renderList(limit = 100) {
  if (typeof limit !== 'number') limit=100;
  filtered = stations.filter(s => matchesStation(s, $('#search').value.trim(), genre,favoritesOnly) && (!$('#country-filter').value || s.country === $('#country-filter').value) && (!favoritesOnly || favoriteIds.has(s.id)));
  $('#result-count').textContent = `${filtered.length} STATIONS`;
  $('#directory-count').textContent=`${stations.length.toLocaleString('en-US')} stations`;
  const list = $('#stations'); list.replaceChildren();
  if (!filtered.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = favoritesOnly ? favoriteIds.size?'No favorites match these filters. Try another style or clear filters.':'No favorites yet. Choose a station and press ♡.' : 'No matching stations. Try another genre or country.'; list.append(empty); }
  for (const s of filtered.slice(0, limit)) {
    const row = document.createElement('button'); row.className = `station-row${selected?.id === s.id ? ' active' : ''}`; row.setAttribute('aria-label', `Listen to ${s.name}, ${s.country}`); row.dataset.id = s.id;
    const palette=stationTheme(s.id);
    const art = document.createElement('span'); art.className = 'station-art'; art.style.setProperty('--station-color',palette.color);art.style.setProperty('--station-rgb',palette.rgb); art.textContent = s.name.slice(0,1).toUpperCase();
    const text = document.createElement('span'); text.className = 'station-text';
    const name = document.createElement('strong'); name.textContent = s.name;
    const location = document.createElement('small'); location.textContent = `${s.state || s.country} · ${genreOf(s.tags)}${s.bitrate ? ` · ${s.bitrate}k` : ''}`;
    text.append(name, location);
    row.append(art, text); row.addEventListener('click', () => choose(s));
    if(favoritesOnly&&favoriteRemovalMode){
      const item=document.createElement('div');item.className='favorite-edit-row';
      const remove=document.createElement('button');remove.type='button';remove.className='favorite-remove';remove.textContent='×';
      remove.setAttribute('aria-label',`Remove ${s.name} from favorites`);remove.title=`Remove ${s.name} from favorites`;
      remove.addEventListener('click',()=>{
        const scrollTop=list.scrollTop;
        favoriteIds.delete(s.id);saveFavorites();updateFavorites();renderList(limit);list.scrollTop=scrollTop;
        const remaining=list.querySelector('.favorite-remove');
        if(remaining)remaining.focus({preventScroll:true});else $('#favorite-edit').focus({preventScroll:true});
      });
      item.append(row,remove);list.append(item);
    }else list.append(row);
  }
  if (filtered.length > limit) { const more = document.createElement('button'); more.className = 'load-more'; more.textContent = `Show more · ${limit.toLocaleString('en-US')} of ${filtered.length.toLocaleString('en-US')}`; more.addEventListener('click',()=>{const scrollTop=list.scrollTop;renderList(limit+100);list.scrollTop=scrollTop;});list.append(more); }
  // Directory filters must not recolor or remove the other genres on the globe.
  if (renderList.mappedStations !== stations || renderList.mappedCount !== stations.length) {
    globe?.setStations(stations);
    renderList.mappedStations=stations;renderList.mappedCount=stations.length;
  }
}
function updatePlayerState(state) {
  const playing = state === 'playing';
  if(playing&&document.body.dataset.loading!=='true')setPlayerMessage('');
  $('#play').title=playing?'Pause':'Play';
  globe?.setPlaying(playing);
  document.body.dataset.playing=String(playing);
  document.body.dataset.playerState=state;
  $('#play').innerHTML = playing ? '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM14 5h4v14h-4z"/></svg>' : '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M8 4 20 12 8 20Z"/></svg>'; $('#play').setAttribute('aria-label', playing ? 'Pause' : 'Play radio');
  $('#play-status').textContent = { playing: 'LIVE', loading: 'CONNECTING…', paused: 'PAUSED', error: 'STREAM UNAVAILABLE', ready: 'STATION SELECTED' }[state] || 'READY TO EXPLORE';
}
const audioReactivity=new AudioReactivity();
const hlsPlayback=createHLSPlayback();
let audioPreparation=Promise.resolve(true);
let audioNeedsPreparation=false;
window.addEventListener('pagehide',()=>resetAudio());
function resetAudio() {
  clearTimeout(loadingTimer);
  hlsPlayback.destroy();
  audioPreparation=Promise.resolve(false);
  audioNeedsPreparation=false;
  if (audio) { audio.pause(); audio.removeAttribute('src'); audio.load(); audio = null; }
  if (audioContext) { audioContext.close().catch(() => {}); audioContext = null; }
  analyser = null; bins = null;
  audioReactivity.reset();globe?.setAudioReaction({available:false,signal:0});
}
const streamsWithoutAnalysis=new Set();
let audioGestureReceived=false;
function prepareAudioAnalysis(){
  if(!audioGestureReceived||!audio?.crossOrigin||audioContext||!(window.AudioContext||window.webkitAudioContext))return;
  try{
    audioContext=new (window.AudioContext||window.webkitAudioContext)();
    const source=audioContext.createMediaElementSource(audio);analyser=audioContext.createAnalyser();analyser.fftSize=1024;analyser.smoothingTimeConstant=.35;
    source.connect(analyser);analyser.connect(audioContext.destination);bins=new Uint8Array(analyser.frequencyBinCount);
    if(audioContext.state==='suspended')audioContext.resume().catch(()=>{});
  }catch{analyser=null;bins=null;}
}
for(const type of ['click','keydown'])document.addEventListener(type,event=>{
  if(!event.isTrusted)return;
  audioGestureReceived=true;prepareAudioAnalysis();
  if(audioContext?.state==='suspended')audioContext.resume().catch(()=>{});
},{capture:true});
function createAudio(useCors, token) {
  useCors=useCors&&!streamsWithoutAnalysis.has(selected.url);
  resetAudio();
  const element = new Audio(); audio = element;
  syncVolume();
  element.preload = 'none'; element.volume = Number($('#volume').value);
  if (useCors) element.crossOrigin = 'anonymous';
  const useHLS=selected.hls&&!supportsNativeHLS();
  audioNeedsPreparation=useHLS;
  if(!useHLS)element.src = selected.url;
  prepareAudioAnalysis();
  element.addEventListener('playing', () => { if (token !== session || audio !== element) return; clearTimeout(loadingTimer); updatePlayerState('playing'); });
  element.addEventListener('pause', () => { if (token === session && audio === element) updatePlayerState('paused'); });
  element.addEventListener('waiting', () => { if (token === session && audio === element) updatePlayerState('loading'); });
  element.addEventListener('ended', () => { if (token === session && audio === element) updatePlayerState('paused'); });
  element.addEventListener('error', () => {
    if (token !== session || audio !== element) return;
    if (useCors && !fallback && !useHLS) {
      streamsWithoutAnalysis.add(element.src);
      fallback = true; createAudio(false, token); playCurrent(token);
    } else { clearTimeout(loadingTimer); updatePlayerState('error'); toast('This stream cannot be played. Try another station.'); }
  });
  loadingTimer = setTimeout(() => { if (token === session && audio?.readyState < 3) { updatePlayerState('error'); toast('The station is taking too long. Try again or choose another.'); } }, 20000);
  audioPreparation=useHLS?hlsPlayback.attach(element,selected.url,()=>{
    if(token!==session||audio!==element)return;
    clearTimeout(loadingTimer);element.pause();updatePlayerState('error');
    toast('This HLS stream cannot be played. Try another station.');
  },song=>{
    if(token!==session||audio!==element)return;
    nowPlaying=song.label;setPlayerMessage(playerMessage);
  }).catch(()=>{
    if(token===session&&audio===element){clearTimeout(loadingTimer);updatePlayerState('error');toast('This HLS stream cannot be played. Try another station.');}
    return false;
  }):Promise.resolve(true);
}
async function playCurrent(token = session) {
  if (!audio) return;
  const element=audio;
  updatePlayerState('loading');
  try {
    prepareAudioAnalysis();
    if(audioGestureReceived&&audioContext?.state==='suspended')audioContext.resume().catch(()=>{});
    // Ordinary streams must call play() during the click, before an await can
    // consume the browser's transient user activation. HLS needs its media attached first.
    if(audioNeedsPreparation){
      if(!await audioPreparation||token!==session||audio!==element)return;
      if(navigator.userActivation&&!navigator.userActivation.isActive){
        clearTimeout(loadingTimer);updatePlayerState('ready');toast('Press ▶ to allow playback.');return;
      }
    }
    if(token!==session||audio!==element)return;
    await element.play();
  } catch (e) {
    if (token !== session || audio !== element || e.name === 'AbortError') return;
    if (e.name === 'NotAllowedError') { clearTimeout(loadingTimer); updatePlayerState('ready'); toast('Press ▶ to allow playback.'); }
    else if (!fallback && element.crossOrigin && !selected.hls) { streamsWithoutAnalysis.add(element.src); fallback = true; createAudio(false, token); playCurrent(token); }
    else { updatePlayerState('error'); }
  }
}
function choose(s, autoplay = true) {
  nowPlaying='';
  if($('#player-message').textContent==='Choose a station to share.')setPlayerMessage(document.body.dataset.loading==='true'?'Loading World Vibe':'');
  else if(document.body.dataset.loading!=='true')setPlayerMessage('');
  session++; selected = s; fallback = false; resetAudio();
  $('#track-name').textContent = s.name; $('#track-location').textContent = `${s.state ? `${s.state}, ` : ''}${s.country}${s.codec ? ` · ${s.codec}` : ''}`;
  setTheme(s); updateFavorites(); renderList(); globe?.select(s);
  const url = new URL(location.href); url.searchParams.set('station', s.id); history.replaceState(null, '', url);
  updatePlayerState('ready');
  if (autoplay) { createAudio(true, session); playCurrent(); apiRequest(`url/${encodeURIComponent(s.id)}`).catch(() => {}); }
}
let catalogueGeneration=0;
function publishCatalogue(next){
  stations=next;
  if(selected&&!stations.some(s=>s.id===selected.id))stations.unshift(selected);
  const countrySelect=$('#country-filter'),previous=countrySelect.value;
  countrySelect.replaceChildren(new Option('All countries',''),...[...new Set(stations.map(s=>s.country).filter(Boolean))].sort().map(country=>new Option(country,country)));
  countrySelect.value=previous;countryMenu.sync();
  updateHeaderStyles();renderList();
}
async function refresh() {
  const generation=++catalogueGeneration;
  setPlayerMessage('Loading World Vibe');
  $('#refresh').disabled = true; $('#source-status').textContent = 'Loading station directory…';
  try {
    const sharedId=new URL(location.href).searchParams.get('station');
    const result = await loadInitialStations([...favoriteIds,...(sharedId?[sharedId]:[])]); stations = result.stations;
    const countrySelect=$('#country-filter'), previousCountry=countrySelect.value;
    countrySelect.replaceChildren(new Option('All countries',''),... [...new Set(stations.map(s=>s.country).filter(Boolean))].sort().map(country=>new Option(country,country)));
    countrySelect.value=previousCountry;
    if (selected && !stations.some(s => s.id === selected.id)) stations.unshift(selected);
    for (const id of result.complete?[]:favoriteIds) {
      if (!stations.some(s => s.id === id)) { try { const result = await apiRequest(`stations/byuuid/${encodeURIComponent(id)}`); const s = normalizeStation(result[0] || {},false,supportsHLS()); if (s) stations.push(s); } catch { /* Retain local favorite for the next successful refresh. */ } }
    }
    updateHeaderStyles();renderList(); $('#source-status').textContent = result.cached ? 'Cached directory · API unavailable' : 'Radio-Browser · live directory';
    const id = new URL(location.href).searchParams.get('station');
    if (id && !selected) {
      let s = stations.find(s => s.id === id);
      if (!s && /^[a-zA-Z0-9-]{1,64}$/.test(id)) { try { const result = await apiRequest(`stations/byuuid/${encodeURIComponent(id)}`); s = normalizeStation(result[0] || {},false,supportsHLS()); if (s) stations.unshift(s); } catch { /* Report unavailable below. */ } }
      if (s) choose(s, false); else toast('The shared station is unavailable or has no coordinates / HTTPS stream.');
    }
    // Resolve the startup identity while the loading globe is still visible.
    // The tiles already use the station color; listening waits for a user action.
    if(document.body.dataset.loading==='true'&&!selected&&!id&&document.body.dataset.embed!=='true'){
      const initial=startupStation(stations,favoriteIds);
      if(initial)choose(initial,false);
    }
    if(result.complete){
      $('#source-status').textContent='Radio-Browser · loading remaining stations…';
      // Fill the directory from the bundled snapshot without scanning remote API pages.
      setTimeout(()=>{
        if(generation!==catalogueGeneration)return;
        result.complete().then(full=>{
          if(generation!==catalogueGeneration)return;
          const merged=new Map(full.map(s=>[s.id,s]));for(const station of stations)merged.set(station.id,station);
          publishCatalogue([...merged.values()].sort((a,b)=>b.clicks-a.clicks||a.id.localeCompare(b.id)));
          $('#source-status').textContent='Radio-Browser · live picks + bundled directory';
        }).catch(()=>{if(generation===catalogueGeneration)$('#source-status').textContent='Partial directory · Refresh to retry';});
      },1000);
    }
    return true;
  } catch (e) { $('#source-status').textContent = 'Offline · try again'; toast(e.message);return false; }
  finally { $('#refresh').disabled = false;if(document.body.dataset.loading!=='true')setPlayerMessage(stations.length?'':'No stations loaded'); }
}
$('#search').addEventListener('input', renderList);
$('#country-filter').addEventListener('change', renderList);
$('#genre-filter').addEventListener('change',()=>{
  genre=$('#genre-filter').value;
  document.querySelectorAll('header [data-genre]').forEach(b=>b.classList.toggle('selected',b.dataset.genre===genre));
  setTheme({tags:genre==='all'?'electronic':genre});renderList();
});
function updateHeaderStyles(){
  const nav=$('.header-genres'),styles=['all',...favoriteStyles(stations,favoriteIds)];
  const signature=styles.join(',');
  if(nav.dataset.styles!==signature){
    nav.dataset.styles=signature;
    nav.replaceChildren(...styles.map(style=>{const button=document.createElement('button');button.type='button';button.dataset.genre=style;button.textContent=STYLE_LABELS[style];return button;}));
  }
  nav.querySelectorAll('[data-genre]').forEach(button=>button.classList.toggle('selected',button.dataset.genre===genre));
}
$('.header-genres').addEventListener('click', event => {
  const button=event.target.closest('button[data-genre]');
  if(!button)return;
  genre = button.dataset.genre; $('#genre-filter').value=genre;
  document.querySelectorAll('header [data-genre]').forEach(b => b.classList.toggle('selected', b === button));
  const themeTags={synthwave:'synthwave',lofi:'lo-fi',techno:'techno',jazz:'jazz',rock:'rock',all:'electronic'};
  setTheme({tags:themeTags[genre]||genre}); renderList();
  if (genre === 'all') return;
  // Header shortcuts choose from the entire genre, independent of directory filters.
  const candidates=stations.filter(s=>matchesStation(s,'',genre,favoritesOnly)&&(!favoritesOnly||favoriteIds.has(s.id)));
  const alternatives=candidates.filter(s=>s.id!==selected?.id);
  const pool=alternatives.length?alternatives:candidates;
  if(pool.length)choose(pool[Math.floor(Math.random()*pool.length)]);
  else setPlayerMessage(stations.length?'No stations available in this style.':document.body.dataset.loading==='true'?'The station directory is still loading. Please try again.':'No stations loaded');
});
$('#explore').addEventListener('click', () => { showDirectory(false);openCatalog(); });
$('#clear-filters').addEventListener('click',()=>{
  $('#search').value='';$('#country-filter').value='';$('#genre-filter').value='all';genre='all';favoritesOnly=false;
  document.body.dataset.favoritesOnly='false';
  setFavoriteRemovalMode(false);
  countryMenu.sync();countryMenu.close();
  $('#favorites').classList.remove('active');$('#explore').classList.add('active');$('#list-title').textContent='On the world stage';
  document.querySelectorAll('header [data-genre]').forEach(button=>button.classList.toggle('selected',button.dataset.genre==='all'));
  setTheme({tags:'electronic'});renderList();
});
$('#favorite').addEventListener('click', () => {
  if (!selected) return;
  if (favoriteIds.has(selected.id)) favoriteIds.delete(selected.id); else favoriteIds.add(selected.id);
  saveFavorites();updateFavorites(); if (favoritesOnly) renderList();
});
$('#play').addEventListener('click', () => {
  if (!selected) { const s = filtered[0]; if (s) choose(s); else setPlayerMessage(document.body.dataset.loading==='true'?'Loading World Vibe':'No stations loaded'); return; }
  if (!audio || audio.error) { fallback = false; session++; createAudio(true, session); playCurrent(); }
  else if (audio.paused) playCurrent(); else audio.pause();
});
function adjacent(delta) { if (!filtered.length) return toast('No stations in this filter.'); const i = filtered.findIndex(s => s.id === selected?.id); const nextIndex=i<0?(delta>0?0:filtered.length-1):(i+delta+filtered.length)%filtered.length;choose(filtered[nextIndex]); }
$('#next').addEventListener('click', () => adjacent(1)); $('#previous').addEventListener('click', () => adjacent(-1));
$('#random').addEventListener('click', () => { if (filtered.length) choose(filtered[Math.floor(Math.random() * filtered.length)]); });
$('#volume').addEventListener('input', () => { muted=false;syncVolume(); });
$('#mute').addEventListener('click',()=>{
  if(Number($('#volume').value)===0){$('#volume').value='0.7';muted=false;}else muted=!muted;
  syncVolume();
});
$('#refresh').addEventListener('click', refresh);
$('#rotate').addEventListener('click', () => { globe?.resetAxis(); });
$('#help').addEventListener('click', () => { window.open('https://ko-fi.com/eon','_blank','noopener,noreferrer'); });
$('#share-coffee').addEventListener('click',()=>{
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
    try{navigator.vibrate?.(12);}catch{/* Optional feedback must not block the button. */}
  }
  $('#help').click();
});
document.querySelectorAll('.dialog-close').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close(); } }));
function shareUrl() { const url = new URL(location.href);url.searchParams.delete('embed');url.searchParams.delete('perf'); url.searchParams.set('station', selected.id); return url.href; }
$('#share').addEventListener('click', () => { if (!selected) return setPlayerMessage('Choose a station to share.'); $('#share-description').textContent = `${selected.name} · ${selected.country}`; $('#native-share').hidden = !navigator.share; $('#embed-options').hidden=true;$('#embed-toggle').setAttribute('aria-expanded','false');$('#embed-code').value=embedCode(location.href,selected);openSiteDialog($('#share-dialog')); });
$('#embed-toggle').addEventListener('click',()=>{
  if(document.body.dataset.embed==='true')return;
  const options=$('#embed-options');options.hidden=!options.hidden;
  $('#embed-toggle').setAttribute('aria-expanded',String(!options.hidden));
  if(!options.hidden)$('#embed-preview').src=embedUrl(location.href,selected);
  else $('#embed-preview').removeAttribute('src');
  if(!options.hidden){$('#embed-code').focus();$('#embed-code').select();}
});
$('#share-dialog').addEventListener('close',()=>$('#embed-preview').removeAttribute('src'));
$('#copy-embed').addEventListener('click',async()=>{
  const field=$('#embed-code');field.value=embedCode(location.href,selected);
  try{await navigator.clipboard.writeText(field.value);toast('Embed code copied!');}
  catch{field.focus();field.select();toast('Select and copy the embed code.');}
});
document.querySelectorAll('[data-network]').forEach(b => b.addEventListener('click', () => {
  const url = encodeURIComponent(shareUrl()), text = encodeURIComponent(`Listening to ${selected.name} from ${selected.country} on melodia.`);
  const links = { facebook: `https://www.facebook.com/sharer/sharer.php?u=${url}`, x: `https://twitter.com/intent/tweet?url=${url}&text=${text}`, whatsapp: `https://wa.me/?text=${text}%20${url}`, telegram: `https://t.me/share/url?url=${url}&text=${text}`, reddit: `https://www.reddit.com/submit?url=${url}&title=${text}&type=LINK`, email: `mailto:?subject=${text}&body=${url}` };
  window.open(links[b.dataset.network], '_blank', 'noopener,noreferrer');
}));
$('#native-share').addEventListener('click', async () => { try { await navigator.share({ title: `melodia · ${selected.name}`, text: `Listen to ${selected.name}`, url: shareUrl() }); } catch(e) { if(e.name!=='AbortError') toast('Sharing is unavailable. Copy the link.'); } });
$('#copy-link').addEventListener('click', async () => { try { await navigator.clipboard.writeText(shareUrl()); toast('Link copied!'); } catch { toast('Copy the address from your browser address bar.'); } });
document.addEventListener('keydown', e => { if (e.key === '/' && !['INPUT','TEXTAREA'].includes(document.activeElement.tagName) && !document.querySelector('dialog[open]')) { e.preventDefault(); openCatalog(); $('#search').focus(); } if (e.key === 'Escape') openCatalog(false); });
const waveSvg=document.createElementNS('http://www.w3.org/2000/svg','svg');waveSvg.setAttribute('viewBox','0 0 120 36');waveSvg.setAttribute('aria-hidden','true');$('#visualizer').append(waveSvg);
const waves=Array.from({length:2},()=>{const path=document.createElementNS('http://www.w3.org/2000/svg','path');waveSvg.append(path);return path;});
let waveLevel=0, waveBass=0, wavePhase=0, waveSamples=null, previousWaveTime=performance.now(), lastWaveUpdate=0;
const visualizerElement=$('#visualizer');
$('#album').innerHTML='<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13M9 9l11-2M9 18c0 2-6 3-6 0s6-3 6 0M20 16c0 2-6 3-6 0s6-3 6 0"/></svg>';
function visualize() {
  requestAnimationFrame(visualize);
  const now=performance.now();
  if(document.hidden||now-lastWaveUpdate<1000/60-.5)return;
  lastWaveUpdate=now;
  const working=document.body.dataset.playing==='true';
  const delta=Math.min(.1,(now-previousWaveTime)/1000);previousWaveTime=now;
  const available=Boolean(working&&analyser&&bins&&audio&&!audio.paused&&audioContext?.state==='running');
  if(available){
    analyser.getByteFrequencyData(bins);
    if(!waveSamples||waveSamples.length!==analyser.fftSize)waveSamples=new Float32Array(analyser.fftSize);
    analyser.getFloatTimeDomainData(waveSamples);
  }else waveSamples?.fill(0);
  const reaction=audioReactivity.update(bins,waveSamples,audioContext?.sampleRate||48000,analyser?.fftSize||1024,delta,available);
  const smoothing=1-Math.exp(-delta*12);
  waveLevel+=(reaction.level-waveLevel)*smoothing;
  waveBass+=(reaction.bass-waveBass)*smoothing;
  if(available)wavePhase+=delta*(.7+reaction.bass*3);
  waves.forEach((path,i)=>{const d=wavePath(waveSamples,waveLevel,waveBass,wavePhase,i===1);if(path.getAttribute('d')!==d)path.setAttribute('d',d);});
  const analysis=available?'audio':'unavailable';
  if(visualizerElement.dataset.analysis!==analysis)visualizerElement.dataset.analysis=analysis;
  globe?.setAmplitude(reaction.signal);
  globe?.setAudioReaction(reaction);
  globe?.setStationAmplitudes(stationRhythm.levels());
}
async function startWorld(){
  const [catalogueReady,mapReady]=await Promise.all([refresh(),globe?.ready??Promise.resolve(false)]);
  setPlayerMessage(stations.length?'':'No stations loaded');
  document.body.dataset.loading='false';document.body.setAttribute('aria-busy','false');globe?.finishLoading();
  if(catalogueReady&&document.body.dataset.embed!=='true'){
    if(!selected&&!new URL(location.href).searchParams.has('station')){
      const initial=startupStation(stations,favoriteIds);
      if(initial)choose(initial,false);
    }
  }
  if(!catalogueReady||!mapReady)toast(!catalogueReady?'Station directory unavailable. Open Stations and try Refresh.':'Some map layers are unavailable. You can still listen from the station list.');
}
visualize(); updateFavorites();$('#play').title='Play';startWorld();