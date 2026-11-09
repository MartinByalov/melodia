// Rebuilds public/assets/artists.json from the Jamendo API: JAMENDO_CLIENT_ID=<id> node scripts/update-artists.js [--dry-run] (needs api.jamendo.com and download.geonames.org).
import { readFile, writeFile, rename, mkdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join, resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { buildBorders, createGeocoder, parseCities, parseCountryInfo, readZipEntry } from './geocode.js';

const root = fileURLToPath(new URL('../', import.meta.url));
const API = 'https://api.jamendo.com/v3.0';
const GEONAMES = 'https://download.geonames.org/export/dump';
const sleep = ms => new Promise(done => setTimeout(done, ms));

async function cached(name, fetchImpl = fetch) {
  const folder = join(tmpdir(), 'melodia-geonames'), path = join(folder, name);
  await mkdir(folder, { recursive: true });
  try { if ((await stat(path)).size > 0) return await readFile(path); } catch { /* download below */ }
  const response = await fetchImpl(`${GEONAMES}/${name}`, { headers: { 'User-Agent': 'Melodia catalogue updater/2.0' }, signal: AbortSignal.timeout(120000) });
  if (!response.ok) throw new Error(`GeoNames ${name}: HTTP ${response.status}`);
  const data = Buffer.from(await response.arrayBuffer());
  await writeFile(path, data);
  return data;
}

// Jamendo sits behind a rate limiter that answers 429 with Retry-After; always honour it.
export async function jamendoGet(clientId, path, params, fetchImpl = fetch) {
  const url = `${API}/${path}/?${new URLSearchParams({ client_id: clientId, format: 'json', ...params })}`;
  let lastError = 'unknown error';
  for (let attempt = 0; attempt < 6; attempt++) {
    const response = await fetchImpl(url, { signal: AbortSignal.timeout(30000) });
    if (response.status === 429) {
      lastError = 'HTTP 429';
      await sleep(((Number(response.headers.get('retry-after')) || 10) + 5) * 1000);
      continue;
    }
    let body;
    try { body = await response.json(); } catch { lastError = `HTTP ${response.status}, not JSON`; await sleep(3000 * (attempt + 1)); continue; }
    if (body?.headers?.status !== 'success') throw new Error(`Jamendo: ${JSON.stringify(body?.headers)}`);
    return body;
  }
  throw new Error(`Jamendo ${path} failed: ${lastError}`);
}

// Jamendo sometimes answers "success" with an empty page under load, so only a page that stays empty after several retries ends the data.
async function nonEmptyPage(load, retries, retryPause) {
  let body = await load();
  for (let attempt = 0; attempt < retries && !body.results.length; attempt++) {
    await sleep(retryPause * (attempt + 1));
    body = await load();
  }
  return body;
}

export function jamendoPage(clientId, offset, fetchImpl = fetch, order = '') {
  const params = { haslocation: 'true', limit: '200', offset: String(offset), fullcount: 'true' };
  if (order) params.order = order;
  return jamendoGet(clientId, 'artists/locations', params, fetchImpl);
}

export function cleanTags(list, limit = 4) {
  return [...new Set((Array.isArray(list) ? list : []).map(tag => String(tag).trim().toLowerCase()).filter(tag => /^[\p{L}\p{N} &+'-]{2,24}$/u.test(tag)))].slice(0, limit);
}

// Artist tags first, then the genres of the artist's tracks, so artists without profile tags still get a style.
export function mergeTags(artistTags, trackGenres) {
  const merged = new Map();
  for (const id of new Set([...artistTags.keys(), ...trackGenres.keys()])) {
    const list = cleanTags([...(artistTags.get(id)?.split(',') || []), ...(trackGenres.get(id) || [])]);
    if (list.length) merged.set(id, list.join(','));
  }
  return merged;
}

// Genres come from a separate endpoint that accepts at most 50 artist ids per call.
export async function collectTags(clientId, ids, { fetchImpl = fetch, pause = 700, onBatch = () => {}, retries = 8, retryPause = 500 } = {}) {
  const tags = new Map();
  for (let start = 0; start < ids.length; start += 50) {
    const batch = ids.slice(start, start + 50);
    const body = await nonEmptyPage(() => jamendoGet(clientId, 'artists/musicinfo', { id: batch.join(' '), limit: '50' }, fetchImpl), retries, retryPause);
    for (const artist of body.results) {
      const list = cleanTags(artist.musicinfo?.tags);
      if (list.length) tags.set(String(artist.id), list.join(','));
    }
    onBatch(start, ids.length);
    await sleep(pause);
  }
  return tags;
}

export async function collectArtists(clientId, { fetchImpl = fetch, pause = 1000, onPage = () => {}, order = '', retries = 4, retryPause = 3000 } = {}) {
  const artists = new Map();
  let total = Infinity, offset = 0;
  while (offset < total) {
    const body = await nonEmptyPage(() => jamendoPage(clientId, offset, fetchImpl, order), offset < total ? retries : 0, retryPause);
    total = Number(body.headers.results_fullcount) || offset + body.results.length;
    for (const artist of body.results) {
      if (!artist.id || !artist.name?.trim() || artists.has(artist.id)) continue;
      artists.set(artist.id, artist);
    }
    onPage(offset, total);
    // Advance by what was actually returned, so a smaller page can never skip artists.
    if (!body.results.length) break;
    offset += body.results.length;
    await sleep(pause);
  }
  return [...artists.values()];
}

// Jamendo lists artists who never published a track; only artists with music belong on the globe.
export async function collectArtistsWithTracks(clientId, { fetchImpl = fetch, pause = 1000, onPage = () => {}, retries = 12, retryPause = 500, minimum = 1 } = {}) {
  const ids = new Map();
  for (let offset = 0; ; ) {
    const body = await nonEmptyPage(() => jamendoGet(clientId, 'tracks', { groupby: 'artist_id', order: 'id', limit: '200', offset: String(offset), include: 'musicinfo' }, fetchImpl), retries, retryPause);
    if (!body.results.length) break;
    for (const track of body.results) if (track.artist_id) ids.set(String(track.artist_id), cleanTags(track.musicinfo?.tags?.genres));
    offset += body.results.length;
    onPage(offset, ids.size);
    await sleep(pause);
  }
  if (ids.size < minimum) throw new Error(`Jamendo reported only ${ids.size} artists with tracks. Refusing to filter with incomplete data.`);
  return ids;
}

// Artists type their own city; show a tidy version of it.
export function tidyCity(text) {
  const city = String(text ?? '').replace(/\s+/g, ' ').trim().slice(0, 60);
  return city && (city === city.toLowerCase() || city === city.toUpperCase()) ? city.toLowerCase().replace(/(^|[\s\-'])(\p{L})/gu, (_, before, letter) => before + letter.toUpperCase()) : city;
}

export function buildCatalogue(artists, geocode, countryNames, tags = new Map()) {
  const rows = [], countries = {}, levels = [0, 0, 0];
  let skipped = 0, rank = 0;
  for (const artist of artists) {
    rank++;
    const location = artist.locations?.[0];
    const placed = location && geocode({ id: artist.id, country: location.country, city: location.city, latitude: location.latitude, longitude: location.longitude });
    if (!placed || !placed.cc) { skipped++; continue; }
    levels[placed.level]++;
    countries[placed.cc] = countryNames.get(placed.cc) || placed.cc;
    const city = placed.level === 2 ? '' : placed.place || tidyCity(location.city);
    const row = [Number(artist.id), artist.name.trim().slice(0, 80), placed.cc, city, Number(placed.lat.toFixed(4)), Number(placed.lon.toFixed(4)), placed.level];
    if (tags.has(String(artist.id))) row.push(tags.get(String(artist.id)));
    rows.push(row);
  }
  return { rows, countries, levels, skipped };
}

export async function updateArtists({ clientId = process.env.JAMENDO_CLIENT_ID, dryRun = false, cataloguePath = resolve(root, 'public/assets/artists.json'), reportPath = resolve(root, 'reports/artists-update.json') } = {}) {
  if (!clientId) throw new Error('Set JAMENDO_CLIENT_ID (register an application at https://devportal.jamendo.com).');
  const report = { startedAt: new Date().toISOString(), status: 'failed', dryRun };
  try {
    const [citiesZip, countryText, borderText] = await Promise.all([
      cached('cities5000.zip'), cached('countryInfo.txt'), readFile(resolve(root, 'public/assets/countries.geojson'), 'utf8')
    ]);
    const { iso3to2, names } = parseCountryInfo(countryText.toString('utf8'));
    const places = parseCities(readZipEntry(citiesZip, 'cities5000.txt').toString('utf8'));
    const geocode = createGeocoder({ places, iso3to2, borders: buildBorders(JSON.parse(borderText)) });
    // Jamendo only ranks artists that have listening statistics, so rank those first and append the rest.
    const popular = await collectArtists(clientId, { order: 'popularity_total' });
    const everyone = await collectArtists(clientId, { onPage: (offset, total) => { if (offset % 4000 === 0) console.log(`artists ${offset}/${total}`); } });
    const known = new Set(popular.map(artist => artist.id));
    const located = [...popular, ...everyone.filter(artist => !known.has(artist.id))];
    const withMusic = await collectArtistsWithTracks(clientId, { minimum: 10000, onPage: (offset, count) => { if (offset % 10000 === 0) console.log(`artists with tracks ${count} (${offset} scanned)`); } });
    const artists = located.filter(artist => withMusic.has(String(artist.id)));
    report.withoutTracks = located.length - artists.length;
    const placed = buildCatalogue(artists, geocode, names);
    const artistTags = await collectTags(clientId, placed.rows.map(row => row[0]), { onBatch: (start, total) => { if (start % 5000 === 0) console.log(`genres ${start}/${total}`); } });
    const tags = mergeTags(artistTags, withMusic);
    const { rows, countries, levels, skipped } = buildCatalogue(artists, geocode, names, tags);
    Object.assign(report, { located: located.length, received: artists.length, accepted: rows.length, withGenres: tags.size, skipped, exactCoordinates: levels[0], cityLookup: levels[1], countryOnly: levels[2], countries: Object.keys(countries).length });
    let previous = 0;
    try { previous = JSON.parse(await readFile(cataloguePath, 'utf8')).artists.length; } catch { /* first run */ }
    if (rows.length < 1000) throw new Error('Refusing to publish a suspiciously small catalogue');
    if (previous && rows.length < previous * .8) throw new Error('Catalogue shrank by more than 20%; review before publishing');
    report.status = dryRun ? 'validated' : 'ready';
    report.finishedAt = new Date().toISOString();
    await mkdir(dirname(reportPath), { recursive: true });
    await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n');
    if (!dryRun) {
      const temporary = `${cataloguePath}.${process.pid}.tmp`;
      await writeFile(temporary, JSON.stringify({ version: 1, source: 'Jamendo', generated: new Date().toISOString().slice(0, 10), countries, artists: rows }));
      await rename(temporary, cataloguePath);
    }
    return report;
  } catch (error) {
    report.error = error.message;
    report.finishedAt = new Date().toISOString();
    try { await mkdir(dirname(reportPath), { recursive: true }); await writeFile(reportPath, JSON.stringify(report, null, 2) + '\n'); } catch { /* the original error matters more */ }
    throw error;
  }
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  updateArtists({ dryRun: process.argv.includes('--dry-run') }).then(report => console.log(report)).catch(error => { console.error(error.message); process.exit(1); });
}
