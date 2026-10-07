import {matchesStyle} from './visual-styles.js';
export const SERVERS = ['https://de1.api.radio-browser.info', 'https://nl1.api.radio-browser.info', 'https://at1.api.radio-browser.info'];
export const GENRE_COLORS = { electronic: '#62efc5', jazz: '#ffcc70', rock: '#ff7499', chill: '#78b7ff', pop: '#d296ff', classical: '#eee0a5' };
// Station identity spans the full spectrum, independently of the six UI themes.
export function stationColorHSL(id) {
  let hash=2166136261;
  for(const char of id)hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
  // Avalanche similar IDs before deriving independent palette components.
  hash=Math.imul(hash^(hash>>>16),2246822507)>>>0;
  hash=Math.imul(hash^(hash>>>13),3266489909)>>>0;
  hash=(hash^(hash>>>16))>>>0;
  const variation=Math.imul(hash^(hash>>>16),2246822507)>>>0;
  const hue=hash/4294967296;
  // Keep the full spectrum, but reserve only 10% for magenta/pink (300–360°).
  const h=hue<.9?hue/.9*(5/6):5/6+(hue-.9)/.1*(1/6);
  return {h,s:.72+(variation&65535)/65535*.28,l:.46+((variation>>>16)&65535)/65535*.18};
}
export function supportsNativeHLS(){
  if(typeof document==='undefined')return false;
  const audio=document.createElement('audio');
  return Boolean(audio.canPlayType('application/vnd.apple.mpegurl')||audio.canPlayType('application/x-mpegURL'));
}
export function supportsHLS(){
  if(supportsNativeHLS())return true;
  if(typeof window==='undefined')return false;
  const MediaSource=window.MediaSource||window.ManagedMediaSource;
  return Boolean(MediaSource?.isTypeSupported?.('audio/mp4; codecs="mp4a.40.2"'));
}
export function normalizeStation(s, requireGeo = true, allowHLS = false) {
  const lat = s.geo_lat, lon = s.geo_long;
  const hasGeo = lat !== null && lon !== null && lat !== undefined && lon !== undefined && lat !== '' && lon !== '' && Number.isFinite(Number(lat)) && Number.isFinite(Number(lon)) && Math.abs(Number(lat)) <= 90 && Math.abs(Number(lon)) <= 180;
  if (requireGeo && !hasGeo) return null;
  let url;
  for(const address of [s.url_resolved,s.url]){
    try{const candidate=new URL(address);if(candidate.protocol==='https:'){url=candidate;break;}}catch{/* Try the original address if the resolved address is unusable. */}
  }
  if (!url || !s.stationuuid || !s.name || !s.name.trim()) return null;
  const hls=Number(s.hls)===1||/\.m3u8(?:$|[?#])/i.test(url.href);
  if(hls&&!allowHLS)return null;
  return { id: s.stationuuid, name: s.name.trim(), country: s.country || 'Unknown', code: s.countrycode || '', state: s.state || '', tags: (s.tags || '').toLowerCase(), lat: hasGeo ? Number(lat) : null, lon: hasGeo ? Number(lon) : null, url: url.href, hls, clicks: Number(s.clickcount) || 0, bitrate: Number(s.bitrate) || 0, codec: s.codec || '' };
}
export function genreOf(tags) {
  if (/jazz|swing|blues/.test(tags)) return 'jazz';
  if (/classical|opera|orchestral/.test(tags)) return 'classical';
  if (/chill|ambient|lounge|relax|lo[ -]?fi|downtempo/.test(tags)) return 'chill';
  if (/rock|metal|punk/.test(tags)) return 'rock';
  if (/electro|dance|house|techno|trance|synth|edm/.test(tags)) return 'electronic';
  return 'pop';
}
export function matchesStation(s, query, genre,includeSecondary=false) {
  return (!query || `${s.name} ${s.country} ${s.state} ${s.tags}`.toLowerCase().includes(query.toLowerCase())) && (genre === 'all' || matchesStyle(s.tags,genre,includeSecondary));
}
export async function apiRequest(path) {
  let last;
  for (const server of SERVERS) {
    try { const response = await fetch(`${server}/json/${path}`, { signal: AbortSignal.timeout(10000) }); if (!response.ok) throw new Error(`HTTP ${response.status}`); return await response.json(); } catch (e) { last = e; }
  }
  throw last;
}
export async function fetchStationCatalogue(request = apiRequest, pageSize = 5000, allowHLS = supportsHLS()) {
  if (!Number.isInteger(pageSize) || pageSize < 1) throw new Error('Invalid page size');
  const stations = new Map();
  for (let offset = 0;;) {
    const data = await request(`stations/search?hidebroken=true&order=name&limit=${pageSize}&offset=${offset}`);
    if (!Array.isArray(data)) throw new Error('Invalid catalogue response');
    let added = 0;
    for (const raw of data) {
      if (!raw.stationuuid || stations.has(raw.stationuuid)) continue;
      stations.set(raw.stationuuid, normalizeStation(raw, false, allowHLS));added++;
    }
    if (data.length < pageSize) break;
    if (!added) throw new Error('Catalogue pagination did not advance');
    offset += data.length;
  }
  return [...stations.values()].filter(Boolean).sort((a,b)=>b.clicks-a.clicks || a.id.localeCompare(b.id));
}
export async function loadStations(allowHLS=supportsHLS(),fetchSnapshot=fetch) {
  const response = await fetchSnapshot('./assets/stations.json');
  if (!response.ok) throw new Error('Directory unavailable. Try Refresh.');
  return { stations: (await response.json()).map(s=>normalizeStation(s,false,allowHLS)).filter(Boolean), cached: true };
}

// Publish live picks first; expand from the bundled directory without API pagination.
export async function loadInitialStations(priorityIds=[],request=apiRequest,allowHLS=supportsHLS(),loadSnapshot=loadStations){
  const priorities=[...new Set(priorityIds)].filter(id=>/^[a-zA-Z0-9-]{1,64}$/.test(id));
  const paths=['stations/search?hidebroken=true&order=clickcount&reverse=true&limit=500',
    'stations/search?hidebroken=true&tag=lofi&limit=100'];
  if(priorities.length)paths.push(`stations/byuuid?uuids=${encodeURIComponent(priorities.join(','))}`);
  const responses=await Promise.allSettled(paths.map(path=>request(path)));
  const initial=new Map();
  for(const response of responses){
    if(response.status!=='fulfilled'||!Array.isArray(response.value))continue;
    for(const raw of response.value){const station=normalizeStation(raw,false,allowHLS);if(station)initial.set(station.id,station);}
  }
  if(!initial.size)return loadSnapshot(allowHLS);
  let completion;
  return {stations:[...initial.values()],cached:false,
    complete(){return completion??=loadSnapshot(allowHLS).then(result=>result.stations);}};
}