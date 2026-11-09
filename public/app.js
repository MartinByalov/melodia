import { createGlobe } from './globe.js';
import { createThemeFavicon } from './favicon.js';
import { StationRhythm } from './station-rhythm.js';
import { rhythmProfile, syntheticLevel } from './rhythm.js';
import { wavePath } from './player-wave.js';
import { AudioReactivity } from './audio-reactivity.js';
import { stationTheme } from './station-theme.js';
import { createCountryMenu } from './country-menu.js';
import { favoriteStyles, STYLE_LABELS } from './favorite-styles.js';
import { embedCode, embedUrl } from './embed.js';
import { loadStations, fetchArtistTracks, fetchTracksByIds, artistImageUrl, genreOf, matchesStation } from './music.js';
import { loadFavorites, saveFavorites as persistFavorites, hasFavorite, removeFavorite, toggleFavorite, favoriteArtistIds, decodeFavoritesPayload } from './favorites.js';
import { setupFavoritesDialog } from './favorites-ui.js';
import { shareBase } from './site.js';
import { startupStation } from './startup-station.js';
import {visualProfile,styleScores} from './visual-styles.js';
import {setupSiteInfo,openSiteDialog} from './site-info.js';
import {stationExcluded} from './station-exclusions.js';
import {stationUrl,continuePlayback} from './station-details.js';

const $ = selector => document.querySelector(selector);
const themeFavicon=createThemeFavicon($('#theme-favicon'));
themeFavicon.update('#62efc5');
window.addEventListener('pagehide',()=>themeFavicon.dispose());
$('#genre-filter').replaceChildren(...Object.entries(STYLE_LABELS).sort(([a,labelA],[b,labelB])=>a==='all'?-1:b==='all'?1:labelA.localeCompare(labelB,'en')).map(([value,label])=>{const option=document.createElement('option');option.value=value;option.textContent=value==='all'?'All styles':label;return option;}));
document.body.dataset.embed=String(new URL(location.href).searchParams.get('embed')==='1');
const underDevelopment=document.body.dataset.underDevelopment==='true';
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
  const row=document.createElement('div'),actions=document.createElement('div'),top=document.createElement('div'),bottom=document.createElement('div'),tools=document.createElement('div');
  row.className='mobile-header-row';actions.className='header-right mobile-header-actions';top.className='mobile-player-top';bottom.className='mobile-player-bottom';tools.className='mobile-tools';
  const searchRow=document.createElement('div'),searchBox=$('.search-box');
  searchRow.className='mobile-search-row';searchBox.before(searchRow);searchRow.append(searchBox);
  const landscapePhone=matchMedia('(orientation:landscape) and (max-height:500px)');
  function layout(){
    document.body.dataset.mobilePlayer=String(mobile.matches);
    document.body.dataset.landscapePhone=String(landscapePhone.matches&&!mobile.matches);
    if(mobile.matches){
      row.append(genres,actions);actions.append($('#catalog-toggle'));header.append(row);
      row.prepend($('.brand'));
      top.append($('#rotate'),$('#previous'),$('#play'),$('#next'),$('.volume'));
      searchRow.prepend($('#favorites'));
      tools.append($('#mode-toggle'),$('#reduce-effects'),$('#mobile-info'),$('#share'));bottom.append(left,$('#favorite'),tools);player.append(top,bottom,$('#globe-status'));
    }else{
      header.prepend($('.brand')||row.querySelector('.brand'));
      header.insertBefore(genres,headerRight);headerRight.prepend($('#catalog-toggle'),$('#favorites'),$('#mode-toggle'));row.remove();
      controls.append($('#favorite'),$('#previous'),$('#play'),$('#next'),$('#rotate'));
      if(landscapePhone.matches)right.append($('#globe-status'),$('.volume'),$('#reduce-effects'),$('#mobile-info'),$('#share'));
      else{right.append($('#globe-status'),$('.volume'),$('#share'));$('footer').after($('#mobile-info'));}player.prepend(left);top.remove();bottom.remove();
    }
  }
  mobile.addEventListener('change',layout);landscapePhone.addEventListener('change',layout);layout();
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
const ALBUM_NOTE='<svg viewBox="0 0 24 24" width="32" height="32" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 18V5l11-2v13M9 9l11-2M9 18c0 2-6 3-6 0s6-3 6 0M20 16c0 2-6 3-6 0s6-3 6 0"/></svg>';
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
  $('#world-message').textContent=text;
  $('#world-status').hidden=!text;
}
// Playback problems appear in the player's moving line, never over the globe.
function ensurePlayerLine(){
  const holder=$('#player-message');
  let link=$('#station-homepage'),notice=$('#player-notice');
  if(!link){link=document.createElement('a');link.id='station-homepage';link.target='_blank';link.rel='noopener noreferrer';holder.prepend(link);}
  if(!notice){notice=document.createElement('span');notice.id='player-notice';notice.hidden=true;holder.append(notice);}
  return {link,notice};
}
let noticeTimer=0;
function notify(text,ms=0){
  const {link,notice}=ensurePlayerLine();
  notice.textContent=text;notice.hidden=!text;link.hidden=Boolean(text);
  $('#globe-status').hidden=!text&&!selected;
  clearTimeout(noticeTimer);
  if(text&&ms)noticeTimer=setTimeout(()=>notify(''),ms);
}
const countryMenu=createCountryMenu($('#country-filter'),$('#catalog'));
const stationRhythm = new StationRhythm();
function openCatalog(open = true) {
  if(!open&&favoriteRemovalMode){setFavoriteRemovalMode(false);renderList();}
  $('#catalog').hidden = !open;
  document.body.dataset.catalogOpen=String(open);
  if(open)syncFacets();
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
  $('#favorites-share').hidden=!favoritesOnly;
  button.setAttribute('aria-pressed',String(favoriteRemovalMode));
  const label=favoriteRemovalMode?'Finish removing favorites':'Remove favorites';
  button.setAttribute('aria-label',label);button.title=label;
}
$('#favorite-edit').addEventListener('click',()=>{setFavoriteRemovalMode(!favoriteRemovalMode);renderList();});
function saveFavorites(){
  favoriteIds=favoriteArtistIds(favorites);
  try { persistFavorites(localStorage, favorites); } catch { toast('This browser cannot save favorites.'); }
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
// Favorites are songs, and favoriteIds is the set of their artists (it drives the header styles and the startup artist).
let favorites = (() => { try { return loadFavorites(localStorage); } catch { return []; } })();
let favoriteIds = favoriteArtistIds(favorites);
let globe;
try { globe = createGlobe($('#globe'), s => choose(s, true)); } catch (e) { console.error(e); setPlayerMessage('3D view is unavailable. Listen from the artist list.'); }
globe?.setDiscoMode?.(underDevelopment);
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
// Status messages are separate from the station website ticker.
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
  applyVisualStyle(station||s);
  $('#album').style.background = '#162736';
}
// The playing song's own genres drive the globe style and rhythm, falling back to the artist's tags.
function styleTagsOf(station) {
  const track = station === selected ? currentTrack(station) : null;
  return track?.tags || station?.tags || '';
}
let appliedStyle = null;
function applyVisualStyle(station) {
  const profile = visualProfile(styleTagsOf(station));
  const key = `${station?.id}:${profile.style}`;
  if (key === appliedStyle) return;
  appliedStyle = key;
  globe?.setVisualProfile(profile);
}
function songRhythm(artist, track) { return rhythmProfile(track?.tags || artist.tags || '', String(track?.id || artist.id), track?.speed); }
function updateFavorites() {
  updateHeaderStyles();
  $('#fav-count').textContent = favorites.length;
  const track = currentTrack(), favorite = Boolean(track && hasFavorite(favorites, track.id));
  $('#favorite').innerHTML = `<svg viewBox="0 0 24 24" width="22" height="22" fill="${favorite ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20.8 4.6a5.5 5.5 0 0 0-7.8 0L12 5.7l-1.1-1.1a5.5 5.5 0 0 0-7.8 7.8L12 21l8.8-8.6a5.5 5.5 0 0 0 0-7.8Z"/></svg>`;
  $('#favorite').setAttribute('aria-pressed', String(!!favorite));
  const label=favorite?'Remove this song from favorites':'Add this song to favorites';
  $('#favorite').title=label;$('#favorite').setAttribute('aria-label',label);
}
// Country and style choices only list what still has artists under the other filters, so there is never an empty combination.
function syncFacets() {
  const query = $('#search').value.trim(), countrySelect = $('#country-filter'), styleSelect = $('#genre-filter'), country = countrySelect.value;
  const countries = new Set(), styles = new Set();
  for (const s of stations) {
    if (favoritesOnly && !favoriteIds.has(s.id)) continue;
    if (query && !matchesStation(s, query, 'all', favoritesOnly)) continue;
    const scores = styleScores(s.tags);
    let top = 0;
    for (const key in scores) if (scores[key] > top) top = scores[key];
    const counts = key => scores[key] > 0 && (favoritesOnly || scores[key] >= top);
    if (s.country && (genre === 'all' || counts(genre))) countries.add(s.country);
    if (!country || s.country === country) for (const key in scores) if (counts(key)) styles.add(key);
  }
  if (country) countries.add(country);
  if (genre !== 'all') styles.add(genre);
  const countryList = [...countries].sort((a, b) => a.localeCompare(b, 'en')), countrySignature = countryList.join('|');
  if (countrySelect.dataset.facets !== countrySignature) {
    countrySelect.dataset.facets = countrySignature;
    countrySelect.replaceChildren(new Option('All countries', ''), ...countryList.map(name => new Option(name, name)));
    countrySelect.value = country; countryMenu.sync();
  }
  const styleList = Object.entries(STYLE_LABELS).filter(([value]) => value === 'all' || styles.has(value)).sort(([a, labelA], [b, labelB]) => a === 'all' ? -1 : b === 'all' ? 1 : labelA.localeCompare(labelB, 'en'));
  const styleSignature = styleList.map(([value]) => value).join('|');
  if (styleSelect.dataset.facets !== styleSignature) {
    styleSelect.dataset.facets = styleSignature;
    styleSelect.replaceChildren(...styleList.map(([value, label]) => { const option = document.createElement('option'); option.value = value; option.textContent = value === 'all' ? 'All styles' : label; return option; }));
    styleSelect.value = genre;
  }
  if (styleSelect.value !== genre) styleSelect.value = genre;
}
const stationIndex = { source: null, count: -1, map: new Map() };
function stationById(id) {
  if (stationIndex.source !== stations || stationIndex.count !== stations.length) { stationIndex.map = new Map(stations.map(s => [s.id, s])); stationIndex.source = stations; stationIndex.count = stations.length; }
  return stationIndex.map.get(id);
}
// Favorite songs whose artist is in the catalogue, narrowed by the search box, country and style.
function favoriteSongs() {
  const query = $('#search').value.trim().toLowerCase(), country = $('#country-filter').value;
  return favorites.map(f => ({ f, s: stationById(f.a) })).filter(({ f, s }) => s && !stationExcluded(s)
    && (!country || s.country === country)
    && (genre === 'all' || matchesStation(s, '', genre, true))
    && (!query || `${f.n} ${s.name} ${s.country} ${s.state} ${s.tags}`.toLowerCase().includes(query)));
}
function renderList(limit = 100) {
  if (typeof limit !== 'number') limit=100;
  // The filter lists are only needed (and only built) while the directory is open.
  if(!$('#catalog').hidden)syncFacets();
  const songs = favoritesOnly ? favoriteSongs() : null;
  filtered = songs ? [...new Map(songs.map(({ s }) => [s.id, s])).values()] : stations.filter(s => matchesStation(s, $('#search').value.trim(), genre,favoritesOnly) && (!$('#country-filter').value || s.country === $('#country-filter').value));
  const items = songs || filtered.map(s => ({ s }));
  $('#result-count').textContent = songs ? `${songs.length} SONGS` : `${filtered.length} ARTISTS`;
  $('#directory-count').textContent=`${stations.length.toLocaleString('en-US')} artists`;
  const list = $('#stations'); list.replaceChildren();
  if (!items.length) { const empty = document.createElement('p'); empty.className = 'empty'; empty.textContent = favoritesOnly ? favorites.length?'No favorites match these filters. Try another style or clear filters.':'No favorite songs yet. Play a song and press the heart.' : 'No matching artists. Try another genre or country.'; list.append(empty); }
  for (const { f, s } of items.slice(0, limit)) {
    const playing = selected?.id === s.id && (!f || currentTrack()?.id === f.t);
    const row = document.createElement('button'); row.className = `station-row${playing ? ' active' : ''}`; row.setAttribute('aria-label', f ? `Play ${f.n || 'this song'} by ${s.name}` : `Listen to ${s.name}, ${s.country}`); row.dataset.id = s.id; if (f) row.dataset.track = f.t;
    const palette=stationTheme(s.id);
    const art = document.createElement('span'); art.className = 'station-art'; art.style.setProperty('--station-color',palette.color);art.style.setProperty('--station-rgb',palette.rgb); art.textContent = (f?.n || s.name).slice(0,1).toUpperCase();
    const text = document.createElement('span'); text.className = 'station-text';
    const name = document.createElement('strong'); name.textContent = f ? (f.n || s.name) : s.name;
    const location = document.createElement('small'); location.textContent = f ? `${s.name} · ${s.state || s.country}` : `${s.state || s.country} · ${genreOf(s.tags)}${s.bitrate ? ` · ${s.bitrate}k` : ''}`;
    text.append(name, location);
    row.append(art, text); row.addEventListener('click', () => choose(s, true, f?.t));
    if(favoritesOnly&&favoriteRemovalMode){
      const item=document.createElement('div');item.className='favorite-edit-row';
      const label=f?.n||s.name;
      const remove=document.createElement('button');remove.type='button';remove.className='favorite-remove';remove.textContent='×';
      remove.setAttribute('aria-label',`Remove ${label} from favorites`);remove.title=`Remove ${label} from favorites`;
      remove.addEventListener('click',()=>{
        const scrollTop=list.scrollTop;
        favorites=removeFavorite(favorites,f.t);saveFavorites();updateFavorites();renderList(limit);list.scrollTop=scrollTop;
        const remaining=list.querySelector('.favorite-remove');
        if(remaining)remaining.focus({preventScroll:true});else $('#favorite-edit').focus({preventScroll:true});
      });
      item.append(row,remove);list.append(item);
    }else list.append(row);
  }
  if (items.length > limit) { const more = document.createElement('button'); more.className = 'load-more'; more.textContent = `Show more · ${limit.toLocaleString('en-US')} of ${items.length.toLocaleString('en-US')}`; more.addEventListener('click',()=>{const scrollTop=list.scrollTop;renderList(limit+100);list.scrollTop=scrollTop;});list.append(more); }
  // Directory filters must not recolor or remove the other genres on the globe.
  if (renderList.mappedStations !== stations || renderList.mappedCount !== stations.length) {
    globe?.setStations(stations);
    renderList.mappedStations=stations;renderList.mappedCount=stations.length;
  }
}
function updatePlayerState(state) {
  const playing = state === 'playing';
  if (['loading','playing','paused'].includes(state)) notify('');
  // Connection progress is shown in the player status chip, never over the globe.
  if(document.body.dataset.loading!=='true'&&(state==='loading'||['playing','paused','ready'].includes(state)))setPlayerMessage('');
  $('#play').title=playing?'Pause':'Play';
  globe?.setPlaying(playing);
  document.body.dataset.playing=String(playing);
  document.body.dataset.playerState=state;
  $('#play').innerHTML = playing ? '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M7 5h4v14H7zM14 5h4v14h-4z"/></svg>' : '<svg viewBox="0 0 24 24" width="22" height="22" fill="currentColor" aria-hidden="true"><path d="M8 4 20 12 8 20Z"/></svg>'; $('#play').setAttribute('aria-label', playing ? 'Pause' : 'Play');
  $('#play-status').textContent = { playing: 'PLAYING', loading: 'CONNECTING…', paused: 'PAUSED', error: 'UNAVAILABLE', ready: 'SELECTED' }[state] || 'READY TO EXPLORE';
}
const audioReactivity=new AudioReactivity();
window.addEventListener('pagehide',()=>resetAudio());
function resetAudio() {
  clearTimeout(loadingTimer);
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
  element.src = selected.url;
  prepareAudioAnalysis();
  element.addEventListener('playing', () => { if (token !== session || audio !== element) return; clearTimeout(loadingTimer); updatePlayerState('playing'); });
  element.addEventListener('pause', () => { if (token === session && audio === element && !element.ended) updatePlayerState('paused'); });
  element.addEventListener('waiting', () => { if (token === session && audio === element) updatePlayerState('loading'); });
  element.addEventListener('ended', () => { if (token === session && audio === element) nextTrack(); });
  element.addEventListener('error', () => {
    if (token !== session || audio !== element) return;
    if (useCors && !fallback) {
      streamsWithoutAnalysis.add(element.src);
      fallback = true; createAudio(false, token); playCurrent(token);
    } else { clearTimeout(loadingTimer); updatePlayerState('error'); notify('This track cannot be played. Try another artist.'); }
  });
  loadingTimer = setTimeout(() => { if (token === session && audio?.readyState < 3) { updatePlayerState('error'); notify('The track is taking too long. Try again or choose another artist.'); } }, 20000);
}
async function playCurrent(token = session) {
  if (!audio) return;
  const element=audio;
  updatePlayerState('loading');
  try {
    prepareAudioAnalysis();
    if(audioGestureReceived&&audioContext?.state==='suspended')audioContext.resume().catch(()=>{});
    if(token!==session||audio!==element)return;
    await element.play();
  } catch (e) {
    if (token !== session || audio !== element || e.name === 'AbortError') return;
    if (e.name === 'NotAllowedError') { clearTimeout(loadingTimer); updatePlayerState('ready'); notify('Press ▶ to allow playback.'); }
    else if (!fallback && element.crossOrigin) { streamsWithoutAnalysis.add(element.src); fallback = true; createAudio(false, token); playCurrent(token); }
    else { updatePlayerState('error'); }
  }
}
function currentTrack(artist = selected) { return artist?.tracks?.[artist.trackIndex ?? 0] ?? null; }
// The player square shows the artist's picture, then the album cover of the playing track, and falls back to the music note.
function setAlbumImage(url) {
  const album = $('#album');
  if (!url) { album.innerHTML = ALBUM_NOTE; return; }
  const image = new Image();
  image.alt = ''; image.decoding = 'async'; image.referrerPolicy = 'no-referrer';
  image.addEventListener('error', () => { if (album.firstChild === image) album.innerHTML = ALBUM_NOTE; });
  image.src = url;
  album.replaceChildren(image);
}
const placeLabel = s => `${s.state ? `${s.state}, ` : ''}${s.country}${s.approximate ? ' · approximate location' : ''}`;
function showTrack(artist) {
  const track = currentTrack(artist);
  if (!track) return;
  artist.url = track.url;
  nowPlaying = [track.title, track.license].filter(Boolean).join(' · ');
  $('#track-name').title = nowPlaying;
  $('#track-location').textContent = `${track.title} · ${placeLabel(artist)}`;
  if (track.image) setAlbumImage(track.image);
  applyVisualStyle(artist);
  globe?.setTrackRhythm(artist.id, songRhythm(artist, track));
  updateFavorites();
}
// Tracks are requested when an artist is chosen and are never stored.
async function ensureTracks(artist) {
  if (!artist.tracks?.length) { artist.tracks = await fetchArtistTracks(artist.id); artist.trackIndex = 0; }
  // A favorite song may not be among the artist's most popular ones, so it is looked up on its own.
  const wanted = artist.wantedTrack;
  if (!wanted) return;
  artist.wantedTrack = null;
  let index = artist.tracks.findIndex(track => track.id === wanted);
  if (index < 0) {
    try { const hit = (await fetchTracksByIds([wanted])).get(wanted); if (hit) { artist.tracks = [hit.track, ...artist.tracks]; index = 0; } } catch { /* The artist's own tracks still play. */ }
  }
  if (index >= 0) artist.trackIndex = index;
}
async function startPlayback() {
  const token = session, artist = selected;
  updatePlayerState('loading');
  try { await ensureTracks(artist); }
  catch (error) { if (token === session) { updatePlayerState('error'); notify(/^This artist/.test(error.message) ? error.message : 'Jamendo is not responding right now. Try again in a moment.'); } return; }
  if (token !== session || artist !== selected) return;
  showTrack(artist);
  createAudio(true, token); playCurrent(token);
}
function nextTrack() {
  const tracks = selected?.tracks;
  if (!tracks?.length) { updatePlayerState('paused'); return; }
  selected.trackIndex = ((selected.trackIndex ?? 0) + 1) % tracks.length;
  showTrack(selected);
  session++; fallback = false;
  createAudio(true, session); playCurrent();
}
function choose(s, autoplay = continuePlayback(document.body.dataset.playerState), trackId = null) {
  if (stationExcluded(s)) return;
  if (trackId) s.wantedTrack = String(trackId);
  if(underDevelopment)autoplay=false;
  nowPlaying='';
  if(playerMessage==='Choose an artist to share.')setPlayerMessage('');
  else if(document.body.dataset.loading!=='true')setPlayerMessage('');
  session++; selected = s; fallback = false; resetAudio(); notify('');
  $('#track-name').textContent = s.name; $('#track-location').textContent = placeLabel(s);
  setAlbumImage(artistImageUrl(s.id));
  const homepage=ensurePlayerLine().link;homepage.textContent=s.homepage||'Artist page unavailable';
  if(s.homepage)homepage.href=s.homepage;else homepage.removeAttribute('href');
  $('#globe-status').hidden=false;
  $('#station-info').disabled=false;
  setTheme(s); updateFavorites(); renderList(); globe?.select(s);
  history.replaceState(null, '', stationUrl(location.href,s));
  updatePlayerState('ready');
  if (autoplay) startPlayback();
}
let catalogueGeneration=0;
async function refresh() {
  const generation=++catalogueGeneration;
  $('#refresh').disabled = true; $('#source-status').textContent = 'Loading artist directory…';
  try {
    const result = await loadStations(); if(generation!==catalogueGeneration)return false;
    stations = result.stations.filter(s=>!stationExcluded(s));
    const countrySelect=$('#country-filter'), previousCountry=countrySelect.value;
    countrySelect.replaceChildren(new Option('All countries',''),... [...new Set(stations.map(s=>s.country).filter(Boolean))].sort().map(country=>new Option(country,country)));
    countrySelect.value=previousCountry;countryMenu.sync();
    if (selected && !stationExcluded(selected) && !stations.some(s => s.id === selected.id)) stations.unshift(selected);
    updateHeaderStyles();renderList();
    $('#source-status').textContent = `Jamendo · ${stations.length.toLocaleString('en-US')} independent artists`;
    const id = new URL(location.href).searchParams.get('id');
    if (id && !selected) {
      const s = stations.find(s => s.id === id);
      if (s) choose(s, false); else toast('The shared artist is unavailable.');
    }
    // Pick the startup artist while the loading globe is still visible: it only sets the color, listening waits for a click.
    if(document.body.dataset.loading==='true'&&!selected&&!id&&document.body.dataset.embed!=='true'){
      const initial=startupStation(stations,favoriteIds);
      if(initial)choose(initial,false);
    }
    return true;
  } catch (e) { $('#source-status').textContent = 'Offline · try again'; toast(e.message);return false; }
  finally { $('#refresh').disabled = false;if(document.body.dataset.loading!=='true')setPlayerMessage(stations.length?'':'No artists loaded'); }
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
  if($('#catalog').hidden&&favoritesOnly)showDirectory(false);
  genre = button.dataset.genre; $('#genre-filter').value=genre;
  document.querySelectorAll('header [data-genre]').forEach(b => b.classList.toggle('selected', b === button));
  const themeTags={synthwave:'synthwave',lofi:'lo-fi',techno:'techno',jazz:'jazz',rock:'rock',all:'electronic'};
  setTheme({tags:themeTags[genre]||genre}); renderList();
  // Picking a style also plays something from it, chosen at random from the matching artists.
  if(genre!=='all'){
    const pool=filtered.filter(s=>s.id!==selected?.id);
    const pick=pool.length?pool[Math.floor(Math.random()*pool.length)]:filtered[0];
    if(pick)choose(pick,true);else toast('No artists in this style yet.');
  }
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
$('#favorite').addEventListener('click', async () => {
  const artist = selected;
  if (!artist) return;
  try { await ensureTracks(artist); } catch { notify("This artist's music is unavailable right now.", 4000); return; }
  const track = currentTrack(artist);
  if (artist !== selected || !track) return;
  favorites = toggleFavorite(favorites, { a: artist.id, t: track.id, n: track.title }).list;
  saveFavorites(); updateFavorites(); if (favoritesOnly) renderList();
});
$('#play').addEventListener('click', () => {
  if(underDevelopment)return;
  if (!selected) { const s = filtered[0]; if (s) choose(s,true); else if (document.body.dataset.loading!=='true') setPlayerMessage('No artists loaded'); return; }
  if (!audio || audio.error) { fallback = false; session++; startPlayback(); }
  else if (audio.paused) playCurrent(); else audio.pause();
});
function adjacent(delta) { if (!filtered.length) return toast('No artists in this filter.'); const i = filtered.findIndex(s => s.id === selected?.id); const nextIndex=i<0?(delta>0?0:filtered.length-1):(i+delta+filtered.length)%filtered.length;choose(filtered[nextIndex]); }
// Previous and next walk the selected artist's playlist and never switch artist; without a selection they pick the neighbouring artist.
async function stepPlaylist(delta) {
  const artist = selected;
  if (!artist) { adjacent(delta); return; }
  try { await ensureTracks(artist); }
  catch { notify("This artist's music is unavailable right now.", 4000); return; }
  if (artist !== selected) return;
  const count = artist.tracks?.length || 0;
  if (count < 2) { notify('This artist has no other tracks.', 4000); return; }
  artist.trackIndex = ((artist.trackIndex ?? 0) + delta + count) % count;
  showTrack(artist);
  session++; fallback = false;
  if (continuePlayback(document.body.dataset.playerState)) { createAudio(true, session); playCurrent(); }
  else { resetAudio(); updatePlayerState('ready'); }
}
$('#next').addEventListener('click', () => stepPlaylist(1)); $('#previous').addEventListener('click', () => stepPlaylist(-1));
$('#random').addEventListener('click', () => { if (filtered.length) choose(filtered[Math.floor(Math.random() * filtered.length)]); });
$('#volume').addEventListener('input', () => { muted=false;syncVolume(); });
$('#mute').addEventListener('click',()=>{
  if(Number($('#volume').value)===0){$('#volume').value='0.7';muted=false;}else muted=!muted;
  syncVolume();
});
$('#refresh').addEventListener('click', refresh);
$('#rotate').addEventListener('click', () => { globe?.resetAxis(); });
$('#share-coffee').addEventListener('click',()=>{
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches){
    try{navigator.vibrate?.(12);}catch{/* Optional feedback must not block the button. */}
  }
  window.open('https://ko-fi.com/eon','_blank','noopener,noreferrer');
});
document.querySelectorAll('.dialog-close').forEach(b => b.addEventListener('click', () => b.closest('dialog').close()));
document.querySelectorAll('dialog').forEach(d => d.addEventListener('click', e => { if (e.target === d) { const r = d.getBoundingClientRect(); if (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom) d.close(); } }));
function shareUrl() { const url = stationUrl(shareBase(),selected);url.searchParams.delete('embed');url.searchParams.delete('perf'); return url.href; }
$('#station-info').addEventListener('click',()=>{
  if(!selected)return;
  $('#station-title').textContent=selected.name;
  $('#copy-stream').textContent='Copy track address';
  const track=currentTrack();
  const facts=[['Location',[selected.state,selected.country].filter(Boolean).join(', ')+(selected.approximate?' (approximate point inside the country)':'')],['Styles',selected.tags||'Not supplied'],['Artist page',selected.homepage||'Not supplied'],['Track',track?.title||'Not loaded yet'],['License',track?.license||'See the track page on Jamendo'],['Source','Jamendo'],['Artist ID',selected.id]];
  $('#station-facts').replaceChildren(...facts.map(([label,value])=>{
    const p=document.createElement('p'),strong=document.createElement('strong');strong.textContent=`${label}: `;
    if(label==='Artist page'&&/^https:\/\//.test(value)){const link=document.createElement('a');link.href=value;link.textContent=value;link.target='_blank';link.rel='noopener noreferrer';p.append(strong,link);}
    else p.append(strong,document.createTextNode(value));
    return p;
  }));
  openSiteDialog($('#station-dialog'));
});
$('#copy-stream').addEventListener('click',async()=>{
  if(!selected)return;
  try{await navigator.clipboard.writeText(currentTrack()?.page||selected.homepage);$('#copy-stream').textContent='Copied!';}
  catch{$('#copy-stream').textContent='Copy the address from your browser';}
});
$('#share').setAttribute('aria-controls','share-dialog');$('#share').setAttribute('aria-expanded','false');
$('#share').addEventListener('click', () => { if (!selected) return setPlayerMessage('Choose an artist to share.'); $('#share-description').textContent = `${selected.name} · ${selected.country}`; $('#native-share').hidden = !navigator.share; $('#embed-options').hidden=true;$('#embed-toggle').setAttribute('aria-expanded','false');$('#embed-code').value=embedCode(shareBase(),selected);openSiteDialog($('#share-dialog'));$('#share').setAttribute('aria-expanded',String($('#share-dialog').open)); });
$('#embed-toggle').addEventListener('click',()=>{
  if(document.body.dataset.embed==='true')return;
  const options=$('#embed-options');options.hidden=!options.hidden;
  $('#embed-toggle').setAttribute('aria-expanded',String(!options.hidden));
  if(!options.hidden)$('#embed-preview').src=embedUrl(location.href,selected);
  else $('#embed-preview').removeAttribute('src');
  if(!options.hidden){$('#embed-code').focus();$('#embed-code').select();}
});
$('#share-dialog').addEventListener('close',()=>{$('#embed-preview').removeAttribute('src');$('#share').setAttribute('aria-expanded',String($('#share-dialog').open));});
$('#copy-embed').addEventListener('click',async()=>{
  const field=$('#embed-code');field.value=embedCode(shareBase(),selected);
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
$('#album').innerHTML=ALBUM_NOTE;
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
  // Without analysis (no CORS or no click yet) a playing track gets a stylistic wave so the graph never looks dead.
  const styled=!available&&working&&audio&&!audio.paused&&audio.readyState>=3;
  const styledLevel=styled?syntheticLevel(songRhythm(selected||{},currentTrack()),now/1000):0;
  const smoothing=1-Math.exp(-delta*12);
  waveLevel+=((styled?styledLevel*.7:reaction.level)-waveLevel)*smoothing;
  waveBass+=((styled?styledLevel*.6:reaction.bass)-waveBass)*smoothing;
  if(available)wavePhase+=delta*(.7+reaction.bass*3);else if(styled)wavePhase+=delta*(.9+styledLevel*2);
  waves.forEach((path,i)=>{const d=wavePath(waveSamples,waveLevel,waveBass,wavePhase,i===1);if(path.getAttribute('d')!==d)path.setAttribute('d',d);});
  const analysis=available?'audio':styled?'styled':'unavailable';
  if(visualizerElement.dataset.analysis!==analysis)visualizerElement.dataset.analysis=analysis;
  globe?.setAmplitude(reaction.signal);
  globe?.setAudioReaction(reaction);
  globe?.setStationAmplitudes(stationRhythm.levels());
}
async function startWorld(){
  const [catalogueReady,mapReady]=await Promise.all([refresh(),globe?.ready??Promise.resolve(false)]);
  setPlayerMessage(stations.length?'':'No artists loaded');
  document.body.dataset.loading='false';document.body.setAttribute('aria-busy','false');globe?.finishLoading();
  if(catalogueReady&&document.body.dataset.embed!=='true'){
    if(!selected&&!new URL(location.href).searchParams.has('id')){
      const initial=startupStation(stations,favoriteIds);
      if(initial)choose(initial,false);
    }
  }
  if(!catalogueReady||!mapReady)toast(!catalogueReady?'Artist directory unavailable. Open Artists and try Refresh.':'Some map layers are unavailable. You can still listen from the artist list.');
}
const favoritesDialog = setupFavoritesDialog({
  getFavorites: () => favorites,
  setFavorites: list => { favorites = list; saveFavorites(); updateFavorites(); if (favoritesOnly) renderList(); },
  artistName: id => stationById(id)?.name || '',
  resolve: ids => fetchTracksByIds(ids),
  openDialog: openSiteDialog
});
$('#favorites-share').addEventListener('click', () => favoritesDialog.open());
// A link or QR code from another device carries a list of songs: ask before adding it.
function offerSharedFavorites() {
  const url = new URL(location.href), payload = url.searchParams.get('f');
  if (payload === null || document.body.dataset.embed === 'true') return;
  url.searchParams.delete('f');
  history.replaceState(null, '', url);
  const items = decodeFavoritesPayload(payload);
  if (items.length) favoritesDialog.offer(items);
}
visualize(); updateFavorites();$('#play').title='Play';startWorld().then(offerSharedFavorites);