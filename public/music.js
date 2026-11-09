import {matchesStyle} from './visual-styles.js';
import {stationExcluded} from './station-exclusions.js';

// Jamendo API access for public, read-only data (registered for melodia.lol, non-commercial): https://devportal.jamendo.com/api_terms_of_use
export const JAMENDO_CLIENT_ID = 'ac47998d';
export const JAMENDO_API = 'https://api.jamendo.com/v3.0';
export const CATALOGUE_URL = './assets/artists.json';
export const GENRE_COLORS = { electronic: '#62efc5', jazz: '#ffcc70', rock: '#ff7499', chill: '#78b7ff', pop: '#d296ff', classical: '#eee0a5' };

// Artist identity spans the full spectrum, independently of the six UI themes.
export function stationColorHSL(id) {
  let hash=2166136261;
  for(const char of id)hash=Math.imul(hash^char.charCodeAt(0),16777619)>>>0;
  // Avalanche similar IDs before deriving independent palette components.
  hash=Math.imul(hash^(hash>>>16),2246822507)>>>0;
  hash=Math.imul(hash^(hash>>>13),3266489909)>>>0;
  hash=(hash^(hash>>>16))>>>0;
  const variation=Math.imul(hash^(hash>>>16),2246822507)>>>0;
  const hue=hash/4294967296;
  // Keep the full spectrum, but reserve only 10% for magenta/pink (300-360°).
  const h=hue<.9?hue/.9*(5/6):5/6+(hue-.9)/.1*(1/6);
  return {h,s:.72+(variation&65535)/65535*.28,l:.46+((variation>>>16)&65535)/65535*.18};
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

// Catalogue rows: [jamendoId, name, ISO-2 country, city, lat, lon, level, tags?] where level 0 = Jamendo coordinates, 1 = city lookup, 2 = inside the country.
export function normalizeArtist(row, countries = {}, rank = 0) {
  if (!Array.isArray(row)) return null;
  const [id, name, code, city, lat, lon, level, tags] = row;
  const text = String(name ?? '').trim();
  if (!Number.isInteger(id) || id < 1 || !text) return null;
  if (!Number.isFinite(lat) || !Number.isFinite(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) return null;
  const station = {
    id: String(id), name: text, country: countries[code] || code || 'Unknown', code: code || '', state: city || '',
    tags: String(tags || '').toLowerCase(), lat, lon, url: '', hls: false, clicks: rank, bitrate: 0, codec: '',
    homepage: `https://www.jamendo.com/artist/${id}`, approximate: level === 2
  };
  return stationExcluded(station) ? null : station;
}

export async function loadStations(fetchCatalogue = fetch) {
  const response = await fetchCatalogue(CATALOGUE_URL);
  if (!response.ok) throw new Error('Artist directory unavailable. Try Refresh.');
  const data = await response.json();
  if (!Array.isArray(data?.artists)) throw new Error('Artist directory is malformed.');
  const total = data.artists.length;
  const stations = [];
  data.artists.forEach((row, index) => { const station = normalizeArtist(row, data.countries, total - index); if (station) stations.push(station); });
  return { stations, generated: data.generated || '' };
}

// Pictures come only from Jamendo's image host, over HTTPS.
export function safeImageUrl(value) {
  try { const url = new URL(value); return url.protocol === 'https:' && url.hostname === 'usercontent.jamendo.com' ? url.href : ''; } catch { return ''; }
}
export function artistImageUrl(id) {
  return /^\d{1,9}$/.test(String(id)) ? `https://usercontent.jamendo.com?type=artist&id=${id}&width=300` : '';
}

export function licenseLabel(url) {
  const match = /creativecommons\.org\/licenses\/([a-z-]+)\/([\d.]+)/i.exec(String(url || ''));
  return match ? `CC ${match[1].toUpperCase()} ${match[2]}` : '';
}

export function normalizeTrack(raw) {
  if (!raw || !raw.id || !raw.name) return null;
  let url;
  try { const candidate = new URL(raw.audio); if (candidate.protocol === 'https:' && candidate.hostname.endsWith('.jamendo.com')) url = candidate.href; } catch { /* Unplayable without a valid address. */ }
  if (!url) return null;
  const info = raw.musicinfo || {}, genres = info.tags?.genres, variety = info.tags?.vartags;
  const tags = [...(Array.isArray(genres) ? genres : []), ...(Array.isArray(variety) ? variety : [])].map(tag => String(tag).toLowerCase().trim()).filter(Boolean).join(', ');
  return { id: String(raw.id), title: String(raw.name).trim(), tags, speed: String(info.speed || ''), url, image: safeImageUrl(raw.album_image), duration: Number(raw.duration) || 0, license: licenseLabel(raw.license_ccurl), page: `https://www.jamendo.com/track/${encodeURIComponent(raw.id)}` };
}

// Tracks are fetched when an artist is chosen and never stored; Jamendo sometimes answers with an empty list, so empty answers are retried.
export async function fetchArtistTracks(artistId, request = fetch, clientId = JAMENDO_CLIENT_ID, { attempts = 5, pause = 400 } = {}) {
  if (!/^\d{1,9}$/.test(String(artistId))) throw new Error('Invalid artist');
  const query = new URLSearchParams({ client_id: clientId, format: 'json', artist_id: String(artistId), order: 'popularity_total', limit: '12', audioformat: 'mp32', include: 'licenses musicinfo' });
  for (let attempt = 1; ; attempt++) {
    const response = await request(`${JAMENDO_API}/tracks/?${query}`, { signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Jamendo returned HTTP ${response.status}`);
    const body = await response.json();
    if (body?.headers?.status !== 'success' || !Array.isArray(body.results)) throw new Error('Jamendo could not list tracks');
    const tracks = body.results.map(normalizeTrack).filter(Boolean);
    if (tracks.length) return tracks;
    if (attempt >= attempts) throw new Error('This artist has no playable tracks');
    await new Promise(done => setTimeout(done, pause));
  }
}

// Looks songs up by id (50 per request): played favorites need a fresh audio address and imported links need titles.
export async function fetchTracksByIds(ids, request = fetch, clientId = JAMENDO_CLIENT_ID, { attempts = 4, pause = 400 } = {}) {
  const wanted = [...new Set(ids.map(String))].filter(id => /^\d{1,10}$/.test(id));
  const found = new Map();
  for (let start = 0; start < wanted.length; start += 50) {
    const query = new URLSearchParams({ client_id: clientId, format: 'json', id: wanted.slice(start, start + 50).join(' '), limit: '50', audioformat: 'mp32', include: 'licenses musicinfo' });
    for (let attempt = 1; ; attempt++) {
      const response = await request(`${JAMENDO_API}/tracks/?${query}`, { signal: AbortSignal.timeout(15000) });
      if (!response.ok) throw new Error(`Jamendo returned HTTP ${response.status}`);
      const body = await response.json();
      if (body?.headers?.status !== 'success' || !Array.isArray(body.results)) throw new Error('Jamendo could not list tracks');
      for (const raw of body.results) {
        const track = normalizeTrack(raw);
        if (track && /^\d{1,10}$/.test(String(raw.artist_id))) found.set(track.id, { track, artistId: String(raw.artist_id) });
      }
      if (body.results.length || attempt >= attempts) break;
      await new Promise(done => setTimeout(done, pause));
    }
  }
  return found;
}
